import type { ElementNode } from "svg-parser";
import { extractStyle } from "../styleUtils";
import { getSVGTransform, wrapWithSVGTransform } from "../transformUtils";
import type { TranspilerOptions } from "../types";
import { clampNormalisedSizeProduct, formatRoundedNumber } from "../utils";
import handleCircleElement from "./circleElementHandler";
import handleEllipseElement from "./ellipseElementHandler";
import handleGroupElement from "./groupElementHandler";
import handleLineElement from "./lineElementHandler";
import handlePathElement from "./pathElementHandler";
import handlePolygonElement from "./polygonElementHandler";
import handlePolylineElement from "./polylineElementHandler";
import handleRectElement from "./rectElementHandler";
import { resolvedGeometryNumber } from "./resolvedGeometry";
import handleSwitchElement from "./switchElementHandler";
import handleUseElement from "./useElementHandler";

const NON_RENDERING_ELEMENTS = new Set([
  "defs",
  "symbol",
  "title",
  "desc",
  "metadata",
  "style",
  "script",
  "linearGradient",
  "radialGradient",
  "stop",
  "pattern",
  "clipPath",
  "mask",
  "marker",
]);

interface PresentationStyle {
  hasFill: boolean;
  hasStroke: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeLinecap: string;
  strokeLinejoin: string;
  strokeMiterlimit: number;
  fillRule: string;
}

function extractPresentationStyle(
  element: ElementNode,
  parentStyle: Record<string, string | number>,
  resolved?: import("../renderTree/types").ComputedStyle,
): PresentationStyle {
  if (resolved) {
    const stroke =
      resolved.stroke.type === "solid" ? resolved.stroke.value : resolved.stroke.type === "none" ? "none" : "";
    return {
      hasFill: resolved.fill.type !== "none",
      hasStroke: resolved.stroke.type !== "none",
      strokeColor: stroke.toLowerCase().trim(),
      strokeWidth: resolved.strokeStyle.width,
      strokeLinecap: resolved.strokeStyle.lineCap,
      strokeLinejoin: resolved.strokeStyle.lineJoin,
      strokeMiterlimit: resolved.strokeStyle.miterLimit,
      fillRule: resolved.fillRule,
    };
  }
  try {
    const ownStyle = extractStyle(element);
    // Merge: own style overrides inherited parent style
    const style = { ...parentStyle, ...ownStyle };
    const fill = style.fill as string | undefined;
    const stroke = style.stroke as string | undefined;

    return {
      hasFill: fill !== "none",
      hasStroke: !!stroke && stroke !== "none",
      strokeColor: (stroke ?? "").toLowerCase().trim(),
      strokeWidth: resolvedGeometryNumber(style["stroke-width"], 1),
      strokeLinecap: (style["stroke-linecap"] as string) || "butt",
      strokeLinejoin: (style["stroke-linejoin"] as string) || "miter",
      strokeMiterlimit: resolvedGeometryNumber(style["stroke-miterlimit"], 4), // SVG default is 4
      fillRule: (style["fill-rule"] as string) || (style.fillRule as string) || "nonzero",
    };
  } catch {
    // No own style — fall back to parent style
    const fill = parentStyle.fill as string | undefined;
    const stroke = parentStyle.stroke as string | undefined;

    return {
      hasFill: fill !== "none" && fill !== undefined,
      hasStroke: !!stroke && stroke !== "none",
      strokeColor: (stroke ?? "").toLowerCase().trim(),
      strokeWidth: resolvedGeometryNumber(parentStyle["stroke-width"], 1),
      strokeLinecap: (parentStyle["stroke-linecap"] as string) || "butt",
      strokeLinejoin: (parentStyle["stroke-linejoin"] as string) || "miter",
      strokeMiterlimit: resolvedGeometryNumber(parentStyle["stroke-miterlimit"], 4),
      fillRule: (parentStyle["fill-rule"] as string) || (parentStyle.fillRule as string) || "nonzero",
    };
  }
}

const LINE_CAP_MAP: Record<string, string> = {
  butt: ".butt",
  round: ".round",
  square: ".square",
};

const LINE_JOIN_MAP: Record<string, string> = {
  miter: ".miter",
  round: ".round",
  bevel: ".bevel",
};

function buildStrokeLines(lines: string[], style: PresentationStyle, options: TranspilerOptions): string[] {
  const normalizedWidth = style.strokeWidth / options.viewBox.width;
  const strokeWidthStr = clampNormalisedSizeProduct(formatRoundedNumber(normalizedWidth, options.precision), "width");

  const lineCap = LINE_CAP_MAP[style.strokeLinecap] || ".butt";
  const lineJoin = LINE_JOIN_MAP[style.strokeLinejoin] || ".miter";

  const LIGHT_COLORS = new Set(["white", "#fff", "#ffffff", "rgb(255,255,255)"]);
  const isLightStroke = LIGHT_COLORS.has(style.strokeColor.replace(/\s/g, ""));

  options.lastPathId++;
  const varName = `strokePath${options.lastPathId}`;
  const strokeCall = `${varName}.strokedPath(StrokeStyle(lineWidth: ${strokeWidthStr}, lineCap: ${lineCap}, lineJoin: ${lineJoin}, miterLimit: ${style.strokeMiterlimit}))`;

  if (options.separatePaintLayer) {
    return [
      `var ${varName} = Path()`,
      ...lines.map((l) => l.replace(/^path\./, `${varName}.`)),
      `path.addPath(${strokeCall})`,
    ];
  }

  if (isLightStroke) {
    // Light strokes use the opposite winding from the document's dark geometry.
    return [
      `var ${varName} = Path()`,
      ...lines.map((l) => l.replace(/^path\./, `${varName}.`)),
      `path.addPath(${varName}.cwStrokedPath(StrokeStyle(lineWidth: ${strokeWidthStr}, lineCap: ${lineCap}, lineJoin: ${lineJoin}, miterLimit: ${style.strokeMiterlimit})))`,
    ];
  }

  if (options.hasFills) {
    // Keep CoreGraphics' natural stroke winding so it matches primitive paths.
    return [
      `var ${varName} = Path()`,
      ...lines.map((l) => l.replace(/^path\./, `${varName}.`)),
      `path.addPath(${strokeCall})`,
    ];
  }

  // All-stroke SVG: use normal strokedPath
  return [
    `var ${varName} = Path()`,
    ...lines.map((l) => l.replace(/^path\./, `${varName}.`)),
    `path.addPath(${strokeCall})`,
  ];
}

function wrapWithStroke(lines: string[], style: PresentationStyle, options: TranspilerOptions): string[] {
  // Invisible element — no fill, no stroke
  if (!style.hasFill && !style.hasStroke) return [];

  // Fill only: no wrapping needed
  if (style.hasFill && !style.hasStroke) return lines;

  // Fill + stroke: return fill geometry (expanded by half stroke width)
  if (style.hasFill && style.hasStroke) return lines;

  // Stroke only (fill="none"): convert stroke outline into filled geometry
  return buildStrokeLines(lines, style, options);
}

export function handleElement(element: ElementNode, options: TranspilerOptions): string[] {
  if (NON_RENDERING_ELEMENTS.has(element.tagName ?? "")) return [];

  // Groups/svg delegate directly without stroke handling
  if (element.tagName === "g" || element.tagName === "svg" || element.tagName === "a") {
    return handleGroupElement(element, options);
  }

  if (element.tagName === "use") return handleUseElement(element, options);
  if (element.tagName === "switch") return handleSwitchElement(element, options);

  const style = extractPresentationStyle(element, options.parentStyle, options.resolvedStyle);

  // <line> elements have no fillable area — always stroke-only
  if (element.tagName === "line") {
    style.hasFill = false;
    if (!style.hasStroke) {
      // line with no stroke is invisible
      return [];
    }
  }

  // Stroke geometry is emitted separately after the element is converted.
  const prevExpansion = options.strokeExpansion;
  options.strokeExpansion = 0;

  // Enable winding normalization only for filled paths using winding rule (not stroke-only, not evenodd)
  const prevNormalize = options.normalizeWindingCW;
  options.normalizeWindingCW = style.hasFill && style.fillRule !== "evenodd";

  // Expose this element's fill-rule to the path handler. SwiftUI's Path uses
  // non-zero winding by default, so evenodd paths need their nested subpaths
  // reversed to produce holes equivalent to SVG's evenodd semantics.
  const prevFillRule = options.fillRule;
  options.fillRule = style.fillRule;

  let rawLines: string[];

  switch (element.tagName) {
    case "path":
      rawLines = handlePathElement(element, options);
      break;

    case "circle":
      rawLines = handleCircleElement(element, options);
      break;

    case "rect":
      rawLines = handleRectElement(element, options);
      break;

    case "ellipse":
      rawLines = handleEllipseElement(element, options);
      break;

    case "line":
      rawLines = handleLineElement(element, options);
      break;

    case "polyline":
      rawLines = handlePolylineElement(element, options);
      break;

    case "polygon":
      rawLines = handlePolygonElement(element, options);
      break;

    default:
      console.error(
        [
          `Element <${element.tagName}> is not supported!`,
          "Please open a Github issue for this or send a PR with the implementation!",
        ].join("\n"),
      );
      options.strokeExpansion = prevExpansion;
      options.normalizeWindingCW = prevNormalize;
      options.fillRule = prevFillRule;
      return [];
  }

  options.strokeExpansion = prevExpansion;
  options.normalizeWindingCW = prevNormalize;
  options.fillRule = prevFillRule;

  // Detect light fills for winding reversal (creates holes under winding fill rule)
  let fillColor = "";
  if (style.hasFill) {
    if (options.resolvedStyle?.fill.type === "solid") {
      fillColor = options.resolvedStyle.fill.value.toLowerCase().trim();
      options.fillColors.add(fillColor);
    } else if (!options.resolvedStyle) {
      try {
        const elStyle = extractStyle(element);
        fillColor = elStyle.fill ? String(elStyle.fill).toLowerCase().trim() : "";
        if (fillColor) options.fillColors.add(fillColor);
      } catch {
        // Legacy direct-handler callers can still provide inherited paint.
        const parentFill = options.parentStyle.fill;
        if (parentFill) fillColor = String(parentFill).toLowerCase().trim();
      }
    }
  }

  const LIGHT_FILLS = new Set(["white", "#fff", "#ffffff", "rgb(255,255,255)"]);
  const isLightFill = style.hasFill && LIGHT_FILLS.has(fillColor.replace(/\s/g, ""));

  const shouldReverseFill = options.hasStrokes ? !isLightFill : isLightFill;
  let fillLines = rawLines;
  if (!options.separatePaintLayer && style.hasFill && shouldReverseFill && rawLines.length > 0) {
    options.lastPathId++;
    const holeVar = `_hole${options.lastPathId}`;
    fillLines = [
      `var ${holeVar} = Path()`,
      ...rawLines.map((l) => l.replace(/^path\./, `${holeVar}.`)),
      `path.addReversedPath(${holeVar})`,
    ];
  }

  let resultLines: string[];
  if (style.hasFill && style.hasStroke) {
    resultLines = [...fillLines, ...buildStrokeLines(rawLines, style, options)];
  } else if (style.hasFill) {
    resultLines = fillLines;
  } else {
    resultLines = wrapWithStroke(rawLines, style, options);
  }

  return wrapWithSVGTransform(resultLines, getSVGTransform(element), options);
}
