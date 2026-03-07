import type { ElementNode } from "svg-parser";

import type { TranspilerOptions } from "../types";
import { extractStyle } from "../styleUtils";
import { clampNormalisedSizeProduct } from "../utils";
import handleCircleElement from "./circleElementHandler";
import handleEllipseElement from "./ellipseElementHandler";
import handleGroupElement from "./groupElementHandler";
import handlePathElement from "./pathElementHandler";
import handleRectElement from "./rectElementHandler";

interface PresentationStyle {
  hasFill: boolean;
  hasStroke: boolean;
  strokeWidth: number;
  strokeLinecap: string;
  strokeLinejoin: string;
  strokeMiterlimit: number;
}

function extractPresentationStyle(
  element: ElementNode,
): PresentationStyle {
  try {
    const style = extractStyle(element);
    const fill = style.fill as string | undefined;
    const stroke = style.stroke as string | undefined;

    return {
      hasFill: fill !== "none",
      hasStroke: !!stroke && stroke !== "none",
      strokeWidth: style["stroke-width"]
        ? parseFloat(String(style["stroke-width"]))
        : 1,
      strokeLinecap: (style["stroke-linecap"] as string) || "butt",
      strokeLinejoin: (style["stroke-linejoin"] as string) || "miter",
      strokeMiterlimit: style["stroke-miterlimit"]
        ? parseFloat(String(style["stroke-miterlimit"]))
        : 4, // SVG default is 4
    };
  } catch {
    return {
      hasFill: true,
      hasStroke: false,
      strokeWidth: 1,
      strokeLinecap: "butt",
      strokeLinejoin: "miter",
      strokeMiterlimit: 4,
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

function buildStrokeLines(
  lines: string[],
  style: PresentationStyle,
  options: TranspilerOptions,
): string[] {
  const normalizedWidth = style.strokeWidth / options.viewBox.width;
  const strokeWidthStr = clampNormalisedSizeProduct(
    normalizedWidth.toFixed(options.precision).replace(/0+$/, ""),
    "width",
  );

  const lineCap = LINE_CAP_MAP[style.strokeLinecap] || ".butt";
  const lineJoin = LINE_JOIN_MAP[style.strokeLinejoin] || ".miter";

  options.lastPathId++;
  const varName = `strokePath${options.lastPathId}`;
  return [
    `var ${varName} = Path()`,
    ...lines.map((l) => l.replace(/^path\./, `${varName}.`)),
    `path.addPath(${varName}.strokedPath(StrokeStyle(lineWidth: ${strokeWidthStr}, lineCap: ${lineCap}, lineJoin: ${lineJoin}, miterLimit: ${style.strokeMiterlimit})))`,
  ];
}

function wrapWithStroke(
  lines: string[],
  style: PresentationStyle,
  options: TranspilerOptions,
): string[] {
  // Invisible element — no fill, no stroke
  if (!style.hasFill && !style.hasStroke) return [];

  // Fill only: no wrapping needed
  if (style.hasFill && !style.hasStroke) return lines;

  // Fill + stroke: return fill geometry (expanded by half stroke width)
  if (style.hasFill && style.hasStroke) return lines;

  // Stroke only (fill="none"): convert stroke outline into filled geometry
  return buildStrokeLines(lines, style, options);
}

export function handleElement(
  element: ElementNode,
  options: TranspilerOptions,
): string[] {
  // Groups/svg delegate directly without stroke handling
  if (element.tagName === "g" || element.tagName === "svg") {
    return handleGroupElement(element, options);
  }

  const style = extractPresentationStyle(element);

  // For fill+stroke elements, expand geometry by half stroke width
  const prevExpansion = options.strokeExpansion;
  if (style.hasFill && style.hasStroke) {
    options.strokeExpansion = style.strokeWidth / 2;
  } else {
    options.strokeExpansion = 0;
  }

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

    default:
      console.error(
        [
          `Element <${element.tagName}> is not supported!`,
          "Please open a Github issue for this or send a PR with the implementation!",
        ].join("\n"),
      );
      options.strokeExpansion = prevExpansion;
      return [];
  }

  options.strokeExpansion = prevExpansion;

  // Track fill colors for eoFill detection
  if (style.hasFill) {
    try {
      const elStyle = extractStyle(element);
      const fill = elStyle.fill ? String(elStyle.fill).toLowerCase().trim() : "";
      if (fill) {
        options.fillColors.add(fill);
      }
    } catch {
      // no style to extract
    }
  }

  return wrapWithStroke(rawLines, style, options);
}
