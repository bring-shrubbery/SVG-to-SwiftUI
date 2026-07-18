import type { ElementNode } from "svg-parser";
import { parseOpacity, parseRGBAColor, type RGBAColor } from "../colorUtils";
import {
  lengthContext,
  type ParsedSVGLength,
  parsePlainNumber,
  parseSVGLength,
  resolveSVGLength,
  SVGLengthError,
} from "../lengths";
import { type InternalGeneratorConfig, resolveResourceSync } from "../resources";
import type { Presentation, StyleResolution, SVGStyleResolver } from "../styleCascade";
import type { FilterConfiguration } from "../types";
import { DEFAULT_PRESERVE_ASPECT_RATIO, parsePreserveAspectRatio } from "../viewports";
import { objectBoundingBox } from "./bounds";
import type {
  FilterBlendMode,
  FilterColorInterpolation,
  FilterComponentTransferFunction,
  FilterComponentTransferFunctions,
  FilterCompositeOperator,
  FilterEdgeMode,
  FilterImageSource,
  FilterInput,
  FilterInstance,
  FilterPrimitive,
  FilterPrimitiveRegionSpec,
  FilterPrimitiveSpec,
  FilterResource,
  FilterUnits,
  Paint,
  RenderBounds,
  RenderDiagnostic,
  RenderNode,
  SourceLocation,
} from "./types";

export const DEFAULT_FILTER_LIMITS: Required<FilterConfiguration> = {
  maxKernelCells: 225,
  maxOctaves: 9,
  maxOutputPixels: 16_000_000,
};

export function filterLimits(config: InternalGeneratorConfig): Required<FilterConfiguration> {
  const configured = { ...DEFAULT_FILTER_LIMITS, ...(config.filters ?? {}) };
  return {
    maxKernelCells: positiveIntegerLimit(configured.maxKernelCells, DEFAULT_FILTER_LIMITS.maxKernelCells),
    maxOctaves: positiveIntegerLimit(configured.maxOctaves, DEFAULT_FILTER_LIMITS.maxOctaves),
    maxOutputPixels: positiveIntegerLimit(configured.maxOutputPixels, DEFAULT_FILTER_LIMITS.maxOutputPixels),
  };
}

function positiveIntegerLimit(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.trunc(value)) : fallback;
}

const IDENTITY_COLOR_MATRIX = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const FILTER_BLEND_MODES = new Set<FilterBlendMode>([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);
const FILTER_COMPOSITE_OPERATORS = new Set<FilterCompositeOperator>([
  "over",
  "in",
  "out",
  "atop",
  "xor",
  "lighter",
  "arithmetic",
]);

const CLEAR: RGBAColor = { red: 0, green: 0, blue: 0, alpha: 0 };
const RESERVED_INPUTS: Readonly<Record<string, FilterInput["type"]>> = {
  SourceGraphic: "sourceGraphic",
  SourceAlpha: "sourceAlpha",
  BackgroundImage: "backgroundImage",
  BackgroundAlpha: "backgroundAlpha",
  FillPaint: "fillPaint",
  StrokePaint: "strokePaint",
};

function sourceLocation(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) };
}

function diagnostic(diagnostics: RenderDiagnostic[], element: ElementNode, code: string, message: string): void {
  diagnostics.push({ code, message, severity: "warning", source: sourceLocation(element) });
}

function children(element: ElementNode): ElementNode[] {
  return element.children.filter(
    (child): child is ElementNode => typeof child !== "string" && child.type === "element",
  );
}

function containsFilter(element: ElementNode): boolean {
  return element.tagName?.toLowerCase() === "filter" || children(element).some(containsFilter);
}

function hasAttribute(element: ElementNode, name: string): boolean {
  return Object.keys(element.properties ?? {}).some((key) => key.toLowerCase() === name.toLowerCase());
}

function attribute(element: ElementNode, name: string): unknown {
  return Object.entries(element.properties ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function parsedLength(
  raw: unknown,
  fallback: string,
  label: string,
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): ParsedSVGLength {
  try {
    const parsed = parseSVGLength(raw ?? fallback);
    if (parsed.kind !== "length") throw new SVGLengthError("invalid-filter-length", `${label} requires a length.`);
    return parsed;
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      error instanceof SVGLengthError ? error.code : "invalid-filter-length",
      `Invalid ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return parseSVGLength(fallback) as ParsedSVGLength;
  }
}

function optionalLength(
  element: ElementNode,
  name: "x" | "y" | "width" | "height",
  diagnostics: RenderDiagnostic[],
): ParsedSVGLength | undefined {
  if (!hasAttribute(element, name)) return undefined;
  return parsedLength(
    attribute(element, name),
    name === "width" || name === "height" ? "100%" : "0%",
    name,
    element,
    diagnostics,
  );
}

function units(
  raw: unknown,
  fallback: FilterUnits,
  label: "filterUnits" | "primitiveUnits",
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): FilterUnits {
  const value = String(raw ?? fallback).trim();
  if (value === "objectBoundingBox" || value === "userSpaceOnUse") return value;
  diagnostic(diagnostics, element, `invalid-${label}`, `Invalid ${label} '${value}'.`);
  return fallback;
}

function colorInterpolation(
  raw: unknown,
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): FilterColorInterpolation {
  const value = String(raw ?? "linearRGB").trim();
  if (value === "sRGB" || value === "linearRGB") return value;
  if (value === "auto") return "linearRGB";
  diagnostic(
    diagnostics,
    element,
    "invalid-color-interpolation-filters",
    `Invalid color-interpolation-filters '${value}'; using linearRGB.`,
  );
  return "linearRGB";
}

function numberValue(element: ElementNode, name: string, fallback: number, diagnostics: RenderDiagnostic[]): number {
  const raw = attribute(element, name);
  if (raw === undefined || String(raw).trim() === "") return fallback;
  try {
    return parsePlainNumber(raw, name);
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      `invalid-filter-${name.toLowerCase()}`,
      error instanceof Error ? error.message : String(error),
    );
    return fallback;
  }
}

function numberPair(
  element: ElementNode,
  name: string,
  fallback: number,
  diagnostics: RenderDiagnostic[],
): [number, number] {
  const raw = attribute(element, name);
  if (raw === undefined || String(raw).trim() === "") return [fallback, fallback];
  const tokens = numberList(element, name, diagnostics);
  if (!tokens || tokens.length < 1 || tokens.length > 2) {
    if (!tokens) return [fallback, fallback];
    diagnostic(diagnostics, element, `invalid-filter-${name.toLowerCase()}`, `${name} requires one or two numbers.`);
    return [fallback, fallback];
  }
  try {
    const first = tokens[0]!;
    const second = tokens[1] ?? first;
    if (first < 0 || second < 0) {
      diagnostic(diagnostics, element, `negative-filter-${name.toLowerCase()}`, `${name} cannot be negative.`);
      return [0, 0];
    }
    return [first, second];
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      `invalid-filter-${name.toLowerCase()}`,
      error instanceof Error ? error.message : String(error),
    );
    return [fallback, fallback];
  }
}

function integerPair(
  element: ElementNode,
  name: string,
  fallback: number,
  diagnostics: RenderDiagnostic[],
): [number, number] | undefined {
  const raw = attribute(element, name);
  if (raw === undefined || String(raw).trim() === "") return [fallback, fallback];
  const values = numberList(element, name, diagnostics);
  if (!values || values.length < 1 || values.length > 2) {
    if (values)
      diagnostic(diagnostics, element, `invalid-filter-${name.toLowerCase()}`, `${name} requires one or two integers.`);
    return undefined;
  }
  if (values.some((value) => !Number.isInteger(value))) {
    diagnostic(diagnostics, element, `invalid-filter-${name.toLowerCase()}`, `${name} requires integer values.`);
    return undefined;
  }
  const first = Math.trunc(values[0]!);
  const second = Math.trunc(values[1] ?? values[0]!);
  if (first <= 0 || second <= 0) {
    diagnostic(
      diagnostics,
      element,
      `invalid-filter-${name.toLowerCase()}`,
      `${name} values must be greater than zero.`,
    );
    return undefined;
  }
  return [first, second];
}

function edgeMode(element: ElementNode, fallback: FilterEdgeMode, diagnostics: RenderDiagnostic[]): FilterEdgeMode {
  const value = String(attribute(element, "edgeMode") ?? fallback)
    .trim()
    .toLowerCase();
  if (value === "none" || value === "duplicate" || value === "wrap") return value;
  diagnostic(diagnostics, element, "invalid-filter-edge-mode", `Invalid edgeMode '${value}'; using ${fallback}.`);
  return fallback;
}

function booleanValue(element: ElementNode, name: string, fallback: boolean, diagnostics: RenderDiagnostic[]): boolean {
  const raw = attribute(element, name);
  if (raw === undefined || String(raw).trim() === "") return fallback;
  const value = String(raw).trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  diagnostic(diagnostics, element, `invalid-filter-${name.toLowerCase()}`, `${name} must be true or false.`);
  return fallback;
}

function numberList(element: ElementNode, name: string, diagnostics: RenderDiagnostic[]): number[] | undefined {
  const raw = attribute(element, name);
  if (raw === undefined || String(raw).trim() === "") return [];
  const source = String(raw).trim();
  if (/^,|,$|,\s*,/.test(source)) {
    diagnostic(diagnostics, element, `invalid-filter-${name.toLowerCase()}`, `${name} contains an invalid separator.`);
    return undefined;
  }
  try {
    return source.split(/[\s,]+/).map((token) => parsePlainNumber(token, name));
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      `invalid-filter-${name.toLowerCase()}`,
      error instanceof Error ? error.message : String(error),
    );
    return undefined;
  }
}

function saturateMatrix(value: number): number[] {
  return [
    0.213 + 0.787 * value,
    0.715 - 0.715 * value,
    0.072 - 0.072 * value,
    0,
    0,
    0.213 - 0.213 * value,
    0.715 + 0.285 * value,
    0.072 - 0.072 * value,
    0,
    0,
    0.213 - 0.213 * value,
    0.715 - 0.715 * value,
    0.072 + 0.928 * value,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];
}

function hueRotateMatrix(degrees: number): number[] {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const base = [0.213, 0.715, 0.072, 0.213, 0.715, 0.072, 0.213, 0.715, 0.072];
  const cosineTerms = [0.787, -0.715, -0.072, -0.213, 0.285, -0.072, -0.213, -0.715, 0.928];
  const sineTerms = [-0.213, -0.715, 0.928, 0.143, 0.14, -0.283, -0.787, 0.715, 0.072];
  const values = base.map((value, index) => value + cosine * cosineTerms[index]! + sine * sineTerms[index]!);
  return [
    values[0]!,
    values[1]!,
    values[2]!,
    0,
    0,
    values[3]!,
    values[4]!,
    values[5]!,
    0,
    0,
    values[6]!,
    values[7]!,
    values[8]!,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];
}

function colorMatrix(element: ElementNode, diagnostics: RenderDiagnostic[]): number[] {
  const rawType = String(attribute(element, "type") ?? "matrix").trim();
  const type = ["matrix", "saturate", "hueRotate", "luminanceToAlpha"].includes(rawType) ? rawType : "matrix";
  if (type !== rawType)
    diagnostic(
      diagnostics,
      element,
      "invalid-filter-color-matrix-type",
      `Invalid feColorMatrix type '${rawType}'; using matrix.`,
    );
  if (type === "luminanceToAlpha") return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0];
  const values = numberList(element, "values", diagnostics);
  const fallback =
    type === "matrix" ? IDENTITY_COLOR_MATRIX : type === "saturate" ? saturateMatrix(1) : hueRotateMatrix(0);
  const required = type === "matrix" ? 20 : 1;
  if (values === undefined || (hasAttribute(element, "values") && values.length !== required)) {
    if (values !== undefined)
      diagnostic(
        diagnostics,
        element,
        "invalid-filter-color-matrix-values-count",
        `feColorMatrix type '${type}' requires ${required} value${required === 1 ? "" : "s"}; using pass-through.`,
      );
    return fallback;
  }
  if (values.length === 0) return fallback;
  return type === "matrix" ? values : type === "saturate" ? saturateMatrix(values[0]!) : hueRotateMatrix(values[0]!);
}

function componentFunction(element: ElementNode, diagnostics: RenderDiagnostic[]): FilterComponentTransferFunction {
  const rawType = String(attribute(element, "type") ?? "identity")
    .trim()
    .toLowerCase();
  if (!["identity", "table", "discrete", "linear", "gamma"].includes(rawType)) {
    diagnostic(
      diagnostics,
      element,
      "invalid-filter-component-transfer-type",
      `Invalid component transfer type '${rawType}'; using identity.`,
    );
    return { type: "identity" };
  }
  if (rawType === "identity") return { type: "identity" };
  if (rawType === "table" || rawType === "discrete") {
    const values = numberList(element, "tableValues", diagnostics);
    return values ? { type: rawType, values } : { type: "identity" };
  }
  if (rawType === "linear")
    return {
      type: "linear",
      slope: numberValue(element, "slope", 1, diagnostics),
      intercept: numberValue(element, "intercept", 0, diagnostics),
    };
  return {
    type: "gamma",
    amplitude: numberValue(element, "amplitude", 1, diagnostics),
    exponent: numberValue(element, "exponent", 1, diagnostics),
    offset: numberValue(element, "offset", 0, diagnostics),
  };
}

function componentFunctions(element: ElementNode, diagnostics: RenderDiagnostic[]): FilterComponentTransferFunctions {
  const functions: FilterComponentTransferFunctions = [
    { type: "identity" },
    { type: "identity" },
    { type: "identity" },
    { type: "identity" },
  ];
  const channels: Readonly<Record<string, number>> = { fefuncr: 0, fefuncg: 1, fefuncb: 2, fefunca: 3 };
  for (const child of children(element)) {
    const channel = channels[child.tagName?.toLowerCase() ?? ""];
    if (channel !== undefined) functions[channel] = componentFunction(child, diagnostics);
  }
  return functions;
}

function regionSpec(element: ElementNode, diagnostics: RenderDiagnostic[]): FilterPrimitiveRegionSpec {
  const x = optionalLength(element, "x", diagnostics);
  const y = optionalLength(element, "y", diagnostics);
  const width = optionalLength(element, "width", diagnostics);
  const height = optionalLength(element, "height", diagnostics);
  return {
    ...(x ? { x } : {}),
    ...(y ? { y } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

function floodColor(element: ElementNode, presentation: Presentation, diagnostics: RenderDiagnostic[]): RGBAColor {
  const rawColor = String(presentation["flood-color"] ?? "black").trim();
  const colorSource = rawColor.toLowerCase() === "currentcolor" ? String(presentation.color ?? "black") : rawColor;
  const parsed = parseRGBAColor(colorSource);
  if (!parsed) {
    diagnostic(diagnostics, element, "invalid-flood-color", `Invalid flood-color '${rawColor}'; using black.`);
  }
  const color = parsed ?? { red: 0, green: 0, blue: 0, alpha: 1 };
  const rawOpacity = presentation["flood-opacity"] ?? 1;
  const opacitySource = String(rawOpacity).trim();
  if (
    opacitySource === "" ||
    !Number.isFinite(Number(opacitySource.endsWith("%") ? opacitySource.slice(0, -1) : opacitySource))
  ) {
    diagnostic(diagnostics, element, "invalid-flood-opacity", `Invalid flood-opacity '${opacitySource}'; using 1.`);
  }
  return { ...color, alpha: color.alpha * parseOpacity(rawOpacity) };
}

function filterImageSource(
  element: ElementNode,
  definitions: Map<string, ElementNode>,
  config: InternalGeneratorConfig,
  diagnostics: RenderDiagnostic[],
): FilterImageSource {
  const href = String(attribute(element, "href") ?? attribute(element, "xlink:href") ?? "").trim();
  let preserveAspectRatio = DEFAULT_PRESERVE_ASPECT_RATIO;
  try {
    preserveAspectRatio = parsePreserveAspectRatio(attribute(element, "preserveAspectRatio"));
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      "invalid-preserve-aspect-ratio",
      error instanceof Error ? error.message : String(error),
    );
  }
  const source: FilterImageSource = { href, preserveAspectRatio };
  if (!href) {
    diagnostic(diagnostics, element, "missing-filter-image-resource", "feImage href is empty or missing.");
    return source;
  }
  if (href.startsWith("#")) {
    const id = href.slice(1);
    if (!id || !definitions.has(id)) {
      diagnostic(diagnostics, element, "missing-filter-image-fragment", `feImage fragment '${href}' does not exist.`);
      return source;
    }
    source.localElementId = id;
    return source;
  }
  const resolution = resolveResourceSync(href, "filter-image", element, config);
  if ("failure" in resolution) {
    diagnostic(diagnostics, element, resolution.failure.code, resolution.failure.message);
    return source;
  }
  const resource = resolution.resource;
  if (resource.mimeType === "image/svg+xml") {
    if (!resource.bytes) {
      diagnostic(
        diagnostics,
        element,
        "svg-filter-image-bytes-required",
        `SVG feImage '${href}' requires resolved bytes.`,
      );
      return source;
    }
    source.pendingSVG = { bytes: resource.bytes, canonicalURL: resource.canonicalURL };
    return source;
  }
  source.resource = {
    type: "raster",
    ...(resource.bytes ? { bytes: resource.bytes } : {}),
    mimeType: resource.mimeType,
    canonicalURL: resource.canonicalURL,
    ...(resource.assetName ? { assetName: resource.assetName } : {}),
    ...(resource.intrinsicSize ? { intrinsicSize: resource.intrinsicSize } : {}),
  };
  return source;
}

function localHref(element: ElementNode, diagnostics: RenderDiagnostic[]): string | undefined {
  const raw = attribute(element, "href") ?? attribute(element, "xlink:href");
  if (raw === undefined || String(raw).trim() === "") return undefined;
  const value = String(raw).trim();
  const match = /^#([^\s]+)$/.exec(value);
  if (match) return match[1];
  diagnostic(
    diagnostics,
    element,
    "external-filter-href",
    `Only local filter href references are supported; received '${value}'.`,
  );
  return undefined;
}

function buildPrimitiveSpecs(
  filter: ElementNode,
  filterPresentation: Presentation,
  styleResolver: SVGStyleResolver,
  definitions: Map<string, ElementNode>,
  config: InternalGeneratorConfig,
  diagnostics: RenderDiagnostic[],
): FilterPrimitiveSpec[] {
  const specs: FilterPrimitiveSpec[] = [];
  const named = new Map<string, number>();
  const previousInput = (): FilterInput =>
    specs.length === 0 ? { type: "sourceGraphic" } : { type: "result", index: specs.length - 1 };
  const resolveInput = (element: ElementNode, raw: unknown): FilterInput => {
    if (raw === undefined || String(raw).trim() === "") return previousInput();
    const value = String(raw).trim();
    const reserved = RESERVED_INPUTS[value];
    if (reserved) {
      if (reserved === "backgroundImage" || reserved === "backgroundAlpha")
        diagnostic(
          diagnostics,
          element,
          "unsupported-filter-background-input",
          `${value} is unavailable in the current static compositing context and resolves to transparent black.`,
        );
      return { type: reserved } as FilterInput;
    }
    const index = named.get(value);
    if (index !== undefined) return { type: "result", index };
    diagnostic(
      diagnostics,
      element,
      "unknown-filter-input",
      `Filter input '${value}' does not name a preceding result; using the default input.`,
    );
    return previousInput();
  };

  for (const element of children(filter)) {
    const tag = (element.tagName ?? "").toLowerCase();
    if (["title", "desc", "metadata", "script", "animate", "set"].includes(tag)) continue;
    if (!tag.startsWith("fe") || tag === "femergenode") continue;
    const resolved = styleResolver.resolve(element, filterPresentation).values;
    const input = resolveInput(element, attribute(element, "in"));
    const input2 = hasAttribute(element, "in2") ? resolveInput(element, attribute(element, "in2")) : undefined;
    const common = {
      region: regionSpec(element, diagnostics),
      colorInterpolation: colorInterpolation(resolved["color-interpolation-filters"], element, diagnostics),
      source: sourceLocation(element),
      ...(input2 ? { input2 } : {}),
    };
    let spec: FilterPrimitiveSpec;
    if (tag === "feblend") {
      const rawMode = String(attribute(element, "mode") ?? "normal")
        .trim()
        .toLowerCase() as FilterBlendMode;
      const mode = FILTER_BLEND_MODES.has(rawMode) ? rawMode : "normal";
      if (mode !== rawMode)
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-blend-mode",
          `Invalid feBlend mode '${rawMode}'; using normal.`,
        );
      spec = { type: "blend", input, input2: input2 ?? previousInput(), mode, ...common };
    } else if (tag === "fecolormatrix") {
      spec = { type: "colorMatrix", input, matrix: colorMatrix(element, diagnostics), ...common };
    } else if (tag === "fecomponenttransfer") {
      spec = { type: "componentTransfer", input, functions: componentFunctions(element, diagnostics), ...common };
    } else if (tag === "fecomposite") {
      const rawOperator = String(attribute(element, "operator") ?? "over")
        .trim()
        .toLowerCase() as FilterCompositeOperator;
      const operator = FILTER_COMPOSITE_OPERATORS.has(rawOperator) ? rawOperator : "over";
      if (operator !== rawOperator)
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-composite-operator",
          `Invalid feComposite operator '${rawOperator}'; using over.`,
        );
      spec = {
        type: "composite",
        input,
        input2: input2 ?? previousInput(),
        operator,
        k1: numberValue(element, "k1", 0, diagnostics),
        k2: numberValue(element, "k2", 0, diagnostics),
        k3: numberValue(element, "k3", 0, diagnostics),
        k4: numberValue(element, "k4", 0, diagnostics),
        ...common,
      };
    } else if (tag === "feconvolvematrix") {
      const order = integerPair(element, "order", 3, diagnostics);
      const kernelMatrix = numberList(element, "kernelMatrix", diagnostics);
      const kernelCells = order ? order[0] * order[1] : 0;
      const limit = filterLimits(config).maxKernelCells;
      let invalid = !order || !kernelMatrix || kernelMatrix.length !== kernelCells;
      if (order && kernelMatrix && kernelMatrix.length !== kernelCells)
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-kernel-matrix-size",
          `kernelMatrix has ${kernelMatrix.length} values but order ${order[0]}×${order[1]} requires ${kernelCells}; using pass-through.`,
        );
      if (kernelCells > limit) {
        diagnostic(
          diagnostics,
          element,
          "filter-kernel-limit",
          `feConvolveMatrix has ${kernelCells} coefficients, exceeding the ${limit}-coefficient limit; using pass-through.`,
        );
        invalid = true;
      }
      const defaultDivisor = kernelMatrix?.reduce((sum, value) => sum + value, 0) || 1;
      const authoredDivisor = numberValue(element, "divisor", defaultDivisor, diagnostics);
      if (authoredDivisor === 0)
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-divisor",
          `feConvolveMatrix divisor cannot be zero; using ${defaultDivisor}.`,
        );
      const divisor = authoredDivisor === 0 ? defaultDivisor : authoredDivisor;
      const rawTargetX = numberValue(element, "targetX", Math.floor((order?.[0] ?? 1) / 2), diagnostics);
      const rawTargetY = numberValue(element, "targetY", Math.floor((order?.[1] ?? 1) / 2), diagnostics);
      const targetX = Math.trunc(rawTargetX);
      const targetY = Math.trunc(rawTargetY);
      if (!Number.isInteger(rawTargetX) || !Number.isInteger(rawTargetY)) {
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-convolution-target",
          "targetX and targetY require integer values; using pass-through.",
        );
        invalid = true;
      }
      if (order && (targetX < 0 || targetX >= order[0] || targetY < 0 || targetY >= order[1])) {
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-convolution-target",
          `targetX/targetY must lie inside the ${order[0]}×${order[1]} kernel; using pass-through.`,
        );
        invalid = true;
      }
      let kernelUnitLength: [number, number] | undefined;
      if (hasAttribute(element, "kernelUnitLength")) {
        const values = numberList(element, "kernelUnitLength", diagnostics);
        if (values && values.length >= 1 && values.length <= 2 && values.every((value) => value > 0))
          kernelUnitLength = [values[0]!, values[1] ?? values[0]!];
        else
          diagnostic(
            diagnostics,
            element,
            "invalid-filter-kernel-unit-length",
            "kernelUnitLength requires one or two positive numbers; using the device-pixel default.",
          );
      }
      spec = invalid
        ? { type: "passthrough", input, element: element.tagName ?? "feConvolveMatrix", ...common }
        : {
            type: "convolveMatrix",
            input,
            orderX: order![0],
            orderY: order![1],
            kernelMatrix: kernelMatrix!,
            divisor,
            bias: numberValue(element, "bias", 0, diagnostics),
            targetX,
            targetY,
            edgeMode: edgeMode(element, "duplicate", diagnostics),
            ...(kernelUnitLength
              ? { kernelUnitLengthX: kernelUnitLength[0], kernelUnitLengthY: kernelUnitLength[1] }
              : {}),
            preserveAlpha: booleanValue(element, "preserveAlpha", false, diagnostics),
            ...common,
          };
    } else if (tag === "femorphology") {
      const [radiusX, radiusY] = numberPair(element, "radius", 0, diagnostics);
      const rawOperator = String(attribute(element, "operator") ?? "erode")
        .trim()
        .toLowerCase();
      const operator = rawOperator === "dilate" ? "dilate" : "erode";
      if (rawOperator !== "erode" && rawOperator !== "dilate")
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-morphology-operator",
          `Invalid feMorphology operator '${rawOperator}'; using erode.`,
        );
      spec = { type: "morphology", input, operator, radiusX, radiusY, ...common };
    } else if (tag === "fedisplacementmap") {
      const channel = (name: "xChannelSelector" | "yChannelSelector") => {
        const value = String(attribute(element, name) ?? "A")
          .trim()
          .toUpperCase();
        if (value === "R" || value === "G" || value === "B" || value === "A") return value;
        diagnostic(
          diagnostics,
          element,
          `invalid-filter-${name.toLowerCase()}`,
          `${name} must be R, G, B, or A; using A.`,
        );
        return "A" as const;
      };
      spec = {
        type: "displacementMap",
        input,
        input2: input2 ?? previousInput(),
        scale: numberValue(element, "scale", 0, diagnostics),
        xChannel: channel("xChannelSelector"),
        yChannel: channel("yChannelSelector"),
        ...common,
      };
    } else if (tag === "fetile") {
      spec = { type: "tile", input, ...common };
    } else if (tag === "feturbulence") {
      const [baseFrequencyX, baseFrequencyY] = numberPair(element, "baseFrequency", 0, diagnostics);
      const parsedOctaves = numberValue(element, "numOctaves", 1, diagnostics);
      const rawOctaves = Math.trunc(parsedOctaves);
      if (!Number.isInteger(parsedOctaves))
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-num-octaves",
          "numOctaves requires an integer; truncating toward zero.",
        );
      const maxOctaves = filterLimits(config).maxOctaves;
      let numOctaves = Math.max(0, rawOctaves);
      if (rawOctaves < 0)
        diagnostic(diagnostics, element, "negative-filter-num-octaves", "numOctaves cannot be negative; using 0.");
      if (numOctaves > maxOctaves) {
        diagnostic(
          diagnostics,
          element,
          "filter-octave-limit",
          `feTurbulence requests ${numOctaves} octaves; clamping to the ${maxOctaves}-octave limit.`,
        );
        numOctaves = maxOctaves;
      }
      const rawStitch = String(attribute(element, "stitchTiles") ?? "noStitch").trim();
      const stitchTiles = rawStitch === "stitch";
      if (rawStitch !== "stitch" && rawStitch !== "noStitch")
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-stitch-tiles",
          `Invalid stitchTiles '${rawStitch}'; using noStitch.`,
        );
      const rawType = String(attribute(element, "type") ?? "turbulence").trim();
      const noiseType = rawType === "fractalNoise" ? "fractalNoise" : "turbulence";
      if (rawType !== "turbulence" && rawType !== "fractalNoise")
        diagnostic(
          diagnostics,
          element,
          "invalid-filter-turbulence-type",
          `Invalid feTurbulence type '${rawType}'; using turbulence.`,
        );
      spec = {
        type: "turbulence",
        baseFrequencyX,
        baseFrequencyY,
        numOctaves,
        seed: Math.trunc(numberValue(element, "seed", 0, diagnostics)),
        stitchTiles,
        noiseType,
        ...common,
      };
    } else if (tag === "feimage") {
      spec = { type: "image", image: filterImageSource(element, definitions, config, diagnostics), ...common };
    } else if (tag === "fegaussianblur") {
      const [stdDeviationX, stdDeviationY] = numberPair(element, "stdDeviation", 0, diagnostics);
      spec = {
        type: "gaussianBlur",
        input,
        stdDeviationX,
        stdDeviationY,
        edgeMode: edgeMode(element, "none", diagnostics),
        ...common,
      };
    } else if (tag === "feoffset") {
      spec = {
        type: "offset",
        input,
        dx: numberValue(element, "dx", 0, diagnostics),
        dy: numberValue(element, "dy", 0, diagnostics),
        ...common,
      };
    } else if (tag === "feflood") {
      spec = { type: "flood", color: floodColor(element, resolved, diagnostics), ...common };
    } else if (tag === "femerge") {
      const inputs = children(element)
        .filter((child) => child.tagName?.toLowerCase() === "femergenode")
        .map((child) => resolveInput(child, attribute(child, "in")));
      spec = { type: "merge", inputs, ...common };
    } else if (tag === "fedropshadow") {
      const [stdDeviationX, stdDeviationY] = numberPair(element, "stdDeviation", 2, diagnostics);
      spec = {
        type: "dropShadow",
        input,
        stdDeviationX,
        stdDeviationY,
        dx: numberValue(element, "dx", 2, diagnostics),
        dy: numberValue(element, "dy", 2, diagnostics),
        color: floodColor(element, resolved, diagnostics),
        ...common,
      };
    } else {
      diagnostic(
        diagnostics,
        element,
        "unsupported-filter-primitive",
        `<${element.tagName}> is retained as a pass-through operation until its filter primitive ticket lands.`,
      );
      spec = { type: "passthrough", input, element: element.tagName ?? "unknown", ...common };
    }

    const result = String(attribute(element, "result") ?? "").trim();
    if (result) {
      if (RESERVED_INPUTS[result])
        diagnostic(diagnostics, element, "invalid-filter-result-name", `Filter result '${result}' is reserved.`);
      if (named.has(result))
        diagnostic(
          diagnostics,
          element,
          "duplicate-filter-result",
          `Filter result '${result}' is duplicated; later inputs use the closest preceding result.`,
        );
      spec.result = result;
      named.set(result, specs.length);
    }
    specs.push(spec);
  }
  return specs;
}

/** Resolve local filter definitions, href inheritance, graph names, and primitive presentation. */
export function resolveFilterResources(
  root: ElementNode,
  filterElements: Map<string, ElementNode>,
  definitions: Map<string, ElementNode>,
  styleResolver: SVGStyleResolver,
  rootPresentation: Presentation,
  config: InternalGeneratorConfig,
  diagnostics: RenderDiagnostic[],
): Map<string, FilterResource> {
  const resolutions = new Map<ElementNode, StyleResolution>();
  const walk = (element: ElementNode, inherited: Presentation): void => {
    for (const child of children(element)) {
      if (!containsFilter(child)) continue;
      const resolved = styleResolver.resolve(child, inherited);
      resolutions.set(child, resolved);
      walk(child, resolved.values);
    }
  };
  walk(root, rootPresentation);

  const resources = new Map<string, FilterResource>();
  const resolving: string[] = [];
  const resolveOne = (id: string): FilterResource | undefined => {
    const cached = resources.get(id);
    if (cached) return cached;
    const element = filterElements.get(id);
    if (!element) return undefined;
    const cycleIndex = resolving.indexOf(id);
    if (cycleIndex >= 0) {
      const cycle = [...resolving.slice(cycleIndex), id];
      diagnostic(
        diagnostics,
        element,
        "cyclic-filter-reference",
        `Filter href cycle detected: ${cycle.map((item) => `#${item}`).join(" -> ")}.`,
      );
      return undefined;
    }
    resolving.push(id);
    const presentation = resolutions.get(element)?.values ?? rootPresentation;
    const href = localHref(element, diagnostics);
    let base: FilterResource | undefined;
    if (href) {
      const target = definitions.get(href);
      if (!target || target.tagName?.toLowerCase() !== "filter") {
        diagnostic(
          diagnostics,
          element,
          target ? "wrong-filter-href-resource-type" : "missing-filter-href-resource",
          target
            ? `Filter href #${href} targets <${target.tagName}> instead of a filter.`
            : `Filter href #${href} does not resolve to a local filter.`,
        );
      } else {
        base = resolveOne(href);
      }
    }
    const primitiveElements = children(element).filter((child) => (child.tagName ?? "").toLowerCase().startsWith("fe"));
    const width = hasAttribute(element, "width")
      ? parsedLength(attribute(element, "width"), "120%", "filter width", element, diagnostics)
      : (base?.width ?? parsedLength(undefined, "120%", "filter width", element, diagnostics));
    const height = hasAttribute(element, "height")
      ? parsedLength(attribute(element, "height"), "120%", "filter height", element, diagnostics)
      : (base?.height ?? parsedLength(undefined, "120%", "filter height", element, diagnostics));
    if (width.value < 0) diagnostic(diagnostics, element, "negative-filter-width", "Filter width cannot be negative.");
    if (height.value < 0)
      diagnostic(diagnostics, element, "negative-filter-height", "Filter height cannot be negative.");
    const resource: FilterResource = {
      id,
      x: hasAttribute(element, "x")
        ? parsedLength(attribute(element, "x"), "-10%", "filter x", element, diagnostics)
        : (base?.x ?? parsedLength(undefined, "-10%", "filter x", element, diagnostics)),
      y: hasAttribute(element, "y")
        ? parsedLength(attribute(element, "y"), "-10%", "filter y", element, diagnostics)
        : (base?.y ?? parsedLength(undefined, "-10%", "filter y", element, diagnostics)),
      width,
      height,
      units: hasAttribute(element, "filterUnits")
        ? units(attribute(element, "filterUnits"), "objectBoundingBox", "filterUnits", element, diagnostics)
        : (base?.units ?? "objectBoundingBox"),
      primitiveUnits: hasAttribute(element, "primitiveUnits")
        ? units(attribute(element, "primitiveUnits"), "userSpaceOnUse", "primitiveUnits", element, diagnostics)
        : (base?.primitiveUnits ?? "userSpaceOnUse"),
      colorInterpolation: colorInterpolation(presentation["color-interpolation-filters"], element, diagnostics),
      ...(href ? { href } : {}),
      source: sourceLocation(element),
      element,
      primitives:
        primitiveElements.length > 0
          ? buildPrimitiveSpecs(element, presentation, styleResolver, definitions, config, diagnostics)
          : (base?.primitives ?? []),
      instances: new Map(),
      invalid: href !== undefined && (!base || base.invalid),
    };
    resources.set(id, resource);
    resolving.pop();
    return resource;
  };
  for (const id of filterElements.keys()) resolveOne(id);
  return resources;
}

function resolvedLength(
  value: ParsedSVGLength,
  axis: "horizontal" | "vertical",
  unitsValue: FilterUnits,
  node: RenderNode,
) {
  const viewport = unitsValue === "objectBoundingBox" ? { width: 1, height: 1 } : node.paintContext.viewport;
  const result = resolveSVGLength(
    value,
    lengthContext(
      viewport,
      node.paintContext.rootViewport,
      axis === "horizontal" ? "viewport-width" : "viewport-height",
      axis,
      node.paintContext.fontMetrics,
    ),
  );
  return typeof result === "number" ? result : 0;
}

function coordinate(
  value: ParsedSVGLength,
  axis: "horizontal" | "vertical",
  unitsValue: FilterUnits,
  node: RenderNode,
  bounds: RenderBounds | undefined,
  size = false,
): number {
  const resolved = resolvedLength(value, axis, unitsValue, node);
  if (unitsValue !== "objectBoundingBox" || !bounds) return resolved;
  const extent = axis === "horizontal" ? bounds.width : bounds.height;
  if (size) return resolved * extent;
  return (axis === "horizontal" ? bounds.x : bounds.y) + resolved * extent;
}

function intersect(left: RenderBounds, right: RenderBounds): RenderBounds {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const maxX = Math.min(left.x + left.width, right.x + right.width);
  const maxY = Math.min(left.y + left.height, right.y + right.height);
  return maxX <= x || maxY <= y ? { x, y, width: 0, height: 0 } : { x, y, width: maxX - x, height: maxY - y };
}

function union(bounds: RenderBounds[]): RenderBounds | undefined {
  if (bounds.length === 0) return undefined;
  const x = Math.min(...bounds.map((item) => item.x));
  const y = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return { x, y, width: maxX - x, height: maxY - y };
}

function inputRegion(input: FilterInput, previous: FilterPrimitive[], filterRegion: RenderBounds): RenderBounds {
  return input.type === "result" ? (previous[input.index]?.subregion ?? filterRegion) : filterRegion;
}

function subregion(
  spec: FilterPrimitiveSpec,
  previous: FilterPrimitive[],
  filterRegion: RenderBounds,
  resource: FilterResource,
  node: RenderNode,
  bounds: RenderBounds | undefined,
): RenderBounds {
  const inputs = spec.type === "merge" ? spec.inputs : [spec.input, spec.input2].filter((input) => input !== undefined);
  const defaults = union(inputs.map((input) => inputRegion(input, previous, filterRegion))) ?? filterRegion;
  const x = spec.region.x ? coordinate(spec.region.x, "horizontal", resource.primitiveUnits, node, bounds) : defaults.x;
  const y = spec.region.y ? coordinate(spec.region.y, "vertical", resource.primitiveUnits, node, bounds) : defaults.y;
  const width = spec.region.width
    ? coordinate(spec.region.width, "horizontal", resource.primitiveUnits, node, bounds, true)
    : defaults.width;
  const height = spec.region.height
    ? coordinate(spec.region.height, "vertical", resource.primitiveUnits, node, bounds, true)
    : defaults.height;
  return intersect({ x, y, width: Math.max(0, width), height: Math.max(0, height) }, filterRegion);
}

function paintColor(paint: Paint, opacity: number): RGBAColor {
  const source = paint.type === "solid" ? paint.value : paint.type === "reference" ? paint.fallback : undefined;
  const color = source ? parseRGBAColor(source) : undefined;
  return color ? { ...color, alpha: color.alpha * opacity } : CLEAR;
}

/** Resolve filter regions and primitive-unit parameters for one referencing render node. */
export function resolveFilterInstance(resource: FilterResource, node: RenderNode): FilterInstance {
  const bounds = objectBoundingBox(node);
  const needsBounds = resource.units === "objectBoundingBox" || resource.primitiveUnits === "objectBoundingBox";
  if (resource.invalid || (needsBounds && (!bounds || bounds.width === 0 || bounds.height === 0))) {
    return {
      resource,
      region: { x: 0, y: 0, width: 0, height: 0 },
      primitives: [],
      fillPaint: CLEAR,
      strokePaint: CLEAR,
      invalid: true,
    };
  }
  const region = {
    x: coordinate(resource.x, "horizontal", resource.units, node, bounds),
    y: coordinate(resource.y, "vertical", resource.units, node, bounds),
    width: coordinate(resource.width, "horizontal", resource.units, node, bounds, true),
    height: coordinate(resource.height, "vertical", resource.units, node, bounds, true),
  };
  const scaleX = resource.primitiveUnits === "objectBoundingBox" ? (bounds?.width ?? 0) : 1;
  const scaleY = resource.primitiveUnits === "objectBoundingBox" ? (bounds?.height ?? 0) : 1;
  const primitives: FilterPrimitive[] = [];
  for (const spec of resource.primitives) {
    const common = {
      ...(spec.result ? { result: spec.result } : {}),
      subregion: subregion(spec, primitives, region, resource, node, bounds),
      colorInterpolation: spec.colorInterpolation,
      source: spec.source,
    };
    if (spec.type === "gaussianBlur")
      primitives.push({
        ...spec,
        stdDeviationX: spec.stdDeviationX * scaleX,
        stdDeviationY: spec.stdDeviationY * scaleY,
        ...common,
      });
    else if (spec.type === "convolveMatrix")
      primitives.push({
        ...spec,
        ...(spec.kernelUnitLengthX === undefined
          ? {}
          : {
              kernelUnitLengthX: spec.kernelUnitLengthX * scaleX,
              kernelUnitLengthY: spec.kernelUnitLengthY! * scaleY,
            }),
        ...common,
      });
    else if (spec.type === "morphology")
      primitives.push({ ...spec, radiusX: spec.radiusX * scaleX, radiusY: spec.radiusY * scaleY, ...common });
    else if (spec.type === "displacementMap") {
      const { scale, ...displacement } = spec;
      primitives.push({
        ...displacement,
        displacement: { a: scale * scaleX, b: 0, c: 0, d: scale * scaleY },
        ...common,
      });
    } else if (spec.type === "tile")
      primitives.push({ ...spec, tileRegion: inputRegion(spec.input, primitives, region), ...common });
    else if (spec.type === "image" && spec.image.localElementId)
      primitives.push({
        ...spec,
        image: {
          ...spec.image,
          contentTransform:
            resource.primitiveUnits === "objectBoundingBox"
              ? {
                  a: bounds?.width ?? 0,
                  b: 0,
                  c: 0,
                  d: bounds?.height ?? 0,
                  e: bounds?.x ?? 0,
                  f: bounds?.y ?? 0,
                }
              : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        },
        ...common,
      });
    else if (spec.type === "offset")
      primitives.push({ ...spec, dx: spec.dx * scaleX, dy: spec.dy * scaleY, ...common });
    else if (spec.type === "dropShadow")
      primitives.push({
        ...spec,
        stdDeviationX: spec.stdDeviationX * scaleX,
        stdDeviationY: spec.stdDeviationY * scaleY,
        dx: spec.dx * scaleX,
        dy: spec.dy * scaleY,
        ...common,
      });
    else primitives.push({ ...spec, ...common });
  }
  return {
    resource,
    region,
    primitives,
    fillPaint: paintColor(node.style.contextFill ?? node.style.fill, node.style.fillOpacity),
    strokePaint: paintColor(node.style.stroke, node.style.strokeOpacity),
    invalid: region.width <= 0 || region.height <= 0,
  };
}
