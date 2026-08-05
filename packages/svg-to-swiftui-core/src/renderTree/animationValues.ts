import { SVGPathData } from "svg-pathdata";
import type { SVGCommand } from "svg-pathdata/lib/types";
import { parseRGBAColor, type RGBAColor } from "../colorUtils";
import { type LengthAxis, type LengthContext, parsePlainNumber, parseSVGLength, resolveSVGLength } from "../lengths";
import { parseSVGTransform } from "../transformUtils";
import { parseViewBox } from "../viewports";

export type AnimationValueFamily =
  | "number"
  | "integer"
  | "opacity"
  | "length"
  | "angle"
  | "color"
  | "number-list"
  | "length-list"
  | "points"
  | "paint"
  | "path"
  | "viewBox"
  | "transform"
  | "discrete";

export interface AnimationAttributeSpec {
  canonicalName: string;
  family: AnimationValueFamily;
  animatable: boolean;
  additive: boolean;
  axis?: LengthAxis;
  clamp?: "unit" | "nonnegative";
  namespaces: readonly ("XML" | "CSS")[];
  invalidates: readonly AnimationInvalidationCategory[];
}

export type AnimationInvalidationCategory =
  | "visibility"
  | "geometry"
  | "paint"
  | "bounds"
  | "resource"
  | "filter-buffer"
  | "text-layout"
  | "viewport";

export interface AnimationAttributeRegistryEntry extends AnimationAttributeSpec {
  targetElements: readonly string[] | "graphics" | "text" | "filter-primitives" | "any";
  runtimeBinding: "render-node" | "gradient-stop" | "pending-resource" | "pending-follow-up";
}

export interface AnimationValueContext {
  length: LengthContext;
  colorSpace?: "sRGB" | "linearRGB";
}

export interface AnimationColor extends RGBAColor {
  colorSpace: "sRGB" | "linearRGB";
}

export interface AnimationPathCommand {
  kind: "M" | "L" | "C" | "Q" | "Z";
  values: readonly number[];
}

export interface AnimationTransformComponent {
  kind: "matrix" | "translate" | "scale" | "rotate" | "skewX" | "skewY";
  values: readonly number[];
}

export type AnimateTransformType = Exclude<AnimationTransformComponent["kind"], "matrix">;

export type TypedAnimationValue =
  | { family: "number" | "integer" | "opacity" | "length" | "angle"; value: number }
  | { family: "color"; value: AnimationColor }
  | { family: "number-list" | "length-list"; values: readonly number[] }
  | { family: "points"; points: readonly { x: number; y: number }[] }
  | { family: "paint"; value: { type: "color"; color: AnimationColor } | { type: "discrete"; source: string } }
  | { family: "path"; commands: readonly AnimationPathCommand[] }
  | { family: "viewBox"; value: { x: number; y: number; width: number; height: number } }
  | { family: "transform"; components: readonly AnimationTransformComponent[] }
  | { family: "discrete"; value: string };

export interface AnimationValueSet {
  family: AnimationValueFamily;
  attribute: AnimationAttributeSpec;
  base: TypedAnimationValue;
  from?: TypedAnimationValue;
  to?: TypedAnimationValue;
  by?: TypedAnimationValue;
  values?: readonly TypedAnimationValue[];
  form: "values" | "from-to" | "from-by" | "by" | "to" | "invalid";
}

export interface CubicBezier {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AnimationCalculation {
  calcMode: "discrete" | "linear" | "paced" | "spline";
  keyTimes?: readonly number[];
  keySplines?: readonly CubicBezier[];
  keyPoints?: readonly number[];
  additive: "replace" | "sum";
  accumulate: "none" | "sum";
}

export interface AnimationValueSample {
  value: TypedAnimationValue;
  segment: number;
  segmentProgress: number;
  effectiveCalcMode: "discrete" | "linear" | "paced" | "spline";
  fallback?: "discrete-only" | "incompatible-values" | "paced-distance-undefined";
}

export interface AnimationSandwichLayer {
  values: AnimationValueSet;
  calculation: AnimationCalculation;
  progress: number;
  repeatIteration: number;
  documentOrder: number;
}

const NUMBER_SOURCE = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const NUMBER_TOKEN = new RegExp(NUMBER_SOURCE, "g");
const NUMBER_LIST = new RegExp(`^\\s*${NUMBER_SOURCE}(?:[\\s,]+${NUMBER_SOURCE})*\\s*$`);

const NUMBER_ATTRIBUTES = new Set([
  "amplitude",
  "azimuth",
  "baseFrequency",
  "bias",
  "diffuseConstant",
  "divisor",
  "elevation",
  "exponent",
  "intercept",
  "k",
  "k1",
  "k2",
  "k3",
  "k4",
  "limitingConeAngle",
  "pathLength",
  "scale",
  "slope",
  "specularConstant",
  "specularExponent",
  "surfaceScale",
]);
const INTEGER_ATTRIBUTES = new Set(["numOctaves", "order", "targetX", "targetY"]);
const OPACITY_ATTRIBUTES = new Set(["fill-opacity", "flood-opacity", "opacity", "stop-opacity", "stroke-opacity"]);
const HORIZONTAL_LENGTH_ATTRIBUTES = new Set([
  "cx",
  "dx",
  "fx",
  "markerWidth",
  "refX",
  "textLength",
  "width",
  "x",
  "x1",
  "x2",
]);
const VERTICAL_LENGTH_ATTRIBUTES = new Set(["cy", "dy", "fy", "height", "markerHeight", "refY", "y", "y1", "y2"]);
const OTHER_LENGTH_ATTRIBUTES = new Set([
  "font-size",
  "letter-spacing",
  "r",
  "rx",
  "ry",
  "startOffset",
  "stroke-dashoffset",
  "stroke-width",
  "word-spacing",
]);
const ANGLE_ATTRIBUTES = new Set(["glyph-orientation-horizontal", "glyph-orientation-vertical", "orient"]);
const COLOR_ATTRIBUTES = new Set(["color", "flood-color", "lighting-color", "stop-color"]);
const LENGTH_LIST_ATTRIBUTES = new Set(["stroke-dasharray"]);
const DISCRETE_ATTRIBUTES = new Set([
  "alignment-baseline",
  "clip-path",
  "clip-rule",
  "color-interpolation",
  "color-interpolation-filters",
  "display",
  "dominant-baseline",
  "fill-rule",
  "filter",
  "font-family",
  "font-style",
  "font-weight",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "overflow",
  "pointer-events",
  "preserveAspectRatio",
  "shape-rendering",
  "stroke-linecap",
  "stroke-linejoin",
  "text-anchor",
  "text-decoration",
  "vector-effect",
  "visibility",
]);

const GEOMETRY_ATTRIBUTES = new Set([
  "cx",
  "cy",
  "d",
  "height",
  "pathLength",
  "points",
  "r",
  "rx",
  "ry",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2",
]);
const TEXT_ATTRIBUTES = new Set([
  "alignment-baseline",
  "dominant-baseline",
  "dx",
  "dy",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "glyph-orientation-horizontal",
  "glyph-orientation-vertical",
  "letter-spacing",
  "rotate",
  "startOffset",
  "text-anchor",
  "text-decoration",
  "textLength",
  "word-spacing",
  "x",
  "y",
]);
const FILTER_ATTRIBUTES = new Set([
  ...NUMBER_ATTRIBUTES,
  ...INTEGER_ATTRIBUTES,
  "flood-color",
  "flood-opacity",
  "lighting-color",
  "values",
]);
const PAINT_ATTRIBUTES = new Set([
  "color",
  "fill",
  "fill-opacity",
  "fill-rule",
  "flood-color",
  "flood-opacity",
  "lighting-color",
  "opacity",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
]);
const RESOURCE_ATTRIBUTES = new Set(["clip-path", "filter", "marker-end", "marker-mid", "marker-start", "mask"]);
const CSS_ONLY_ATTRIBUTES = new Set(["mix-blend-mode", "isolation"]);
const XML_ONLY_ATTRIBUTES = new Set(["viewBox", "preserveAspectRatio"]);
const ANIMATE_SET_RENDER_ATTRIBUTES = new Set([
  "color",
  "cx",
  "cy",
  "d",
  "display",
  "dx",
  "dy",
  "fill",
  "fill-opacity",
  "font-size",
  "height",
  "letter-spacing",
  "opacity",
  "points",
  "preserveAspectRatio",
  "r",
  "rx",
  "ry",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "viewBox",
  "visibility",
  "width",
  "word-spacing",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2",
]);
const GRADIENT_STOP_ATTRIBUTES = new Set(["offset", "stop-color", "stop-opacity"]);

function registryEntry(
  canonicalName: string,
  family: AnimationValueFamily,
  additive: boolean,
  options: Pick<AnimationAttributeSpec, "axis" | "clamp"> = {},
): AnimationAttributeRegistryEntry {
  const invalidates = new Set<AnimationInvalidationCategory>();
  if (canonicalName === "display" || canonicalName === "visibility") invalidates.add("visibility");
  if (GEOMETRY_ATTRIBUTES.has(canonicalName)) {
    invalidates.add("geometry");
    invalidates.add("bounds");
  }
  if (TEXT_ATTRIBUTES.has(canonicalName)) {
    invalidates.add("text-layout");
    invalidates.add("bounds");
  }
  if (PAINT_ATTRIBUTES.has(canonicalName)) invalidates.add("paint");
  if (RESOURCE_ATTRIBUTES.has(canonicalName)) invalidates.add("resource");
  if (FILTER_ATTRIBUTES.has(canonicalName) || canonicalName === "filter") invalidates.add("filter-buffer");
  if (canonicalName === "viewBox" || canonicalName === "preserveAspectRatio") {
    invalidates.add("viewport");
    invalidates.add("geometry");
    invalidates.add("bounds");
  }
  if (invalidates.size === 0) invalidates.add("paint");
  return {
    canonicalName,
    family,
    animatable: true,
    additive,
    namespaces: CSS_ONLY_ATTRIBUTES.has(canonicalName)
      ? ["CSS"]
      : XML_ONLY_ATTRIBUTES.has(canonicalName)
        ? ["XML"]
        : ["XML", "CSS"],
    invalidates: [...invalidates],
    targetElements: GRADIENT_STOP_ATTRIBUTES.has(canonicalName)
      ? ["stop"]
      : FILTER_ATTRIBUTES.has(canonicalName)
        ? "filter-primitives"
        : TEXT_ATTRIBUTES.has(canonicalName)
          ? "any"
          : canonicalName === "viewBox" || canonicalName === "preserveAspectRatio"
            ? ["svg", "symbol", "view", "marker", "pattern"]
            : "any",
    runtimeBinding: ANIMATE_SET_RENDER_ATTRIBUTES.has(canonicalName)
      ? "render-node"
      : GRADIENT_STOP_ATTRIBUTES.has(canonicalName)
        ? "gradient-stop"
        : FILTER_ATTRIBUTES.has(canonicalName) || RESOURCE_ATTRIBUTES.has(canonicalName)
          ? "pending-resource"
          : "pending-follow-up",
    ...options,
  };
}

const registry = new Map<string, AnimationAttributeRegistryEntry>();
const register = (
  names: Iterable<string>,
  family: AnimationValueFamily,
  additive: boolean,
  options: (name: string) => Pick<AnimationAttributeSpec, "axis" | "clamp"> = () => ({}),
) => {
  for (const name of names) registry.set(name, registryEntry(name, family, additive, options(name)));
};
register(NUMBER_ATTRIBUTES, "number", true);
register(INTEGER_ATTRIBUTES, "integer", true);
register(OPACITY_ATTRIBUTES, "opacity", true, () => ({ clamp: "unit" }));
register(HORIZONTAL_LENGTH_ATTRIBUTES, "length", true, () => ({ axis: "horizontal" }));
register(VERTICAL_LENGTH_ATTRIBUTES, "length", true, () => ({ axis: "vertical" }));
register(OTHER_LENGTH_ATTRIBUTES, "length", true, (name) => ({
  axis: "other",
  ...(["r", "rx", "ry", "stroke-width"].includes(name) ? { clamp: "nonnegative" as const } : {}),
}));
register(ANGLE_ATTRIBUTES, "angle", true);
register(COLOR_ATTRIBUTES, "color", true);
register(LENGTH_LIST_ATTRIBUTES, "length-list", true, () => ({ axis: "other" }));
register(DISCRETE_ATTRIBUTES, "discrete", false);
registry.set("stroke-miterlimit", registryEntry("stroke-miterlimit", "number", true, { clamp: "nonnegative" }));
registry.set("offset", registryEntry("offset", "opacity", true, { clamp: "unit" }));
registry.set("points", registryEntry("points", "points", true));
registry.set("d", registryEntry("d", "path", false));
registry.set("viewBox", registryEntry("viewBox", "viewBox", true));
registry.set("transform", registryEntry("transform", "transform", true));
registry.set("fill", registryEntry("fill", "paint", true));
registry.set("stroke", registryEntry("stroke", "paint", true));
registry.set("values", registryEntry("values", "number-list", true));
registry.set("keyPoints", registryEntry("keyPoints", "number-list", true));
registry.set("rotate", registryEntry("rotate", "number-list", true));

/** Machine-readable registry shared by SMIL, CSS animation, code generation, and conformance reporting. */
export const ANIMATION_ATTRIBUTE_REGISTRY: readonly AnimationAttributeRegistryEntry[] = [...registry.values()].sort(
  (left, right) => left.canonicalName.localeCompare(right.canonicalName),
);

/** Unknown properties are never guessed or normalized by accidental casing. */
export function animationAttributeSpec(attributeName: string): AnimationAttributeSpec | undefined {
  return registry.get(attributeName);
}

export function resolveAnimationAttribute(
  attributeName: string,
  attributeType: "auto" | "XML" | "CSS" = "auto",
): AnimationAttributeRegistryEntry | undefined {
  const spec = registry.get(attributeName);
  if (!spec) return undefined;
  return attributeType === "auto" || spec.namespaces.includes(attributeType) ? spec : undefined;
}

function numbers(source: string): number[] | undefined {
  if (!NUMBER_LIST.test(source)) return undefined;
  const result = [...source.matchAll(NUMBER_TOKEN)].map((match) => Number(match[0]));
  return result.length > 0 && result.every(Number.isFinite) ? result : undefined;
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

function animationColor(source: string, colorSpace: "sRGB" | "linearRGB"): AnimationColor | undefined {
  const parsed = parseRGBAColor(source);
  if (!parsed) return undefined;
  return colorSpace === "sRGB"
    ? { ...parsed, colorSpace }
    : {
        red: srgbToLinear(parsed.red),
        green: srgbToLinear(parsed.green),
        blue: srgbToLinear(parsed.blue),
        alpha: parsed.alpha,
        colorSpace,
      };
}

function parseAngle(source: string): number | undefined {
  const match = new RegExp(`^(${NUMBER_SOURCE})(deg|grad|rad|turn)?$`, "i").exec(source.trim());
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  switch (match[2]?.toLowerCase()) {
    case "grad":
      return value * 0.9;
    case "rad":
      return (value * 180) / Math.PI;
    case "turn":
      return value * 360;
    default:
      return value;
  }
}

function parseLength(source: string, context: AnimationValueContext, axis?: LengthAxis): number | undefined {
  try {
    const parsed = parseSVGLength(source);
    const effectiveAxis = axis ?? context.length.axis;
    const value = resolveSVGLength(parsed, {
      ...context.length,
      axis: effectiveAxis,
      percentageBasis:
        effectiveAxis === "horizontal"
          ? "viewport-width"
          : effectiveAxis === "vertical"
            ? "viewport-height"
            : "viewport-diagonal",
    });
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function parsePath(source: string): AnimationPathCommand[] | undefined {
  try {
    const commands = new SVGPathData(source).toAbs().normalizeHVZ(false, true, true).normalizeST().aToC()
      .commands as SVGCommand[];
    return commands.map((command) => {
      switch (command.type) {
        case SVGPathData.MOVE_TO:
          return { kind: "M", values: [command.x, command.y] };
        case SVGPathData.LINE_TO:
          return { kind: "L", values: [command.x, command.y] };
        case SVGPathData.CURVE_TO:
          return { kind: "C", values: [command.x1, command.y1, command.x2, command.y2, command.x, command.y] };
        case SVGPathData.QUAD_TO:
          return { kind: "Q", values: [command.x1, command.y1, command.x, command.y] };
        case SVGPathData.CLOSE_PATH:
          return { kind: "Z", values: [] };
        default:
          throw new Error("Path normalization left an unsupported command");
      }
    });
  } catch {
    return undefined;
  }
}

function parseTransforms(source: string, context?: AnimationValueContext): AnimationTransformComponent[] | undefined {
  if (source.trim().toLowerCase() === "none") return [];
  const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  const components: AnimationTransformComponent[] = [];
  let last = 0;
  let svgSyntax = true;
  try {
    parseSVGTransform(source);
  } catch {
    svgSyntax = false;
  }
  for (const match of source.matchAll(pattern)) {
    if (!/^[\s,]*$/.test(source.slice(last, match.index))) return undefined;
    const rawKind = match[1]!.toLowerCase();
    if (svgSyntax) {
      const kind = rawKind === "skewx" ? "skewX" : rawKind === "skewy" ? "skewY" : rawKind;
      components.push({ kind: kind as AnimationTransformComponent["kind"], values: numbers(match[2]!) ?? [] });
    } else {
      if (!context) return undefined;
      const tokens = match[2]!
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      const lengths = (axes: LengthAxis[]) =>
        tokens.map((token, index) => parseLength(token, context, axes[Math.min(index, axes.length - 1)]));
      const plain = tokens.map((token) => {
        try {
          return parsePlainNumber(token, "CSS transform number");
        } catch {
          return undefined;
        }
      });
      if (rawKind === "translate" || rawKind === "translatex" || rawKind === "translatey") {
        const parsed = lengths(rawKind === "translatey" ? ["vertical"] : ["horizontal", "vertical"]);
        if (parsed.some((value) => value === undefined) || parsed.length < 1 || parsed.length > 2) return undefined;
        components.push({
          kind: "translate",
          values:
            rawKind === "translatex"
              ? [parsed[0]!, 0]
              : rawKind === "translatey"
                ? [0, parsed[0]!]
                : (parsed as number[]),
        });
      } else if (["scale", "scalex", "scaley"].includes(rawKind)) {
        if (plain.some((value) => value === undefined) || plain.length < 1 || plain.length > 2) return undefined;
        const first = plain[0]!;
        components.push({
          kind: "scale",
          values: rawKind === "scalex" ? [first, 1] : rawKind === "scaley" ? [1, first] : [first, plain[1] ?? first],
        });
      } else if (rawKind === "rotate") {
        const angle = tokens.length === 1 ? parseAngle(tokens[0]!) : undefined;
        if (angle === undefined) return undefined;
        components.push({ kind: "rotate", values: [angle] });
      } else if (rawKind === "skewx" || rawKind === "skewy") {
        const angle = tokens.length === 1 ? parseAngle(tokens[0]!) : undefined;
        if (angle === undefined) return undefined;
        components.push({ kind: rawKind === "skewx" ? "skewX" : "skewY", values: [angle] });
      } else if (rawKind === "matrix") {
        if (plain.length !== 6 || plain.some((value) => value === undefined)) return undefined;
        components.push({ kind: "matrix", values: plain as number[] });
      } else return undefined;
    }
    last = (match.index ?? 0) + match[0].length;
  }
  return components.length > 0 && /^[\s,]*$/.test(source.slice(last)) ? components : undefined;
}

function transformComponent(type: AnimateTransformType, source: string, context: AnimationValueContext) {
  const tokens = source
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const parsed = tokens.map((token, index) => {
    if (type === "translate") return parseLength(token, context, index === 0 ? "horizontal" : "vertical");
    if (type === "rotate" && index > 0) return parseLength(token, context, index === 1 ? "horizontal" : "vertical");
    if (type === "rotate" || type === "skewX" || type === "skewY") return parseAngle(token);
    try {
      return parsePlainNumber(token, `animateTransform ${type}`);
    } catch {
      return undefined;
    }
  });
  if (parsed.some((value) => value === undefined)) return undefined;
  const values = parsed as number[];
  switch (type) {
    case "translate":
      if (values.length !== 1 && values.length !== 2) return undefined;
      return { kind: type, values: [values[0]!, values[1] ?? 0] } as const;
    case "scale":
      if (values.length !== 1 && values.length !== 2) return undefined;
      return { kind: type, values: [values[0]!, values[1] ?? values[0]!] } as const;
    case "rotate":
      if (values.length !== 1 && values.length !== 3) return undefined;
      return { kind: type, values: [values[0]!, values[1] ?? 0, values[2] ?? 0] } as const;
    case "skewX":
    case "skewY":
      return values.length === 1 ? ({ kind: type, values } as const) : undefined;
  }
}

/** Parse one bare animateTransform value using the grammar selected by its type attribute. */
export function parseAnimateTransformValue(
  type: AnimateTransformType,
  source: string,
  context: AnimationValueContext,
): TypedAnimationValue | undefined {
  const component = transformComponent(type, source, context);
  return component ? { family: "transform", components: [component] } : undefined;
}

function neutralAnimateTransformValue(type: AnimateTransformType): TypedAnimationValue {
  const values = type === "rotate" ? [0, 0, 0] : type === "translate" || type === "scale" ? [0, 0] : [0];
  return { family: "transform", components: [{ kind: type, values }] };
}

/** Build a typed animateTransform value set while retaining the target's full base transform list. */
export function parseAnimateTransformValueSet(
  type: AnimateTransformType,
  raw: { base?: string; from?: string; to?: string; by?: string; values?: readonly string[] },
  context: AnimationValueContext,
): AnimationValueSet | undefined {
  const attribute = animationAttributeSpec("transform")!;
  const base = raw.base ? parseAnimationValue(attribute, raw.base, context) : undefined;
  const effectiveBase =
    base ??
    ({
      family: "transform",
      components: [{ kind: "matrix", values: [1, 0, 0, 1, 0, 0] }],
    } as const);
  const parse = (value: string | undefined) =>
    value === undefined ? undefined : parseAnimateTransformValue(type, value, context);
  const from = parse(raw.from);
  const to = parse(raw.to);
  const by = parse(raw.by);
  const values = raw.values?.map((value) => parse(value));
  if ((raw.from !== undefined && !from) || (raw.to !== undefined && !to) || (raw.by !== undefined && !by))
    return undefined;
  if (values?.some((value) => !value)) return undefined;
  const neutral = neutralAnimateTransformValue(type);
  const form = values
    ? "values"
    : from && to
      ? "from-to"
      : from && by
        ? "from-by"
        : to
          ? "from-to"
          : by
            ? "by"
            : "invalid";
  return {
    family: "transform",
    attribute,
    base: effectiveBase,
    ...(from ? { from } : to ? { from: neutral } : {}),
    ...(to ? { to } : {}),
    ...(by ? { by } : {}),
    ...(values ? { values: values as TypedAnimationValue[] } : {}),
    form,
  };
}

export function parseAnimationValue(
  spec: AnimationAttributeSpec,
  source: string,
  context: AnimationValueContext,
): TypedAnimationValue | undefined {
  const raw = source.trim();
  if (raw === "") return undefined;
  switch (spec.family) {
    case "number": {
      try {
        return { family: "number", value: parsePlainNumber(raw, "animation number") };
      } catch {
        return undefined;
      }
    }
    case "integer": {
      try {
        const value = parsePlainNumber(raw, "animation integer");
        return Number.isInteger(value) ? { family: "integer", value } : undefined;
      } catch {
        return undefined;
      }
    }
    case "opacity": {
      try {
        return {
          family: "opacity",
          value: raw.endsWith("%")
            ? parsePlainNumber(raw.slice(0, -1), "animation percentage") / 100
            : parsePlainNumber(raw, "animation opacity"),
        };
      } catch {
        return undefined;
      }
    }
    case "length": {
      if (raw.toLowerCase() === "auto") return { family: "discrete", value: "auto" };
      const value = parseLength(raw, context, spec.axis);
      return value === undefined ? undefined : { family: "length", value };
    }
    case "angle": {
      if (["auto", "auto-start-reverse"].includes(raw.toLowerCase()))
        return { family: "discrete", value: raw.toLowerCase() };
      const value = parseAngle(raw);
      return value === undefined ? undefined : { family: "angle", value };
    }
    case "color": {
      const value = animationColor(raw, context.colorSpace ?? "sRGB");
      return value ? { family: "color", value } : undefined;
    }
    case "number-list": {
      const values = numbers(raw);
      return values ? { family: "number-list", values } : undefined;
    }
    case "length-list": {
      if (raw.toLowerCase() === "none") return { family: "length-list", values: [] };
      const tokens = raw.split(/[\s,]+/).filter(Boolean);
      const values = tokens.map((token) => parseLength(token, context, spec.axis));
      return values.every((value) => value !== undefined)
        ? { family: "length-list", values: values as number[] }
        : undefined;
    }
    case "points": {
      const values = numbers(raw);
      if (!values || values.length % 2 !== 0) return undefined;
      return {
        family: "points",
        points: Array.from({ length: values.length / 2 }, (_, index) => ({
          x: values[index * 2]!,
          y: values[index * 2 + 1]!,
        })),
      };
    }
    case "paint": {
      const color = animationColor(raw, context.colorSpace ?? "sRGB");
      return {
        family: "paint",
        value: color ? { type: "color", color } : { type: "discrete", source: raw },
      };
    }
    case "path": {
      const commands = parsePath(raw);
      return commands ? { family: "path", commands } : undefined;
    }
    case "viewBox": {
      try {
        const value = parseViewBox(raw);
        return value ? { family: "viewBox", value } : undefined;
      } catch {
        return undefined;
      }
    }
    case "transform": {
      const components = parseTransforms(raw, context);
      return components ? { family: "transform", components } : undefined;
    }
    case "discrete":
      return { family: "discrete", value: raw };
  }
}

export function parseAnimationValueSet(
  attributeName: string,
  raw: { base?: string; from?: string; to?: string; by?: string; values?: readonly string[] },
  context: AnimationValueContext,
): AnimationValueSet | undefined {
  const attribute = animationAttributeSpec(attributeName);
  if (!attribute?.animatable || raw.base === undefined) return undefined;
  const parse = (value: string | undefined) =>
    value === undefined ? undefined : parseAnimationValue(attribute, value, context);
  const base = parse(raw.base);
  const from = parse(raw.from);
  const to = parse(raw.to);
  const by = parse(raw.by);
  const values = raw.values?.map((value) => parse(value));
  if (!base || (raw.from !== undefined && !from) || (raw.to !== undefined && !to) || (raw.by !== undefined && !by))
    return undefined;
  if (values?.some((value) => !value)) return undefined;
  const form = values ? "values" : from && to ? "from-to" : from && by ? "from-by" : to ? "to" : by ? "by" : "invalid";
  return {
    family: attribute.family,
    attribute,
    base,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(by ? { by } : {}),
    ...(values ? { values: values as TypedAnimationValue[] } : {}),
    form,
  };
}

function sameFamily(left: TypedAnimationValue, right: TypedAnimationValue): boolean {
  return left.family === right.family;
}

function vectors(value: TypedAnimationValue): number[] | undefined {
  switch (value.family) {
    case "number":
    case "integer":
    case "opacity":
    case "length":
    case "angle":
      return [value.value];
    case "color":
      return [value.value.red, value.value.green, value.value.blue, value.value.alpha];
    case "number-list":
    case "length-list":
      return [...value.values];
    case "points":
      return value.points.flatMap((point) => [point.x, point.y]);
    case "viewBox":
      return [value.value.x, value.value.y, value.value.width, value.value.height];
    case "transform":
      return value.components.flatMap((component) => [...component.values]);
    default:
      return undefined;
  }
}

function compatible(left: TypedAnimationValue, right: TypedAnimationValue): boolean {
  if (!sameFamily(left, right)) return false;
  const leftVector = vectors(left);
  const rightVector = vectors(right);
  if (leftVector || rightVector) {
    if (left.family === "transform" && right.family === "transform")
      return (
        left.components.length === right.components.length &&
        left.components.every(
          (component, index) =>
            component.kind === right.components[index]!.kind &&
            component.values.length === right.components[index]!.values.length,
        )
      );
    return leftVector?.length === rightVector?.length;
  }
  if (left.family === "paint" && right.family === "paint")
    return left.value.type === "color" && right.value.type === "color";
  if (left.family === "path" && right.family === "path")
    return (
      left.commands.length === right.commands.length &&
      left.commands.every(
        (command, index) =>
          command.kind === right.commands[index]!.kind &&
          command.values.length === right.commands[index]!.values.length,
      )
    );
  return false;
}

function fromVector(template: TypedAnimationValue, values: readonly number[]): TypedAnimationValue {
  switch (template.family) {
    case "number":
    case "integer":
    case "opacity":
    case "length":
    case "angle":
      return { family: template.family, value: values[0]! };
    case "color":
      return {
        family: "color",
        value: {
          red: values[0]!,
          green: values[1]!,
          blue: values[2]!,
          alpha: values[3]!,
          colorSpace: template.value.colorSpace,
        },
      };
    case "number-list":
    case "length-list":
      return { family: template.family, values };
    case "points":
      return {
        family: "points",
        points: Array.from({ length: values.length / 2 }, (_, index) => ({
          x: values[index * 2]!,
          y: values[index * 2 + 1]!,
        })),
      };
    case "viewBox":
      return { family: "viewBox", value: { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! } };
    case "transform": {
      let offset = 0;
      return {
        family: "transform",
        components: template.components.map((component) => {
          const result = { ...component, values: values.slice(offset, offset + component.values.length) };
          offset += component.values.length;
          return result;
        }),
      };
    }
    default:
      return template;
  }
}

export function animationValuesEqual(left: TypedAnimationValue, right: TypedAnimationValue, epsilon = 1e-12): boolean {
  if (!sameFamily(left, right)) return false;
  if (left.family === "transform" && right.family === "transform" && !compatible(left, right)) return false;
  const leftVector = vectors(left);
  const rightVector = vectors(right);
  if (leftVector && rightVector)
    return (
      leftVector.length === rightVector.length &&
      leftVector.every((value, index) => Math.abs(value - rightVector[index]!) <= epsilon)
    );
  return serializeAnimationValue(left) === serializeAnimationValue(right);
}

export function interpolateAnimationValue(
  left: TypedAnimationValue,
  right: TypedAnimationValue,
  progress: number,
): TypedAnimationValue | undefined {
  if (!compatible(left, right)) return undefined;
  const amount = Number.isFinite(progress) ? progress : 0;
  const leftVector = vectors(left);
  const rightVector = vectors(right);
  if (leftVector && rightVector)
    return fromVector(
      left,
      leftVector.map((value, index) => value + (rightVector[index]! - value) * amount),
    );
  if (
    left.family === "paint" &&
    right.family === "paint" &&
    left.value.type === "color" &&
    right.value.type === "color"
  ) {
    const value = interpolateAnimationValue(
      { family: "color", value: left.value.color },
      { family: "color", value: right.value.color },
      amount,
    ) as Extract<TypedAnimationValue, { family: "color" }>;
    return { family: "paint", value: { type: "color", color: value.value } };
  }
  if (left.family === "path" && right.family === "path")
    return {
      family: "path",
      commands: left.commands.map((command, index) => ({
        kind: command.kind,
        values: command.values.map(
          (value, valueIndex) => value + (right.commands[index]!.values[valueIndex]! - value) * amount,
        ),
      })),
    };
  return undefined;
}

export function animationValueDistance(left: TypedAnimationValue, right: TypedAnimationValue): number | undefined {
  if (!compatible(left, right)) return undefined;
  const leftVector = vectors(left);
  const rightVector = vectors(right);
  if (leftVector && rightVector) return Math.hypot(...leftVector.map((value, index) => rightVector[index]! - value));
  if (
    left.family === "paint" &&
    right.family === "paint" &&
    left.value.type === "color" &&
    right.value.type === "color"
  )
    return animationValueDistance(
      { family: "color", value: left.value.color },
      { family: "color", value: right.value.color },
    );
  if (left.family === "path" && right.family === "path") {
    const differences = left.commands.flatMap((command, index) =>
      command.values.map((value, valueIndex) => right.commands[index]!.values[valueIndex]! - value),
    );
    return Math.hypot(...differences);
  }
  return undefined;
}

export function addAnimationValues(
  left: TypedAnimationValue,
  right: TypedAnimationValue,
): TypedAnimationValue | undefined {
  if (!compatible(left, right)) return undefined;
  const leftVector = vectors(left);
  const rightVector = vectors(right);
  if (leftVector && rightVector)
    return fromVector(
      left,
      leftVector.map((value, index) => value + rightVector[index]!),
    );
  if (
    left.family === "paint" &&
    right.family === "paint" &&
    left.value.type === "color" &&
    right.value.type === "color"
  ) {
    const value = addAnimationValues(
      { family: "color", value: left.value.color },
      { family: "color", value: right.value.color },
    ) as Extract<TypedAnimationValue, { family: "color" }>;
    return { family: "paint", value: { type: "color", color: value.value } };
  }
  return undefined;
}

function scaleAnimationValue(value: TypedAnimationValue, amount: number): TypedAnimationValue | undefined {
  const vector = vectors(value);
  if (vector)
    return fromVector(
      value,
      vector.map((component) => component * amount),
    );
  if (value.family === "paint" && value.value.type === "color") {
    const scaled = scaleAnimationValue({ family: "color", value: value.value.color }, amount) as Extract<
      TypedAnimationValue,
      { family: "color" }
    >;
    return { family: "paint", value: { type: "color", color: scaled.value } };
  }
  return undefined;
}

function zeroAnimationValue(value: TypedAnimationValue): TypedAnimationValue | undefined {
  return scaleAnimationValue(value, 0);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeAnimationValue(
  value: TypedAnimationValue,
  spec?: AnimationAttributeSpec,
): TypedAnimationValue {
  if (value.family === "integer") return { ...value, value: Math.floor(value.value + 0.5) };
  if (value.family === "opacity") return { ...value, value: clamp(value.value, 0, 1) };
  if ((value.family === "length" || value.family === "number") && spec?.clamp === "nonnegative")
    return { ...value, value: Math.max(0, value.value) };
  if (value.family === "color")
    return {
      family: "color",
      value: {
        ...value.value,
        red: clamp(value.value.red, 0, 1),
        green: clamp(value.value.green, 0, 1),
        blue: clamp(value.value.blue, 0, 1),
        alpha: clamp(value.value.alpha, 0, 1),
      },
    };
  if (value.family === "paint" && value.value.type === "color") {
    const normalized = normalizeAnimationValue({ family: "color", value: value.value.color }) as Extract<
      TypedAnimationValue,
      { family: "color" }
    >;
    return { family: "paint", value: { type: "color", color: normalized.value } };
  }
  return value;
}

export function parseKeyTimes(source: string | undefined): number[] | undefined {
  if (source === undefined) return undefined;
  const result = source.split(";").map((value) => Number(value.trim()));
  return result.length > 0 && result.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    ? result
    : undefined;
}

export function parseKeySplines(source: string | undefined): CubicBezier[] | undefined {
  if (source === undefined) return undefined;
  const result = source.split(";").map((entry) => numbers(entry));
  if (
    result.length === 0 ||
    result.some((values) => !values || values.length !== 4 || values.some((value) => value < 0 || value > 1))
  )
    return undefined;
  return result.map((values) => ({ x1: values![0]!, y1: values![1]!, x2: values![2]!, y2: values![3]! }));
}

export function validateAnimationCalculation(
  valueCount: number,
  calculation: Pick<AnimationCalculation, "calcMode" | "keyTimes" | "keySplines">,
): string[] {
  const errors: string[] = [];
  const keyTimes = calculation.keyTimes;
  if (keyTimes && calculation.calcMode !== "paced") {
    if (keyTimes.length !== valueCount) errors.push("keyTimes-count");
    if (keyTimes[0] !== 0) errors.push("keyTimes-start");
    if (keyTimes.some((value, index) => index > 0 && value < keyTimes[index - 1]!)) errors.push("keyTimes-order");
    if (calculation.calcMode !== "discrete" && keyTimes[keyTimes.length - 1] !== 1) errors.push("keyTimes-end");
  }
  if (calculation.calcMode === "spline") {
    if (!calculation.keySplines) errors.push("keySplines-missing");
    else if (calculation.keySplines.length !== Math.max(0, valueCount - 1)) errors.push("keySplines-count");
  }
  return [...new Set(errors)];
}

function cubic(coordinate1: number, coordinate2: number, time: number): number {
  const inverse = 1 - time;
  return 3 * inverse * inverse * time * coordinate1 + 3 * inverse * time * time * coordinate2 + time ** 3;
}

function cubicDerivative(coordinate1: number, coordinate2: number, time: number): number {
  const inverse = 1 - time;
  return (
    3 * inverse * inverse * coordinate1 +
    6 * inverse * time * (coordinate2 - coordinate1) +
    3 * time * time * (1 - coordinate2)
  );
}

/** Invert cubic Bézier x with bounded Newton steps followed by deterministic bisection. */
export function cubicBezierProgress(progress: number, spline: CubicBezier): number {
  const target = clamp(progress, 0, 1);
  if (target === 0 || target === 1) return target;
  let parameter = target;
  for (let iteration = 0; iteration < 8; iteration++) {
    const error = cubic(spline.x1, spline.x2, parameter) - target;
    if (Math.abs(error) <= 1e-9) return cubic(spline.y1, spline.y2, parameter);
    const derivative = cubicDerivative(spline.x1, spline.x2, parameter);
    if (Math.abs(derivative) < 1e-8) break;
    const next = parameter - error / derivative;
    if (next <= 0 || next >= 1) break;
    parameter = next;
  }
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 32; iteration++) {
    parameter = (lower + upper) / 2;
    if (cubic(spline.x1, spline.x2, parameter) < target) lower = parameter;
    else upper = parameter;
  }
  return cubic(spline.y1, spline.y2, (lower + upper) / 2);
}

function effectiveValues(set: AnimationValueSet, underlying: TypedAnimationValue): TypedAnimationValue[] | undefined {
  switch (set.form) {
    case "values":
      return set.values ? [...set.values] : undefined;
    case "from-to":
      return set.from && set.to ? [set.from, set.to] : undefined;
    case "from-by": {
      const end = set.from && set.by ? addAnimationValues(set.from, set.by) : undefined;
      return set.from && end ? [set.from, end] : undefined;
    }
    case "by": {
      const zero = set.by ? zeroAnimationValue(set.by) : undefined;
      return zero && set.by ? [zero, set.by] : undefined;
    }
    case "to":
      return set.to ? [underlying, set.to] : undefined;
    case "invalid":
      return undefined;
  }
}

function segmentForProgress(
  values: readonly TypedAnimationValue[],
  progress: number,
  calculation: AnimationCalculation,
): {
  segment: number;
  progress: number;
  mode: AnimationValueSample["effectiveCalcMode"];
  fallback?: AnimationValueSample["fallback"];
} {
  const input = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const discreteOnly = !values.every((value, index) => index === 0 || compatible(values[index - 1]!, value));
  let mode = discreteOnly ? "discrete" : calculation.calcMode;
  let fallback: AnimationValueSample["fallback"] = discreteOnly ? "incompatible-values" : undefined;
  if (values[0]!.family === "discrete") {
    mode = "discrete";
    fallback = "discrete-only";
  }
  if (mode === "discrete") {
    if (calculation.keyTimes?.length === values.length) {
      let index = 0;
      for (let candidate = 1; candidate < values.length; candidate++) {
        if (input + 1e-12 >= calculation.keyTimes[candidate]!) index = candidate;
      }
      return { segment: Math.min(values.length - 1, index), progress: 0, mode, ...(fallback ? { fallback } : {}) };
    }
    return {
      segment: Math.min(values.length - 1, Math.floor(input * values.length + 1e-12)),
      progress: 0,
      mode,
      ...(fallback ? { fallback } : {}),
    };
  }
  let times: number[];
  if (mode === "paced") {
    const distances = values.slice(1).map((value, index) => animationValueDistance(values[index]!, value));
    const numericDistances = distances.every((distance): distance is number => distance !== undefined)
      ? distances
      : undefined;
    if (!numericDistances || numericDistances.reduce<number>((sum, value) => sum + value, 0) <= 0) {
      mode = "linear";
      fallback = "paced-distance-undefined";
      times = Array.from({ length: values.length }, (_, index) => index / (values.length - 1));
    } else {
      const total = numericDistances.reduce<number>((sum, value) => sum + value, 0);
      let elapsed = 0;
      times = [0, ...numericDistances.map((distance) => (elapsed += distance) / total)];
    }
  } else {
    times =
      calculation.keyTimes?.length === values.length
        ? [...calculation.keyTimes]
        : Array.from({ length: values.length }, (_, index) => index / (values.length - 1));
  }
  if (input >= 1) return { segment: values.length - 2, progress: 1, mode, ...(fallback ? { fallback } : {}) };
  let segment = 0;
  while (segment + 1 < times.length - 1 && input >= times[segment + 1]! - 1e-12) segment++;
  const start = times[segment]!;
  const end = times[segment + 1]!;
  let local = end <= start ? 1 : clamp((input - start) / (end - start), 0, 1);
  if (mode === "spline" && calculation.keySplines?.[segment])
    local = cubicBezierProgress(local, calculation.keySplines[segment]!);
  return { segment, progress: local, mode, ...(fallback ? { fallback } : {}) };
}

export function sampleAnimationValue(
  set: AnimationValueSet,
  calculation: AnimationCalculation,
  progress: number,
  repeatIteration = 0,
  underlying: TypedAnimationValue = set.base,
): AnimationValueSample | undefined {
  const values = effectiveValues(set, underlying);
  if (!values || values.length === 0) return undefined;
  if (values.length === 1)
    return {
      value: normalizeAnimationValue(values[0]!, set.attribute),
      segment: 0,
      segmentProgress: 0,
      effectiveCalcMode: "discrete",
    };
  const selected = segmentForProgress(values, progress, calculation);
  const left = values[selected.segment]!;
  const right = values[Math.min(values.length - 1, selected.segment + 1)]!;
  let effect = selected.mode === "discrete" ? left : interpolateAnimationValue(left, right, selected.progress);
  if (!effect) effect = left;
  if (calculation.accumulate === "sum" && repeatIteration > 0 && set.attribute.additive) {
    const accumulated = scaleAnimationValue(values[values.length - 1]!, repeatIteration);
    if (accumulated) effect = addAnimationValues(effect, accumulated) ?? effect;
  }
  const additive = set.form === "by" || (set.form !== "to" && calculation.additive === "sum");
  if (additive && set.attribute.additive) {
    effect =
      underlying.family === "transform" && effect.family === "transform"
        ? { family: "transform", components: [...underlying.components, ...effect.components] }
        : (addAnimationValues(underlying, effect) ?? effect);
  }
  return {
    value: normalizeAnimationValue(effect, set.attribute),
    segment: selected.segment,
    segmentProgress: selected.progress,
    effectiveCalcMode: selected.mode,
    ...(selected.fallback ? { fallback: selected.fallback } : {}),
  };
}

/** Apply lower-priority animations first; document order breaks equal-priority ties. */
export function composeAnimationSandwich(
  base: TypedAnimationValue,
  layers: readonly AnimationSandwichLayer[],
): TypedAnimationValue {
  let underlying = base;
  for (const layer of [...layers].sort((left, right) => left.documentOrder - right.documentOrder)) {
    const sample = sampleAnimationValue(
      layer.values,
      layer.calculation,
      layer.progress,
      layer.repeatIteration,
      underlying,
    );
    if (sample) underlying = sample.value;
  }
  return underlying;
}

function format(value: number, precision: number): string {
  const rounded = Number(value.toFixed(precision));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function serializeAnimationValue(value: TypedAnimationValue, precision = 10): string {
  const normalized = normalizeAnimationValue(value);
  switch (normalized.family) {
    case "number":
    case "integer":
    case "opacity":
    case "length":
      return format(normalized.value, precision);
    case "angle":
      return `${format(normalized.value, precision)}deg`;
    case "color": {
      const color =
        normalized.value.colorSpace === "linearRGB"
          ? {
              ...normalized.value,
              red: linearToSrgb(normalized.value.red),
              green: linearToSrgb(normalized.value.green),
              blue: linearToSrgb(normalized.value.blue),
            }
          : normalized.value;
      return `rgba(${format(clamp(color.red, 0, 1) * 255, precision)} ${format(clamp(color.green, 0, 1) * 255, precision)} ${format(clamp(color.blue, 0, 1) * 255, precision)} / ${format(clamp(color.alpha, 0, 1), precision)})`;
    }
    case "number-list":
    case "length-list":
      return normalized.values.map((item) => format(item, precision)).join(" ");
    case "points":
      return normalized.points.map((point) => `${format(point.x, precision)},${format(point.y, precision)}`).join(" ");
    case "paint":
      return normalized.value.type === "color"
        ? serializeAnimationValue({ family: "color", value: normalized.value.color }, precision)
        : normalized.value.source;
    case "path":
      return normalized.commands
        .map((command) => `${command.kind}${command.values.map((item) => format(item, precision)).join(" ")}`)
        .join(" ");
    case "viewBox":
      return [normalized.value.x, normalized.value.y, normalized.value.width, normalized.value.height]
        .map((item) => format(item, precision))
        .join(" ");
    case "transform":
      return normalized.components
        .map((component) => `${component.kind}(${component.values.map((item) => format(item, precision)).join(" ")})`)
        .join(" ");
    case "discrete":
      return normalized.value;
  }
}

function swiftStringLiteral(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")}"`;
}

/** Deterministic literal consumed by the generated Swift value runtime. */
export function swiftAnimationValueLiteral(value: TypedAnimationValue, precision = 10, typePrefix = ""): string {
  let kind: string;
  let components: number[];
  let signature = "";
  switch (value.family) {
    case "number":
    case "integer":
    case "opacity":
    case "length":
    case "angle":
      kind = value.family;
      components = [value.value];
      break;
    case "color":
      kind = "color";
      components = [value.value.red, value.value.green, value.value.blue, value.value.alpha];
      signature = value.value.colorSpace;
      break;
    case "number-list":
    case "length-list":
      kind = value.family === "number-list" ? "numberList" : "lengthList";
      components = [...value.values];
      signature = String(value.values.length);
      break;
    case "points":
      kind = "points";
      components = value.points.flatMap((point) => [point.x, point.y]);
      signature = String(value.points.length);
      break;
    case "paint":
      if (value.value.type === "color") {
        kind = "paintColor";
        components = [value.value.color.red, value.value.color.green, value.value.color.blue, value.value.color.alpha];
        signature = value.value.color.colorSpace;
      } else {
        kind = "discrete";
        components = [];
        signature = "paint";
      }
      break;
    case "path":
      kind = "path";
      components = value.commands.flatMap((command) => [...command.values]);
      signature = value.commands.map((command) => `${command.kind}${command.values.length}`).join(";");
      break;
    case "viewBox":
      kind = "viewBox";
      components = [value.value.x, value.value.y, value.value.width, value.value.height];
      signature = "4";
      break;
    case "transform":
      kind = "transform";
      components = value.components.flatMap((component) => [...component.values]);
      signature = value.components.map((component) => `${component.kind}${component.values.length}`).join(";");
      break;
    case "discrete":
      kind = "discrete";
      components = [];
      signature = "string";
      break;
  }
  return `${typePrefix}SVGAnimationRuntimeValue(kind: .${kind}, components: [${components
    .map((component) => format(component, precision))
    .join(", ")}], signature: ${swiftStringLiteral(signature)}, source: ${swiftStringLiteral(
    serializeAnimationValue(value, precision),
  )})`;
}
