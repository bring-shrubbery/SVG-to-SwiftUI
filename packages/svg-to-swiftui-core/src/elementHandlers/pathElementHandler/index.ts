import type { ElementNode } from "svg-parser";
import type { SVGCommand } from "svg-pathdata/lib/types";
import { SVGPathData } from "svg-pathdata";

import type { SVGPathAttributes } from "../../svgTypes";
import type { TranspilerOptions } from "../../types";
import type { SwiftGenerator } from "../types";
import { arcToCubicCurves } from "./arcToCubicBezier";
import { generateClosePathSwift } from "./closePathGenerator";
import { generateCubicCurveSwift } from "./cubicCurveGenerator";
import { generateLineToSwift } from "./lineToGenerator";
import { generateMoveToSwift } from "./moveToGenerator";
import { generateQuadCurveSwift } from "./quadCurveGenerator";

// ---------------------------------------------------------------------------
// Winding normalization: ensure the dominant (first) subpath is CW, matching
// CGPath.addRect/addEllipse natural winding, so overlapping elements don't
// create unwanted holes under the non-zero (winding) fill rule.
// Relative winding between subpaths within an element is preserved.
// ---------------------------------------------------------------------------

interface SimplePoint {
  x: number;
  y: number;
}

/**
 * Compute the signed area of a subpath using the shoelace formula.
 * Uses normalized commands (M, L, C, Q, Z only — absolute coords).
 * Samples bezier curves at intermediate points for accuracy.
 * Positive = CW in screen coords (y-down), Negative = CCW.
 */
function computeSubpathSignedArea(commands: SVGCommand[]): number {
  const points: SimplePoint[] = [];
  let curX = 0;
  let curY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case SVGPathData.MOVE_TO:
        curX = cmd.x;
        curY = cmd.y;
        points.push({ x: curX, y: curY });
        break;
      case SVGPathData.LINE_TO:
        curX = cmd.x;
        curY = cmd.y;
        points.push({ x: curX, y: curY });
        break;
      case SVGPathData.CURVE_TO: {
        const x0 = curX, y0 = curY;
        for (const t of [0.25, 0.5, 0.75]) {
          const mt = 1 - t;
          const px = mt * mt * mt * x0 + 3 * mt * mt * t * cmd.x1 + 3 * mt * t * t * cmd.x2 + t * t * t * cmd.x;
          const py = mt * mt * mt * y0 + 3 * mt * mt * t * cmd.y1 + 3 * mt * t * t * cmd.y2 + t * t * t * cmd.y;
          points.push({ x: px, y: py });
        }
        curX = cmd.x;
        curY = cmd.y;
        points.push({ x: curX, y: curY });
        break;
      }
      case SVGPathData.QUAD_TO: {
        const x0 = curX, y0 = curY;
        for (const t of [0.25, 0.5, 0.75]) {
          const mt = 1 - t;
          const px = mt * mt * x0 + 2 * mt * t * cmd.x1 + t * t * cmd.x;
          const py = mt * mt * y0 + 2 * mt * t * cmd.y1 + t * t * cmd.y;
          points.push({ x: px, y: py });
        }
        curX = cmd.x;
        curY = cmd.y;
        points.push({ x: curX, y: curY });
        break;
      }
      case SVGPathData.CLOSE_PATH:
        break;
    }
  }

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i]!.x * points[j]!.y;
    area -= points[j]!.x * points[i]!.y;
  }
  return area / 2;
}

/**
 * Reverse a subpath's commands so CW becomes CCW and vice versa.
 * Input: normalized commands (only M, L, C, Q, Z — absolute coords).
 */
function reverseSubpath(commands: SVGCommand[]): SVGCommand[] {
  if (commands.length <= 1) return commands;

  const hasClose = commands[commands.length - 1]?.type === SVGPathData.CLOSE_PATH;
  const drawCmds = hasClose ? commands.slice(1, -1) : commands.slice(1);
  const firstMove = commands[0]!;
  if (firstMove.type !== SVGPathData.MOVE_TO) return commands;

  const trail: SimplePoint[] = [{ x: firstMove.x, y: firstMove.y }];
  for (const cmd of drawCmds) {
    if ("x" in cmd && "y" in cmd) {
      trail.push({ x: cmd.x as number, y: cmd.y as number });
    }
  }

  const result: SVGCommand[] = [
    { type: SVGPathData.MOVE_TO, relative: false, x: trail[trail.length - 1]!.x, y: trail[trail.length - 1]!.y },
  ];

  for (let i = drawCmds.length - 1; i >= 0; i--) {
    const cmd = drawCmds[i]!;
    const toPt = trail[i]!;

    switch (cmd.type) {
      case SVGPathData.LINE_TO:
        result.push({ type: SVGPathData.LINE_TO, relative: false, x: toPt.x, y: toPt.y });
        break;
      case SVGPathData.QUAD_TO:
        result.push({ type: SVGPathData.QUAD_TO, relative: false, x1: cmd.x1, y1: cmd.y1, x: toPt.x, y: toPt.y });
        break;
      case SVGPathData.CURVE_TO:
        result.push({ type: SVGPathData.CURVE_TO, relative: false, x1: cmd.x2, y1: cmd.y2, x2: cmd.x1, y2: cmd.y1, x: toPt.x, y: toPt.y });
        break;
      default:
        result.push({ type: SVGPathData.LINE_TO, relative: false, x: toPt.x, y: toPt.y });
        break;
    }
  }

  if (hasClose) {
    result.push({ type: SVGPathData.CLOSE_PATH });
  }

  return result;
}

/**
 * Check if the first (dominant) subpath is CCW. If so, reverse ALL subpaths
 * to flip their winding while preserving relative winding between them.
 * This makes the dominant subpath CW (matching addRect/addEllipse).
 */
function ensureDominantCW(commands: SVGCommand[]): { commands: SVGCommand[]; reversed: boolean } {
  // Split into subpaths
  const subpaths: SVGCommand[][] = [];
  let current: SVGCommand[] = [];

  for (const cmd of commands) {
    if (cmd.type === SVGPathData.MOVE_TO && current.length > 0) {
      subpaths.push(current);
      current = [];
    }
    current.push(cmd);
  }
  if (current.length > 0) {
    subpaths.push(current);
  }

  if (subpaths.length === 0) return { commands, reversed: false };

  // Check the first subpath's winding
  const firstArea = computeSubpathSignedArea(subpaths[0]!);
  if (firstArea >= 0) {
    // Already CW or degenerate — no change needed
    return { commands, reversed: false };
  }

  // First subpath is CCW — reverse ALL subpaths to flip winding
  const result: SVGCommand[] = [];
  for (const subpath of subpaths) {
    result.push(...reverseSubpath(subpath));
  }

  return { commands: result, reversed: true };
}

/**
 * Converts SVG Path element to SwiftUI path string.
 * @param element SVG Path Element
 * @param options Transpiler options
 */
export default function handlePathElement(
  element: ElementNode,
  options: TranspilerOptions,
): string[] {
  const properties = element.properties as unknown;

  if (properties) {
    const props = properties as SVGPathAttributes;

    if (!props.d) {
      throw new Error(
        "Parameter `d` has to be provided on the <path> element!",
      );
    }

    options.lastPathId++;

    const pathData = new SVGPathData(props.d).toAbs();

    // For filled paths, normalize winding to CW to match addRect/addEllipse
    if (options.normalizeWindingCW) {
      // Normalize a copy for winding detection (resolve H/V/S/T/A to M/L/C/Q/Z)
      const forAnalysis = new SVGPathData(props.d)
        .toAbs()
        .normalizeHVZ(false, true, true) // normalize H→L, V→L, keep Z
        .normalizeST()
        .aToC();

      const { commands: cwCommands, reversed } = ensureDominantCW(forAnalysis.commands);

      if (reversed) {
        return convertPathToSwift(cwCommands, options);
      }
    }

    // No reversal needed — use original commands to preserve exact output format
    return convertPathToSwift(pathData.commands, options);
  } else {
    throw new Error("Path element does not have any properties!");
  }
}

/**
 * Converts a list of `SVGCommand`s to SwiftUI Path
 * @param data Path data if SVGCommand[] type.
 * @param options Transpiler options
 */
const convertPathToSwift: SwiftGenerator<SVGCommand[]> = (data, options) => {
  const swiftAccumulator: string[] = [];

  // Track the last quad control point for T (smooth quad) command chaining
  let lastQuadControl: { x: number; y: number } | null = null;

  for (let i = 0; i < data.length; i++) {
    const el = data[i];

    // Handle data depending on command type.
    switch (el?.type) {
      // Command M
      case SVGPathData.MOVE_TO: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;
        swiftAccumulator.push(...generateMoveToSwift(d, options));
        break;
      }
      // Command L
      case SVGPathData.LINE_TO: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;
        swiftAccumulator.push(...generateLineToSwift(d, options));
        break;
      }
      // Command H
      case SVGPathData.HORIZ_LINE_TO: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;

        let y = 0;

        for (let li = i - 1; li >= 0; li--) {
          const prevElement = data[li];

          if (
            prevElement?.type === SVGPathData.MOVE_TO ||
            prevElement?.type === SVGPathData.LINE_TO ||
            prevElement?.type === SVGPathData.VERT_LINE_TO ||
            prevElement?.type === SVGPathData.CURVE_TO ||
            prevElement?.type === SVGPathData.SMOOTH_CURVE_TO ||
            prevElement?.type === SVGPathData.QUAD_TO ||
            prevElement?.type === SVGPathData.SMOOTH_QUAD_TO ||
            prevElement?.type === SVGPathData.ARC
          ) {
            y = prevElement.y;
            break;
          } else if (prevElement?.type === SVGPathData.HORIZ_LINE_TO) {
            continue;
          } else {
            break;
          }
        }

        swiftAccumulator.push(...generateLineToSwift({ x: d.x, y }, options));
        break;
      }
      // Command V
      case SVGPathData.VERT_LINE_TO: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;

        let x = 0;

        // Go backwards until a command with x value is found.
        for (let li = i - 1; li >= 0; li--) {
          const prevElement = data[li];

          if (
            prevElement?.type === SVGPathData.MOVE_TO ||
            prevElement?.type === SVGPathData.LINE_TO ||
            prevElement?.type === SVGPathData.HORIZ_LINE_TO ||
            prevElement?.type === SVGPathData.CURVE_TO ||
            prevElement?.type === SVGPathData.SMOOTH_CURVE_TO ||
            prevElement?.type === SVGPathData.QUAD_TO ||
            prevElement?.type === SVGPathData.SMOOTH_QUAD_TO ||
            prevElement?.type === SVGPathData.ARC
          ) {
            x = prevElement.x;
            break;
          } else if (prevElement?.type === SVGPathData.VERT_LINE_TO) {
            continue;
          } else {
            break;
          }
        }

        swiftAccumulator.push(...generateLineToSwift({ x, y: d.y }, options));
        break;
      }
      // Command Z
      case SVGPathData.CLOSE_PATH: {
        swiftAccumulator.push(...generateClosePathSwift(null, options));
        break;
      }
      // Command Q
      case SVGPathData.QUAD_TO: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;
        lastQuadControl = { x: d.x1, y: d.y1 };
        swiftAccumulator.push(...generateQuadCurveSwift(d, options));
        break;
      }
      // Command T
      case SVGPathData.SMOOTH_QUAD_TO: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;
        const prevElement = data[i - 1];

        // Reflect the last quad control point around the previous endpoint,
        // or use the current point if previous command is not Q/T
        let x1: number;
        let y1: number;

        if (
          lastQuadControl &&
          (prevElement?.type === SVGPathData.QUAD_TO ||
            prevElement?.type === SVGPathData.SMOOTH_QUAD_TO)
        ) {
          x1 = prevElement.x + (prevElement.x - lastQuadControl.x);
          y1 = prevElement.y + (prevElement.y - lastQuadControl.y);
        } else if (prevElement && "x" in prevElement && "y" in prevElement) {
          x1 = prevElement.x as number;
          y1 = prevElement.y as number;
        } else {
          x1 = d.x;
          y1 = d.y;
        }

        lastQuadControl = { x: x1, y: y1 };
        swiftAccumulator.push(
          ...generateQuadCurveSwift({ ...d, x1, y1 }, options),
        );
        break;
      }
      // Command C
      case SVGPathData.CURVE_TO: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;
        swiftAccumulator.push(...generateCubicCurveSwift(d, options));
        break;
      }
      // Command S
      case SVGPathData.SMOOTH_CURVE_TO: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;
        const prevElement = data[i - 1];

        // Setup first control point: reflect cp2 of previous C/S,
        // or use current point if previous command is not C/S
        let x1: number;
        let y1: number;

        if (
          prevElement?.type === SVGPathData.CURVE_TO ||
          prevElement?.type === SVGPathData.SMOOTH_CURVE_TO
        ) {
          x1 = prevElement.x + (prevElement.x - prevElement.x2);
          y1 = prevElement.y + (prevElement.y - prevElement.y2);
        } else if (prevElement && "x" in prevElement && "y" in prevElement) {
          x1 = prevElement.x as number;
          y1 = prevElement.y as number;
        } else {
          x1 = d.x;
          y1 = d.y;
        }

        const swiftLines = generateCubicCurveSwift({ ...d, x1, y1 }, options);

        swiftAccumulator.push(...swiftLines);
        break;
      }
      // Command A
      case SVGPathData.ARC: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type, relative, ...d } = el;

        // Find the current point (start of the arc)
        let startX = 0;
        let startY = 0;
        let foundX = false;
        let foundY = false;
        for (let li = i - 1; li >= 0 && (!foundX || !foundY); li--) {
          const prev = data[li];
          if (
            prev?.type === SVGPathData.MOVE_TO ||
            prev?.type === SVGPathData.LINE_TO ||
            prev?.type === SVGPathData.CURVE_TO ||
            prev?.type === SVGPathData.SMOOTH_CURVE_TO ||
            prev?.type === SVGPathData.QUAD_TO ||
            prev?.type === SVGPathData.SMOOTH_QUAD_TO ||
            prev?.type === SVGPathData.ARC
          ) {
            if (!foundX) startX = prev.x;
            if (!foundY) startY = prev.y;
            break;
          } else if (prev?.type === SVGPathData.HORIZ_LINE_TO) {
            if (!foundX) { startX = prev.x; foundX = true; }
          } else if (prev?.type === SVGPathData.VERT_LINE_TO) {
            if (!foundY) { startY = prev.y; foundY = true; }
          } else {
            break;
          }
        }

        const curves = arcToCubicCurves({
          x1: startX,
          y1: startY,
          rx: d.rX,
          ry: d.rY,
          xAxisRotation: d.xRot,
          largeArc: d.lArcFlag !== 0,
          sweep: d.sweepFlag !== 0,
          x2: d.x,
          y2: d.y,
        });

        for (const curve of curves) {
          swiftAccumulator.push(
            ...generateCubicCurveSwift(curve, options),
          );
        }
        break;
      }
    }
  }

  return swiftAccumulator;
};
