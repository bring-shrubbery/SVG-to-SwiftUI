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
