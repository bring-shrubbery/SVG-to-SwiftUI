/** SVG/CSS length units retained until a consuming attribute supplies context. */
export type SVGLengthUnit =
  | ""
  | "px"
  | "%"
  | "in"
  | "cm"
  | "mm"
  | "q"
  | "pt"
  | "pc"
  | "em"
  | "ex"
  | "ch"
  | "rem"
  | "vw"
  | "vh"
  | "vmin"
  | "vmax";

export interface ParsedSVGLength {
  kind: "length";
  value: number;
  unit: SVGLengthUnit;
}

export type SVGLengthValue = ParsedSVGLength | { kind: "auto" } | { kind: "missing" };
export type LengthAxis = "horizontal" | "vertical" | "other";
export type PercentageBasis =
  | "viewport-width"
  | "viewport-height"
  | "viewport-diagonal"
  | "root-width"
  | "root-height"
  | "root-diagonal"
  | "object-bounding-box-width"
  | "object-bounding-box-height"
  | "object-bounding-box-diagonal"
  | number;

export interface LengthSize {
  width: number;
  height: number;
}

export interface LengthRect extends LengthSize {
  x: number;
  y: number;
}

export interface FontMetrics {
  /** Computed font size in current user units. */
  fontSize: number;
  /** Computed root font size in current user units. */
  rootFontSize: number;
  /** Current font x-height in current user units. */
  xHeight: number;
  /** Advance of the current font's `0` glyph in current user units. */
  zeroAdvance: number;
}

/** All coordinate spaces a length may depend on. */
export interface LengthContext {
  viewport: LengthSize;
  rootViewport: LengthSize;
  objectBoundingBox?: LengthRect;
  fontMetrics: FontMetrics;
  percentageBasis: PercentageBasis;
  axis: LengthAxis;
}

export interface ParseLengthOptions {
  allowAuto?: boolean;
}

export class SVGLengthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SVGLengthError";
    this.code = code;
  }
}

const NUMBER_SOURCE = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const NUMBER_PATTERN = new RegExp(`^${NUMBER_SOURCE}$`);
const LENGTH_PATTERN = new RegExp(`^(${NUMBER_SOURCE})(%|[a-zA-Z]+)?$`);
const SUPPORTED_UNITS = new Set<SVGLengthUnit>([
  "",
  "px",
  "%",
  "in",
  "cm",
  "mm",
  "q",
  "pt",
  "pc",
  "em",
  "ex",
  "ch",
  "rem",
  "vw",
  "vh",
  "vmin",
  "vmax",
]);

/** Parse a specification-defined plain number (for viewBox, transforms, points, and path data). */
export function parsePlainNumber(value: unknown, label = "number"): number {
  const source = String(value ?? "").trim();
  if (!NUMBER_PATTERN.test(source)) throw new SVGLengthError("invalid-number", `Invalid ${label}: ${String(value)}`);
  const parsed = Number(source);
  if (!Number.isFinite(parsed)) throw new SVGLengthError("non-finite-number", `${label} must be finite.`);
  return parsed;
}

/** Parse one SVG/CSS length without resolving away its unit. */
export function parseSVGLength(value: unknown, options: ParseLengthOptions = {}): SVGLengthValue {
  if (value === undefined || value === null || String(value).trim() === "") return { kind: "missing" };
  const source = String(value).trim();
  if (source.toLowerCase() === "auto") {
    if (!options.allowAuto) throw new SVGLengthError("auto-not-allowed", "The value auto is not allowed here.");
    return { kind: "auto" };
  }

  const match = LENGTH_PATTERN.exec(source);
  if (!match) throw new SVGLengthError("invalid-length", `Invalid SVG length: ${source}`);
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) throw new SVGLengthError("non-finite-length", `SVG length must be finite: ${source}`);
  const unit = (match[2] ?? "").toLowerCase() as SVGLengthUnit;
  if (!SUPPORTED_UNITS.has(unit))
    throw new SVGLengthError("unsupported-length-unit", `Unsupported SVG length unit: ${unit}`);
  return { kind: "length", value: numeric, unit };
}

export function normalizedViewportDiagonal(size: LengthSize): number {
  return Math.hypot(size.width, size.height) / Math.SQRT2;
}

function percentageReference(context: LengthContext): number {
  const { percentageBasis: basis } = context;
  if (typeof basis === "number") return basis;
  switch (basis) {
    case "viewport-width":
      return context.viewport.width;
    case "viewport-height":
      return context.viewport.height;
    case "viewport-diagonal":
      return normalizedViewportDiagonal(context.viewport);
    case "root-width":
      return context.rootViewport.width;
    case "root-height":
      return context.rootViewport.height;
    case "root-diagonal":
      return normalizedViewportDiagonal(context.rootViewport);
    case "object-bounding-box-width":
      if (!context.objectBoundingBox)
        throw new SVGLengthError("missing-object-bounding-box", "An object bounding box is required.");
      return context.objectBoundingBox.width;
    case "object-bounding-box-height":
      if (!context.objectBoundingBox)
        throw new SVGLengthError("missing-object-bounding-box", "An object bounding box is required.");
      return context.objectBoundingBox.height;
    case "object-bounding-box-diagonal":
      if (!context.objectBoundingBox)
        throw new SVGLengthError("missing-object-bounding-box", "An object bounding box is required.");
      return normalizedViewportDiagonal(context.objectBoundingBox);
  }
}

/** Resolve a parsed value after the consuming attribute has selected its percentage basis. */
export function resolveSVGLength(value: SVGLengthValue, context: LengthContext): number | "auto" | undefined {
  if (value.kind === "missing") return undefined;
  if (value.kind === "auto") return "auto";

  switch (value.unit) {
    case "":
    case "px":
      return value.value;
    case "%":
      return (value.value / 100) * percentageReference(context);
    case "in":
      return value.value * 96;
    case "cm":
      return (value.value * 96) / 2.54;
    case "mm":
      return (value.value * 96) / 25.4;
    case "q":
      return (value.value * 96) / 101.6;
    case "pt":
      return (value.value * 96) / 72;
    case "pc":
      return value.value * 16;
    case "em":
      return value.value * context.fontMetrics.fontSize;
    case "ex":
      return value.value * context.fontMetrics.xHeight;
    case "ch":
      return value.value * context.fontMetrics.zeroAdvance;
    case "rem":
      return value.value * context.fontMetrics.rootFontSize;
    case "vw":
      return (value.value / 100) * context.rootViewport.width;
    case "vh":
      return (value.value / 100) * context.rootViewport.height;
    case "vmin":
      return (value.value / 100) * Math.min(context.rootViewport.width, context.rootViewport.height);
    case "vmax":
      return (value.value / 100) * Math.max(context.rootViewport.width, context.rootViewport.height);
  }
}

export function defaultFontMetrics(fontSize = 16, rootFontSize = fontSize): FontMetrics {
  return {
    fontSize,
    rootFontSize,
    // These deterministic CSS fallbacks are replaced by real metrics when a text/font context supplies them.
    xHeight: fontSize / 2,
    zeroAdvance: fontSize / 2,
  };
}

export function lengthContext(
  viewport: LengthSize,
  rootViewport: LengthSize,
  percentageBasis: PercentageBasis,
  axis: LengthAxis,
  fontMetrics = defaultFontMetrics(),
  objectBoundingBox?: LengthRect,
): LengthContext {
  return {
    viewport,
    rootViewport,
    percentageBasis,
    axis,
    fontMetrics,
    ...(objectBoundingBox ? { objectBoundingBox } : {}),
  };
}
