import { parsePlainNumber, SVGLengthError } from "./lengths";
import type { AffineTransform } from "./transformUtils";
import { IDENTITY_TRANSFORM } from "./transformUtils";
import type { ViewBoxData } from "./types";

export type PreserveAspectRatioAlign =
  | "none"
  | "xMinYMin"
  | "xMidYMin"
  | "xMaxYMin"
  | "xMinYMid"
  | "xMidYMid"
  | "xMaxYMid"
  | "xMinYMax"
  | "xMidYMax"
  | "xMaxYMax";

export interface PreserveAspectRatio {
  defer: boolean;
  align: PreserveAspectRatioAlign;
  meetOrSlice: "meet" | "slice";
}

export interface ViewportRect extends ViewBoxData {}

const ALIGNMENTS = new Set<PreserveAspectRatioAlign>([
  "none",
  "xMinYMin",
  "xMidYMin",
  "xMaxYMin",
  "xMinYMid",
  "xMidYMid",
  "xMaxYMid",
  "xMinYMax",
  "xMidYMax",
  "xMaxYMax",
]);

export const DEFAULT_PRESERVE_ASPECT_RATIO: PreserveAspectRatio = {
  defer: false,
  align: "xMidYMid",
  meetOrSlice: "meet",
};

export function parseViewBox(value: unknown): ViewBoxData | undefined {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const source = String(value).trim();
  if (/^,|,$|,,/.test(source)) throw new SVGLengthError("invalid-viewbox", `Invalid viewBox: ${source}`);
  const tokens = source.split(/[\s,]+/).filter(Boolean);
  if (tokens.length !== 4) throw new SVGLengthError("invalid-viewbox", "viewBox must contain exactly four numbers.");
  const [x, y, width, height] = tokens.map((token) => parsePlainNumber(token, "viewBox number"));
  if (width! < 0 || height! < 0)
    throw new SVGLengthError("negative-viewbox-size", "viewBox width and height cannot be negative.");
  return { x: x!, y: y!, width: width!, height: height! };
}

export function parsePreserveAspectRatio(value: unknown): PreserveAspectRatio {
  if (value === undefined || value === null || String(value).trim() === "") return { ...DEFAULT_PRESERVE_ASPECT_RATIO };
  const tokens = String(value).trim().split(/\s+/);
  const defer = tokens[0]?.toLowerCase() === "defer";
  if (defer) tokens.shift();
  const align = tokens.shift() as PreserveAspectRatioAlign | undefined;
  if (!align || !ALIGNMENTS.has(align)) {
    throw new SVGLengthError("invalid-preserve-aspect-ratio", `Invalid preserveAspectRatio alignment: ${align ?? ""}`);
  }
  const meetOrSlice = (tokens.shift() ?? "meet") as "meet" | "slice";
  if (meetOrSlice !== "meet" && meetOrSlice !== "slice") {
    throw new SVGLengthError("invalid-preserve-aspect-ratio", `Invalid preserveAspectRatio mode: ${meetOrSlice}`);
  }
  if (tokens.length > 0)
    throw new SVGLengthError("invalid-preserve-aspect-ratio", "preserveAspectRatio has extra tokens.");
  return { defer, align, meetOrSlice: align === "none" ? "meet" : meetOrSlice };
}

/** Standards-based equivalent transform for an SVG viewport. */
export function viewBoxTransform(
  viewBox: ViewBoxData | undefined,
  viewport: ViewportRect,
  preserveAspectRatio: PreserveAspectRatio = DEFAULT_PRESERVE_ASPECT_RATIO,
): AffineTransform {
  if (!viewBox) return { ...IDENTITY_TRANSFORM, e: viewport.x, f: viewport.y };
  if (viewport.width === 0 || viewport.height === 0 || viewBox.width === 0 || viewBox.height === 0)
    return IDENTITY_TRANSFORM;

  let scaleX = viewport.width / viewBox.width;
  let scaleY = viewport.height / viewBox.height;
  if (preserveAspectRatio.align !== "none") {
    const scale = preserveAspectRatio.meetOrSlice === "slice" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
  }

  let translateX = viewport.x - viewBox.x * scaleX;
  let translateY = viewport.y - viewBox.y * scaleY;
  if (preserveAspectRatio.align.includes("xMid")) translateX += (viewport.width - viewBox.width * scaleX) / 2;
  if (preserveAspectRatio.align.includes("xMax")) translateX += viewport.width - viewBox.width * scaleX;
  if (preserveAspectRatio.align.includes("YMid")) translateY += (viewport.height - viewBox.height * scaleY) / 2;
  if (preserveAspectRatio.align.includes("YMax")) translateY += viewport.height - viewBox.height * scaleY;

  return { a: scaleX, b: 0, c: 0, d: scaleY, e: translateX, f: translateY };
}
