import type { ElementNode } from "svg-parser";
import { parse } from "svg-parser";
import { parseOpacity } from "../colorUtils";
import { foreignObjectKey, foreignObjectSnapshotDocument } from "../foreignObjects";
import {
  defaultFontMetrics,
  type FontMetrics,
  lengthContext,
  type PercentageBasis,
  parsePlainNumber,
  parseSVGLength,
  resolveSVGLength,
  SVGLengthError,
} from "../lengths";
import {
  decodeUTF8,
  type InternalGeneratorConfig,
  resolveResourceSync,
  resourceLimits,
  resourceState,
} from "../resources";
import { type Presentation, type StyleResolution, SVGStyleResolver } from "../styleCascade";
import { type AffineTransform, IDENTITY_TRANSFORM, multiplyTransforms, parseTransform } from "../transformUtils";
import type { SVGElementProperties, ViewBoxData } from "../types";
import { getSVGElement, resolveSVGProperties } from "../utils";
import { DEFAULT_PRESERVE_ASPECT_RATIO, parsePreserveAspectRatio, parseViewBox, viewBoxTransform } from "../viewports";
import { resolveClipPathInstance, resolveClipPathResources } from "./clips";
import { resolvePaintServers } from "./gradients";
import { markerVertices, orientedMarkerAngle, resolveMarkerResources } from "./markers";
import { resolveMaskInstance, resolveMaskResources } from "./masks";
import { measureGeometryPath } from "./pathMetrics";
import { resolvePatternPaintServers } from "./patterns";
import type {
  ComputedStyle,
  CSSDiagnosticContext,
  Geometry,
  MarkerRefCoordinate,
  MarkerReference,
  MarkerResource,
  Paint,
  PaintOrderPhase,
  PatternPaint,
  RenderDiagnostic,
  RenderDocument,
  RenderForeignObject,
  RenderGroup,
  RenderImage,
  RenderNode,
  RenderShape,
  RenderText,
  RenderTextCharacter,
  RenderTextChunk,
  RenderTextLengthAdjustment,
  RenderTextPath,
  RenderTextRun,
  ResourceRegistry,
  SourceLocation,
  SVGBlendMode,
} from "./types";

interface CoordinateContext {
  viewport: { width: number; height: number };
  rootViewport: { width: number; height: number };
  fontMetrics: FontMetrics;
}

interface BuildContext {
  resources: ResourceRegistry;
  diagnostics: RenderDiagnostic[];
  activeReferences: Set<string>;
  styleResolver: SVGStyleResolver;
  config: InternalGeneratorConfig;
}

const GEOMETRY_ELEMENTS = new Set(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
const CONTAINER_ELEMENTS = new Set(["g", "a"]);
const NON_RENDERING_ELEMENTS = new Set([
  "defs",
  "symbol",
  "view",
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
  "filter",
]);

function sourceLocation(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) };
}

function addDiagnostic(
  context: BuildContext,
  element: ElementNode,
  code: string,
  message: string,
  css?: CSSDiagnosticContext,
): void {
  context.diagnostics.push({
    code,
    message,
    severity: "warning",
    source: sourceLocation(element),
    ...(css ? { css } : {}),
  });
}

function parsePaint(value: unknown, currentColor: string): Paint {
  const normalized = String(value ?? "none").trim();
  if (normalized.toLowerCase() === "none") return { type: "none" };
  if (normalized.toLowerCase() === "context-fill") return { type: "context", source: "fill" };
  if (normalized.toLowerCase() === "context-stroke") return { type: "context", source: "stroke" };
  if (normalized.toLowerCase() === "currentcolor") return { type: "solid", value: currentColor };
  const reference = /^url\(\s*#([^\s)]+)\s*\)(?:\s+(.+))?$/i.exec(normalized);
  if (reference) {
    const fallback = reference[2]?.trim();
    return {
      type: "reference",
      id: reference[1]!,
      ...(fallback ? { fallback: fallback.toLowerCase() === "currentcolor" ? currentColor : fallback } : {}),
    };
  }
  return { type: "solid", value: normalized };
}

function computedMarkerReference(
  value: unknown,
  property: "marker-start" | "marker-mid" | "marker-end",
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): MarkerReference | undefined {
  const normalized = String(value ?? "none").trim();
  if (normalized.toLowerCase() === "none") return undefined;
  const local = /^url\(\s*["']?#([^\s)"']+)["']?\s*\)$/i.exec(normalized);
  if (local) return { id: local[1]!, invalid: false };
  addDiagnostic(
    context,
    element,
    /^url\(/i.test(normalized) ? "external-marker-reference" : "invalid-marker-reference",
    `Only one local ${property} reference of the form url(#id) is supported; received '${normalized}'.`,
    css,
  );
  return { invalid: true };
}

function lengthValue(
  raw: unknown,
  coordinate: CoordinateContext,
  basis: PercentageBasis,
  axis: "horizontal" | "vertical" | "other",
  element: ElementNode,
  context: BuildContext,
  options: {
    fallback?: number;
    allowAuto?: boolean;
    auto?: number;
    negative?: "allow" | "reject" | "clamp-zero";
    label: string;
    css?: CSSDiagnosticContext;
  },
): number | undefined {
  try {
    const parsed = parseSVGLength(raw, { allowAuto: options.allowAuto });
    const resolved = resolveSVGLength(
      parsed,
      lengthContext(coordinate.viewport, coordinate.rootViewport, basis, axis, coordinate.fontMetrics),
    );
    let value = resolved === undefined ? options.fallback : resolved === "auto" ? options.auto : resolved;
    if (value === undefined) return undefined;
    if (value < 0 && options.negative !== "allow") {
      addDiagnostic(context, element, `negative-${options.label}`, `${options.label} cannot be negative.`, options.css);
      value = options.negative === "clamp-zero" ? 0 : undefined;
    }
    return value;
  } catch (error) {
    addDiagnostic(
      context,
      element,
      error instanceof SVGLengthError ? error.code : `invalid-${options.label}`,
      error instanceof Error ? error.message : String(error),
      options.css,
    );
    return options.fallback;
  }
}

function computedFontMetrics(
  inherited: Presentation,
  effective: Presentation,
  provenance: StyleResolution["provenance"],
  coordinate: CoordinateContext,
  element: ElementNode,
  context: BuildContext,
  isRoot = false,
): FontMetrics {
  const inheritedSize =
    typeof inherited["font-size"] === "number" ? inherited["font-size"] : coordinate.fontMetrics.fontSize;
  const fontCoordinate = { ...coordinate, fontMetrics: { ...coordinate.fontMetrics, fontSize: inheritedSize } };
  const fontSize =
    effective["font-size"] === undefined
      ? inheritedSize
      : (lengthValue(effective["font-size"], fontCoordinate, inheritedSize, "other", element, context, {
          fallback: inheritedSize,
          negative: "reject",
          label: "font-size",
          css: provenance["font-size"],
        }) ?? inheritedSize);
  if (fontSize === 0) addDiagnostic(context, element, "zero-font-size", "font-size must be greater than zero.");
  const validSize = fontSize > 0 ? fontSize : inheritedSize;
  return defaultFontMetrics(validSize, isRoot ? validSize : coordinate.fontMetrics.rootFontSize);
}

function plainNumber(
  value: unknown,
  fallback: number,
  label: string,
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): number {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  try {
    return parsePlainNumber(value, label);
  } catch (error) {
    addDiagnostic(
      context,
      element,
      error instanceof SVGLengthError ? error.code : `invalid-${label}`,
      String(error),
      css,
    );
    return fallback;
  }
}

function computedStrokeLineCap(
  value: unknown,
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): ComputedStyle["strokeStyle"]["lineCap"] {
  const normalized = String(value ?? "butt")
    .trim()
    .toLowerCase();
  if (normalized === "butt" || normalized === "round" || normalized === "square") return normalized;
  addDiagnostic(context, element, "invalid-stroke-linecap", `Invalid stroke-linecap '${normalized}'.`, css);
  return "butt";
}

function computedStrokeLineJoin(
  value: unknown,
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): ComputedStyle["strokeStyle"]["lineJoin"] {
  const normalized = String(value ?? "miter")
    .trim()
    .toLowerCase();
  if (normalized === "miter" || normalized === "round" || normalized === "bevel") return normalized;
  const code =
    normalized === "miter-clip" || normalized === "arcs" ? "unsupported-stroke-linejoin" : "invalid-stroke-linejoin";
  addDiagnostic(
    context,
    element,
    code,
    code === "unsupported-stroke-linejoin"
      ? `stroke-linejoin '${normalized}' is not representable by SwiftUI StrokeStyle; using miter.`
      : `Invalid stroke-linejoin '${normalized}'.`,
    css,
  );
  return "miter";
}

function computedMiterLimit(
  value: unknown,
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): number {
  const limit = plainNumber(value, 4, "stroke-miterlimit", element, context, css);
  if (limit >= 1) return limit;
  addDiagnostic(context, element, "invalid-stroke-miterlimit", "stroke-miterlimit must be at least 1.", css);
  return 4;
}

function computedVectorEffect(
  value: unknown,
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): ComputedStyle["strokeStyle"]["vectorEffect"] {
  const normalized = String(value ?? "none")
    .trim()
    .toLowerCase();
  if (normalized === "none" || normalized === "non-scaling-stroke") return normalized;
  addDiagnostic(
    context,
    element,
    "unsupported-vector-effect",
    `vector-effect '${normalized}' is outside the static SwiftUI profile; using none.`,
    css,
  );
  return "none";
}

const DEFAULT_PAINT_ORDER: readonly PaintOrderPhase[] = ["fill", "stroke", "markers"];

function computedPaintOrder(
  value: unknown,
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): readonly PaintOrderPhase[] {
  const normalized = String(value ?? "normal")
    .trim()
    .toLowerCase();
  if (normalized === "normal") return DEFAULT_PAINT_ORDER;
  const tokens = normalized.split(/\s+/);
  const valid = tokens.length > 0 && tokens.every((token) => DEFAULT_PAINT_ORDER.includes(token as PaintOrderPhase));
  if (!valid || new Set(tokens).size !== tokens.length) {
    addDiagnostic(
      context,
      element,
      "invalid-paint-order",
      `paint-order must contain distinct fill, stroke, and markers phases; received '${normalized}'.`,
      css,
    );
    return DEFAULT_PAINT_ORDER;
  }
  return [...(tokens as PaintOrderPhase[]), ...DEFAULT_PAINT_ORDER.filter((phase) => !tokens.includes(phase))];
}

function computedOpacity(
  value: unknown,
  property: "opacity" | "fill-opacity" | "stroke-opacity",
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): number {
  const normalized = String(value ?? 1).trim();
  const numeric = normalized.endsWith("%") ? normalized.slice(0, -1).trim() : normalized;
  if (numeric === "" || !Number.isFinite(Number(numeric))) {
    addDiagnostic(
      context,
      element,
      `invalid-${property}`,
      `${property} must be a number or percentage; received '${normalized}'.`,
      css,
    );
    return 1;
  }
  return parseOpacity(normalized);
}

const BLEND_MODES = new Set<SVGBlendMode>([
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

function computedBlendMode(
  value: unknown,
  element: ElementNode,
  context: BuildContext,
  css?: CSSDiagnosticContext,
): SVGBlendMode {
  const normalized = String(value ?? "normal")
    .trim()
    .toLowerCase() as SVGBlendMode;
  if (BLEND_MODES.has(normalized)) return normalized;
  addDiagnostic(context, element, "invalid-mix-blend-mode", `Invalid mix-blend-mode '${normalized}'.`, css);
  return "normal";
}

function computedMask(value: unknown, element: ElementNode, context: BuildContext, css?: CSSDiagnosticContext) {
  const normalized = String(value ?? "none").trim();
  if (normalized.toLowerCase() === "none") return undefined;
  const local = /^url\(\s*["']?#([^\s)"']+)["']?\s*\)$/i.exec(normalized);
  if (local) return { id: local[1]!, invalid: false };
  addDiagnostic(
    context,
    element,
    /^url\(/i.test(normalized) ? "external-mask-reference" : "invalid-mask-reference",
    `Only one local mask reference of the form url(#id) is supported; received '${normalized}'.`,
    css,
  );
  return { invalid: true };
}

function computedClipPath(value: unknown, element: ElementNode, context: BuildContext, css?: CSSDiagnosticContext) {
  const normalized = String(value ?? "none").trim();
  if (normalized.toLowerCase() === "none") return undefined;
  const local = /^url\(\s*["']?#([^\s)"']+)["']?\s*\)$/i.exec(normalized);
  if (local) return { id: local[1]!, invalid: false };

  let code = "invalid-clip-path-reference";
  if (/^url\(/i.test(normalized)) code = "external-clip-path-reference";
  else if (/^(?:circle|ellipse|inset|polygon|path|rect|xywh)\s*\(/i.test(normalized))
    code = "unsupported-clip-path-basic-shape";
  addDiagnostic(
    context,
    element,
    code,
    code === "unsupported-clip-path-basic-shape"
      ? `CSS basic-shape clip-path '${normalized}' is outside the current static profile; use a local <clipPath> URL.`
      : `Only one local clip-path reference of the form url(#id) is supported; received '${normalized}'.`,
    css,
  );
  return { invalid: true };
}

function computeStyle(
  effective: Presentation,
  provenance: StyleResolution["provenance"],
  coordinate: CoordinateContext,
  fontMetrics: FontMetrics,
  element: ElementNode,
  context: BuildContext,
  isLine = false,
): ComputedStyle {
  effective["font-size"] = fontMetrics.fontSize;
  const styleCoordinate = { ...coordinate, fontMetrics };
  const color = String(effective.color ?? "black");
  const fillRule = String(effective["fill-rule"] ?? effective.fillRule ?? "nonzero").toLowerCase();
  const clipRule = String(effective["clip-rule"] ?? "nonzero").toLowerCase();
  if (clipRule !== "nonzero" && clipRule !== "evenodd")
    addDiagnostic(context, element, "invalid-clip-rule", `Invalid clip-rule '${clipRule}'.`, provenance["clip-rule"]);
  const isolationValue = String(effective.isolation ?? "auto")
    .trim()
    .toLowerCase();
  if (isolationValue !== "auto" && isolationValue !== "isolate")
    addDiagnostic(
      context,
      element,
      "invalid-isolation",
      `Invalid isolation '${isolationValue}'.`,
      provenance.isolation,
    );
  const width =
    lengthValue(effective["stroke-width"], styleCoordinate, "viewport-diagonal", "other", element, context, {
      fallback: 1,
      negative: "reject",
      label: "stroke-width",
      css: provenance["stroke-width"],
    }) ?? 1;
  const dashOffset =
    lengthValue(effective["stroke-dashoffset"], styleCoordinate, "viewport-diagonal", "other", element, context, {
      fallback: 0,
      negative: "allow",
      label: "stroke-dashoffset",
      css: provenance["stroke-dashoffset"],
    }) ?? 0;

  let dashArray: number[] | undefined;
  const dashSource = effective["stroke-dasharray"];
  if (dashSource !== undefined && String(dashSource).trim().toLowerCase() !== "none") {
    const source = String(dashSource).trim();
    const malformedSeparators = source.length === 0 || /^\s*,|,\s*$|,\s*,/.test(source);
    if (malformedSeparators) {
      addDiagnostic(
        context,
        element,
        "invalid-stroke-dasharray",
        `Invalid stroke-dasharray '${source}'.`,
        provenance["stroke-dasharray"],
      );
    } else {
      const values = source.split(/[\s,]+/).filter(Boolean);
      const resolved = values.map((value) =>
        lengthValue(value, styleCoordinate, "viewport-diagonal", "other", element, context, {
          negative: "reject",
          label: "stroke-dasharray",
          css: provenance["stroke-dasharray"],
        }),
      );
      if (resolved.length > 0 && resolved.every((value): value is number => value !== undefined)) {
        if (resolved.some((value) => value !== 0)) {
          dashArray = resolved.length % 2 === 1 ? [...resolved, ...resolved] : resolved;
        }
      }
    }
  }
  const mask = computedMask(effective.mask, element, context, provenance.mask);
  const clipPath = computedClipPath(effective["clip-path"], element, context, provenance["clip-path"]);
  const markerStart = computedMarkerReference(
    effective["marker-start"],
    "marker-start",
    element,
    context,
    provenance["marker-start"],
  );
  const markerMid = computedMarkerReference(
    effective["marker-mid"],
    "marker-mid",
    element,
    context,
    provenance["marker-mid"],
  );
  const markerEnd = computedMarkerReference(
    effective["marker-end"],
    "marker-end",
    element,
    context,
    provenance["marker-end"],
  );
  const fill = parsePaint(effective.fill ?? "black", color);

  return {
    fill: isLine ? { type: "none" } : fill,
    ...(isLine ? { contextFill: fill } : {}),
    stroke: parsePaint(effective.stroke ?? "none", color),
    color,
    opacity: computedOpacity(effective.opacity, "opacity", element, context, provenance.opacity),
    fillOpacity: computedOpacity(
      effective["fill-opacity"],
      "fill-opacity",
      element,
      context,
      provenance["fill-opacity"],
    ),
    strokeOpacity: computedOpacity(
      effective["stroke-opacity"],
      "stroke-opacity",
      element,
      context,
      provenance["stroke-opacity"],
    ),
    ...(markerStart ? { markerStart } : {}),
    ...(markerMid ? { markerMid } : {}),
    ...(markerEnd ? { markerEnd } : {}),
    paintOrder: computedPaintOrder(effective["paint-order"], element, context, provenance["paint-order"]),
    fillRule: fillRule === "evenodd" ? "evenodd" : "nonzero",
    clipRule: clipRule === "evenodd" ? "evenodd" : "nonzero",
    display: String(effective.display ?? "inline")
      .trim()
      .toLowerCase(),
    visibility: String(effective.visibility ?? "visible")
      .trim()
      .toLowerCase(),
    ...(clipPath ? { clipPath } : {}),
    ...(mask ? { mask } : {}),
    blendMode: computedBlendMode(effective["mix-blend-mode"], element, context, provenance["mix-blend-mode"]),
    isolation: isolationValue === "isolate" ? "isolate" : "auto",
    strokeStyle: {
      width,
      lineCap: computedStrokeLineCap(effective["stroke-linecap"], element, context, provenance["stroke-linecap"]),
      lineJoin: computedStrokeLineJoin(effective["stroke-linejoin"], element, context, provenance["stroke-linejoin"]),
      miterLimit: computedMiterLimit(effective["stroke-miterlimit"], element, context, provenance["stroke-miterlimit"]),
      ...(dashArray ? { dashArray } : {}),
      dashOffset,
      vectorEffect: computedVectorEffect(effective["vector-effect"], element, context, provenance["vector-effect"]),
    },
    presentation: effective,
    provenance,
  };
}

function resolvedPresentation(
  element: ElementNode,
  inherited: Presentation,
  coordinate: CoordinateContext,
  context: BuildContext,
  isRoot = false,
): {
  effective: Presentation;
  fontMetrics: FontMetrics;
  style: ComputedStyle;
  provenance: StyleResolution["provenance"];
} {
  const resolution = context.styleResolver.resolve(element, inherited);
  const effective = resolution.values;
  const fontMetrics = computedFontMetrics(
    inherited,
    effective,
    resolution.provenance,
    coordinate,
    element,
    context,
    isRoot,
  );
  effective["font-size"] = fontMetrics.fontSize;
  return {
    effective,
    fontMetrics,
    style: computeStyle(
      effective,
      resolution.provenance,
      coordinate,
      fontMetrics,
      element,
      context,
      element.tagName === "line",
    ),
    provenance: resolution.provenance,
  };
}

function computedTransform(
  element: ElementNode,
  resolved: ReturnType<typeof resolvedPresentation>,
  context: BuildContext,
) {
  try {
    return parseTransform(resolved.effective.transform);
  } catch (error) {
    addDiagnostic(
      context,
      element,
      "invalid-transform",
      error instanceof Error ? error.message : String(error),
      resolved.provenance.transform,
    );
    return IDENTITY_TRANSFORM;
  }
}

function geometry(
  element: ElementNode,
  resolved: ReturnType<typeof resolvedPresentation>,
  coordinate: CoordinateContext,
  context: BuildContext,
): Geometry | undefined {
  const properties = element.properties ?? {};
  const value = (name: string) =>
    resolved.provenance[name] === undefined ? properties[name] : resolved.effective[name];
  const optional = (name: string) => (properties[name] === undefined ? {} : { [name]: String(properties[name]) });
  const horizontal = (name: string, fallback = 0, negative: "allow" | "reject" = "allow") =>
    lengthValue(value(name), coordinate, "viewport-width", "horizontal", element, context, {
      fallback,
      negative,
      label: name,
      css: resolved.provenance[name],
    });
  const vertical = (name: string, fallback = 0, negative: "allow" | "reject" = "allow") =>
    lengthValue(value(name), coordinate, "viewport-height", "vertical", element, context, {
      fallback,
      negative,
      label: name,
      css: resolved.provenance[name],
    });
  const other = (name: string, fallback = 0, negative: "allow" | "reject" = "allow") =>
    lengthValue(value(name), coordinate, "viewport-diagonal", "other", element, context, {
      fallback,
      negative,
      label: name,
      css: resolved.provenance[name],
    });

  switch (element.tagName) {
    case "path":
      return { type: "path", d: String(value("d") ?? ""), ...optional("pathLength") };
    case "circle": {
      const cx = horizontal("cx");
      const cy = vertical("cy");
      const r = other("r", 0, "reject");
      return cx === undefined || cy === undefined || r === undefined
        ? undefined
        : { type: "circle", cx, cy, r, ...optional("pathLength") };
    }
    case "ellipse": {
      const cx = horizontal("cx");
      const cy = vertical("cy");
      const rxRaw = value("rx");
      const ryRaw = value("ry");
      let rx =
        rxRaw === undefined || String(rxRaw).trim().toLowerCase() === "auto"
          ? undefined
          : horizontal("rx", 0, "reject");
      let ry =
        ryRaw === undefined || String(ryRaw).trim().toLowerCase() === "auto" ? undefined : vertical("ry", 0, "reject");
      if (rx === undefined && ry === undefined) rx = ry = 0;
      else if (rx === undefined) rx = ry;
      else if (ry === undefined) ry = rx;
      return cx === undefined || cy === undefined || rx === undefined || ry === undefined
        ? undefined
        : { type: "ellipse", cx, cy, rx, ry, ...optional("pathLength") };
    }
    case "rect": {
      const x = horizontal("x");
      const y = vertical("y");
      const width = horizontal("width", 0, "reject");
      const height = vertical("height", 0, "reject");
      if (x === undefined || y === undefined || width === undefined || height === undefined) return undefined;
      const rxRaw = value("rx");
      const ryRaw = value("ry");
      let rx =
        rxRaw === undefined || String(rxRaw).trim().toLowerCase() === "auto"
          ? undefined
          : horizontal("rx", 0, "reject");
      let ry =
        ryRaw === undefined || String(ryRaw).trim().toLowerCase() === "auto" ? undefined : vertical("ry", 0, "reject");
      if (rx === undefined && ry !== undefined) rx = ry;
      if (ry === undefined && rx !== undefined) ry = rx;
      if (rx !== undefined) rx = Math.min(rx, width / 2);
      if (ry !== undefined) ry = Math.min(ry, height / 2);
      return {
        type: "rect",
        x,
        y,
        width,
        height,
        ...(rx === undefined ? {} : { rx }),
        ...(ry === undefined ? {} : { ry }),
        ...optional("pathLength"),
      };
    }
    case "line": {
      const x1 = horizontal("x1");
      const y1 = vertical("y1");
      const x2 = horizontal("x2");
      const y2 = vertical("y2");
      return x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined
        ? undefined
        : { type: "line", x1, y1, x2, y2, ...optional("pathLength") };
    }
    case "polyline":
      return { type: "polyline", points: String(properties.points ?? ""), ...optional("pathLength") };
    case "polygon":
      return { type: "polygon", points: String(properties.points ?? ""), ...optional("pathLength") };
    default:
      return undefined;
  }
}

function createRegistry(root: ElementNode): ResourceRegistry {
  const registry: ResourceRegistry = {
    definitions: new Map(),
    parents: new Map(),
    symbols: new Map(),
    paints: new Map(),
    paintElements: new Map(),
    clips: new Map(),
    clipElements: new Map(),
    masks: new Map(),
    maskElements: new Map(),
    markers: new Map(),
    markerElements: new Map(),
    filters: new Map(),
    views: new Map(),
  };
  function visit(element: ElementNode): void {
    const idValue = element.properties?.id;
    if (idValue !== undefined) {
      const id = String(idValue);
      registry.definitions.set(id, element);
      if (element.tagName === "symbol") registry.symbols.set(id, element);
      if (element.tagName === "view") registry.views.set(id, element);
      if (["linearGradient", "radialGradient", "pattern"].includes(element.tagName ?? ""))
        registry.paintElements.set(id, element);
      if (element.tagName === "clipPath") registry.clipElements.set(id, element);
      if (element.tagName === "mask") registry.maskElements.set(id, element);
      if (element.tagName === "marker") registry.markerElements.set(id, element);
      if (element.tagName === "filter") registry.filters.set(id, element);
    }
    for (const child of element.children) {
      if (typeof child !== "string" && child.type === "element") {
        registry.parents.set(child, element);
        visit(child);
      }
    }
  }
  visit(root);
  return registry;
}

function childElements(element: ElementNode): ElementNode[] {
  return element.children.filter(
    (child): child is ElementNode => typeof child !== "string" && child.type === "element",
  );
}

function textContent(element: ElementNode): string {
  const decode = (value: string) =>
    value.replace(/&(?:#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos);/gi, (entity, decimal, hex) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      return ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" } as const)[
        entity.toLowerCase() as "&amp;"
      ];
    });
  return element.children
    .map((child) => {
      if (typeof child === "string") return decode(child);
      if (child.type === "text") return decode(String(child.value ?? ""));
      if (child.type === "element" && (child.tagName === "tspan" || child.tagName === "textPath"))
        return textContent(child);
      return "";
    })
    .join("");
}

function textLengths(
  value: unknown,
  axis: "horizontal" | "vertical" | "other",
  coordinate: CoordinateContext,
  fontMetrics: FontMetrics,
  element: ElementNode,
  context: BuildContext,
  label: string,
): number[] {
  if (value === undefined || value === null || String(value).trim() === "") return [];
  const tokens = String(value)
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  return tokens.map(
    (token) =>
      lengthValue(
        token,
        { ...coordinate, fontMetrics },
        axis === "horizontal" ? "viewport-width" : axis === "vertical" ? "viewport-height" : fontMetrics.fontSize,
        axis,
        element,
        context,
        { fallback: 0, negative: "allow", label },
      ) ?? 0,
  );
}

function textLengthValue(
  value: unknown,
  axis: "horizontal" | "vertical" | "other",
  coordinate: CoordinateContext,
  fontMetrics: FontMetrics,
  element: ElementNode,
  context: BuildContext,
  label: string,
  fallback = 0,
): number {
  return textLengths(value, axis, coordinate, fontMetrics, element, context, label)[0] ?? fallback;
}

function graphemes(value: string): string[] {
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locales?: string | string[],
        options?: { granularity: "grapheme" },
      ) => { segment(input: string): Iterable<{ segment: string }> };
    }
  ).Segmenter;
  if (Segmenter)
    return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value), (item) => item.segment);
  return Array.from(value);
}

function fontFamilies(value: unknown): string[] {
  return String(value ?? "sans-serif")
    .split(/,(?=(?:[^"']|"[^"]*"|'[^']*')*$)/)
    .map((family) => family.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2"))
    .filter(Boolean);
}

function resolveTextFamily(element: ElementNode, value: unknown, context: BuildContext): string {
  const requested = fontFamilies(value);
  const configured = context.config.fonts;
  const substitutions = new Map(
    Object.entries(configured?.substitutions ?? {}).map(([from, to]) => [from.toLowerCase(), to]),
  );
  const available = configured?.availableFamilies;
  const availableMap = new Map((available ?? []).map((family) => [family.toLowerCase(), family]));
  const generic: Record<string, string> = {
    "sans-serif": configured?.fallbackFamily ?? "Helvetica",
    serif: "Times New Roman",
    monospace: "Menlo",
    "system-ui": ".AppleSystemUIFont",
    cursive: "Apple Chancery",
    fantasy: "Papyrus",
  };
  for (const authored of requested) {
    const replacement = substitutions.get(authored.toLowerCase()) ?? authored;
    const mapped = generic[replacement.toLowerCase()] ?? replacement;
    if (!available || availableMap.has(mapped.toLowerCase())) return availableMap.get(mapped.toLowerCase()) ?? mapped;
  }
  const fallback = configured?.fallbackFamily ?? "Helvetica";
  const message = `None of the requested font families (${requested.join(", ")}) are configured; using ${fallback}.`;
  const source = sourceLocation(element);
  if (
    !context.diagnostics.some(
      (item) =>
        item.code === "missing-font-family" && item.source.element === source.element && item.source.id === source.id,
    )
  )
    context.diagnostics.push({
      code: "missing-font-family",
      message,
      severity: configured?.strict ? "error" : "warning",
      source,
    });
  return availableMap.get(fallback.toLowerCase()) ?? fallback;
}

function textNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fontWeight(value: unknown): number {
  const normalized = String(value ?? "normal")
    .trim()
    .toLowerCase();
  const named: Record<string, number> = { normal: 400, bold: 700, bolder: 700, lighter: 300 };
  const css = named[normalized] ?? textNumber(normalized, 400);
  return Math.max(1, Math.min(1000, css));
}

function fontWidth(value: unknown): number {
  const widths: Record<string, number> = {
    "ultra-condensed": 50,
    "extra-condensed": 62.5,
    condensed: 75,
    "semi-condensed": 87.5,
    normal: 100,
    "semi-expanded": 112.5,
    expanded: 125,
    "extra-expanded": 150,
    "ultra-expanded": 200,
  };
  return (
    widths[
      String(value ?? "normal")
        .trim()
        .toLowerCase()
    ] ?? 100
  );
}

function textBaseline(value: unknown): RenderTextRun["baseline"] {
  const normalized = String(value ?? "alphabetic")
    .trim()
    .toLowerCase();
  if (normalized === "middle" || normalized === "central" || normalized === "hanging") return normalized;
  if (normalized === "text-before-edge" || normalized === "before-edge" || normalized === "text-top")
    return "text-before-edge";
  if (normalized === "text-after-edge" || normalized === "after-edge" || normalized === "text-bottom")
    return "text-after-edge";
  return "alphabetic";
}

function buildText(
  element: ElementNode,
  resolved: ReturnType<typeof resolvedPresentation>,
  coordinate: CoordinateContext,
  context: BuildContext,
): RenderText {
  interface PositionScope {
    owner: ElementNode;
    x: number[];
    y: number[];
    dx: number[];
    dy: number[];
    rotate: number[];
    count: number;
  }
  interface LengthScope {
    owner: ElementNode;
    target: number;
    mode: RenderTextLengthAdjustment["mode"];
    characters: number[];
  }
  interface RawSegment {
    text: string;
    preserveSpace: boolean;
    scopes: PositionScope[];
    lengthScopes: LengthScope[];
    anchor: RenderTextChunk["anchor"];
    direction: RenderTextChunk["direction"];
    writingMode: RenderTextChunk["writingMode"];
    textPath?: RenderTextPath;
    run: Omit<RenderTextRun, "text" | "characters" | "dx" | "dy">;
  }
  interface FlatCharacter extends RenderTextCharacter {
    x?: number;
    y?: number;
    index: number;
    segment: RawSegment;
  }

  const rawSegments: RawSegment[] = [];
  const lengthScopes: LengthScope[] = [];
  const rootCoordinate = { ...coordinate, fontMetrics: resolved.fontMetrics };

  const rotations = (value: unknown, owner: ElementNode): number[] => {
    if (value === undefined || value === null || String(value).trim() === "") return [];
    return String(value)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((token) => {
        const result = Number(token);
        if (Number.isFinite(result)) return result;
        addDiagnostic(context, owner, "invalid-text-rotation", `Invalid rotate value '${token}'.`);
        return 0;
      });
  };

  const writingMode = (value: unknown): RenderTextChunk["writingMode"] => {
    const normalized = String(value ?? "horizontal-tb")
      .trim()
      .toLowerCase();
    if (normalized === "vertical-lr") return "vertical-lr";
    if (["vertical-rl", "tb", "tb-rl"].includes(normalized)) return "vertical-rl";
    return "horizontal-tb";
  };

  const textOrientation = (
    effective: Presentation,
    mode: RenderTextChunk["writingMode"],
  ): RenderTextRun["textOrientation"] => {
    if (mode === "horizontal-tb") return "mixed";
    const legacy = String(effective["glyph-orientation-vertical"] ?? "auto")
      .trim()
      .toLowerCase();
    if (legacy === "0" || legacy === "0deg") return "upright";
    if (legacy === "90" || legacy === "90deg") return "sideways";
    const value = String(effective["text-orientation"] ?? "mixed")
      .trim()
      .toLowerCase();
    return value === "upright" || value === "sideways" ? value : "mixed";
  };

  const unicodeBidi = (value: unknown): RenderTextRun["unicodeBidi"] => {
    const normalized = String(value ?? "normal")
      .trim()
      .toLowerCase();
    if (
      normalized === "embed" ||
      normalized === "isolate" ||
      normalized === "bidi-override" ||
      normalized === "isolate-override" ||
      normalized === "plaintext"
    )
      return normalized;
    return "normal";
  };

  const resolveTextPath = (
    owner: ElementNode,
    ownerResolved: ReturnType<typeof resolvedPresentation>,
    ownerCoordinate: CoordinateContext,
  ): RenderTextPath | undefined => {
    const props = owner.properties ?? {};
    let resolvedGeometry: Geometry | undefined;
    let matrix = IDENTITY_TRANSFORM;
    let directPathFailed = false;
    if (props.path !== undefined && String(props.path).trim() !== "") {
      try {
        const candidate: Geometry = { type: "path", d: String(props.path) };
        measureGeometryPath(candidate);
        resolvedGeometry = candidate;
      } catch (error) {
        directPathFailed = true;
        addDiagnostic(
          context,
          owner,
          "invalid-text-path-data",
          `Invalid textPath path data: ${error instanceof Error ? error.message : String(error)}.`,
        );
      }
    }
    if (!resolvedGeometry) {
      const href = props.href ?? props["xlink:href"];
      if (href === undefined || String(href).trim() === "") {
        addDiagnostic(
          context,
          owner,
          "missing-text-path-reference",
          directPathFailed
            ? "textPath path data is invalid and no fallback href was provided."
            : "textPath requires path data or a local href.",
        );
        return undefined;
      }
      const reference = String(href).trim();
      if (!reference.startsWith("#")) {
        addDiagnostic(
          context,
          owner,
          "external-text-path-reference",
          "textPath only supports local fragment references.",
        );
        return undefined;
      }
      const id = reference.slice(1);
      const target = context.resources.definitions.get(id);
      if (!target) {
        addDiagnostic(context, owner, "missing-text-path-target", `textPath references missing element #${id}.`);
        return undefined;
      }
      const seen = new Set<ElementNode>([owner]);
      let referenceCursor: ElementNode | undefined = target;
      while (referenceCursor?.tagName === "textPath") {
        if (seen.has(referenceCursor)) {
          addDiagnostic(context, owner, "cyclic-text-path-reference", `textPath reference #${id} is cyclic.`);
          return undefined;
        }
        seen.add(referenceCursor);
        const nestedHref = referenceCursor.properties?.href ?? referenceCursor.properties?.["xlink:href"];
        referenceCursor =
          nestedHref !== undefined && String(nestedHref).startsWith("#")
            ? context.resources.definitions.get(String(nestedHref).slice(1))
            : undefined;
      }
      if (!GEOMETRY_ELEMENTS.has(target.tagName ?? "")) {
        addDiagnostic(context, owner, "invalid-text-path-target", `textPath #${id} is not an SVG geometry element.`);
        return undefined;
      }
      const lineage: ElementNode[] = [];
      let parent = context.resources.parents.get(target);
      while (parent && parent.tagName !== "svg") {
        lineage.unshift(parent);
        parent = context.resources.parents.get(parent);
      }
      let inherited: Presentation = {};
      for (const ancestor of lineage) {
        const ancestorResolved = resolvedPresentation(ancestor, inherited, ownerCoordinate, context);
        matrix = multiplyTransforms(matrix, computedTransform(ancestor, ancestorResolved, context));
        inherited = ancestorResolved.effective;
      }
      const targetResolved = resolvedPresentation(target, inherited, ownerCoordinate, context);
      resolvedGeometry = geometry(
        target,
        targetResolved,
        { ...ownerCoordinate, fontMetrics: targetResolved.fontMetrics },
        context,
      );
      matrix = multiplyTransforms(matrix, computedTransform(target, targetResolved, context));
      if (!resolvedGeometry) return undefined;
    }

    try {
      const metrics = measureGeometryPath(resolvedGeometry, matrix);
      if (metrics.length <= 0 || metrics.points.length < 2) {
        addDiagnostic(context, owner, "empty-text-path", "textPath resolved to a zero-length path.");
        return undefined;
      }
      const rawOffset = String(props.startOffset ?? "0").trim();
      const percentage = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)%$/i.exec(rawOffset);
      const distanceScale = metrics.authoredLength ? metrics.length / metrics.authoredLength : 1;
      const startOffset = percentage
        ? (Number(percentage[1]) / 100) * metrics.length
        : textLengthValue(
            props.startOffset,
            "other",
            ownerCoordinate,
            ownerResolved.fontMetrics,
            owner,
            context,
            "startOffset",
          ) * distanceScale;
      const methodValue = String(props.method ?? "align").toLowerCase();
      const spacingValue = String(props.spacing ?? "exact").toLowerCase();
      const sideValue = String(props.side ?? "left").toLowerCase();
      if (methodValue !== "align" && methodValue !== "stretch")
        addDiagnostic(context, owner, "invalid-text-path-method", `Invalid textPath method '${methodValue}'.`);
      if (spacingValue !== "auto" && spacingValue !== "exact")
        addDiagnostic(context, owner, "invalid-text-path-spacing", `Invalid textPath spacing '${spacingValue}'.`);
      if (sideValue !== "left" && sideValue !== "right")
        addDiagnostic(context, owner, "invalid-text-path-side", `Invalid textPath side '${sideValue}'.`);
      return {
        points: metrics.points,
        length: metrics.length,
        closed: metrics.closed,
        distanceScale,
        startOffset,
        method: methodValue === "stretch" ? "stretch" : "align",
        spacing: spacingValue === "auto" ? "auto" : "exact",
        side: sideValue === "right" ? "right" : "left",
        source: sourceLocation(owner),
      };
    } catch (error) {
      addDiagnostic(
        context,
        owner,
        "invalid-text-path-geometry",
        `Unable to measure textPath geometry: ${error instanceof Error ? error.message : String(error)}.`,
      );
      return undefined;
    }
  };

  const visit = (
    owner: ElementNode,
    ownerResolved: ReturnType<typeof resolvedPresentation>,
    ownerCoordinate: CoordinateContext,
    transform: AffineTransform,
    inheritedPreserve: boolean,
    inheritedScopes: PositionScope[],
    inheritedLengthScopes: LengthScope[],
    inheritedPath?: RenderTextPath,
  ): void => {
    const props = owner.properties ?? {};
    const effective = ownerResolved.effective;
    const preserveSpace =
      props["xml:space"] === "preserve" ||
      (props["xml:space"] !== "default" &&
        (inheritedPreserve || ["pre", "pre-wrap", "break-spaces"].includes(String(effective["white-space"]))));
    const anchorValue = String(effective["text-anchor"] ?? "start").toLowerCase();
    const anchor: RenderTextChunk["anchor"] = anchorValue === "middle" || anchorValue === "end" ? anchorValue : "start";
    const mode = writingMode(effective["writing-mode"]);
    const direction: RenderTextChunk["direction"] = String(effective.direction).toLowerCase() === "rtl" ? "rtl" : "ltr";
    const scope: PositionScope = {
      owner,
      x:
        owner === element && props.x === undefined
          ? [0]
          : textLengths(props.x, "horizontal", ownerCoordinate, ownerResolved.fontMetrics, owner, context, "text-x"),
      y:
        owner === element && props.y === undefined
          ? [0]
          : textLengths(props.y, "vertical", ownerCoordinate, ownerResolved.fontMetrics, owner, context, "text-y"),
      dx: textLengths(props.dx, "horizontal", ownerCoordinate, ownerResolved.fontMetrics, owner, context, "text-dx"),
      dy: textLengths(props.dy, "vertical", ownerCoordinate, ownerResolved.fontMetrics, owner, context, "text-dy"),
      rotate: rotations(props.rotate, owner),
      count: 0,
    };
    const scopes = [...inheritedScopes, scope];
    const ownLength =
      props.textLength === undefined
        ? undefined
        : textLengthValue(
            props.textLength,
            mode === "horizontal-tb" ? "horizontal" : "vertical",
            ownerCoordinate,
            ownerResolved.fontMetrics,
            owner,
            context,
            "textLength",
            Number.NaN,
          );
    let ownLengthScope: LengthScope | undefined;
    if (ownLength !== undefined && Number.isFinite(ownLength)) {
      if (ownLength < 0) addDiagnostic(context, owner, "negative-text-length", "textLength cannot be negative.");
      else {
        const lengthAdjust = String(props.lengthAdjust ?? "spacing");
        if (lengthAdjust !== "spacing" && lengthAdjust !== "spacingAndGlyphs")
          addDiagnostic(context, owner, "invalid-length-adjust", `Invalid lengthAdjust '${lengthAdjust}'.`);
        ownLengthScope = {
          owner,
          target: ownLength,
          mode: lengthAdjust === "spacingAndGlyphs" ? "spacingAndGlyphs" : "spacing",
          characters: [],
        };
        lengthScopes.push(ownLengthScope);
      }
    }
    const activeLengthScopes = ownLengthScope ? [...inheritedLengthScopes, ownLengthScope] : inheritedLengthScopes;
    const textPath =
      owner.tagName === "textPath" ? resolveTextPath(owner, ownerResolved, ownerCoordinate) : inheritedPath;

    const size = ownerResolved.fontMetrics.fontSize;
    const spacing = (name: "letter-spacing" | "word-spacing") => {
      const raw = effective[name];
      return String(raw ?? "normal")
        .trim()
        .toLowerCase() === "normal"
        ? 0
        : textLengthValue(raw, "other", ownerCoordinate, ownerResolved.fontMetrics, owner, context, name);
    };
    const shiftRaw = String(effective["baseline-shift"] ?? "baseline")
      .trim()
      .toLowerCase();
    const baselineShift =
      shiftRaw === "sub"
        ? -0.2 * size
        : shiftRaw === "super"
          ? 0.4 * size
          : shiftRaw === "baseline"
            ? 0
            : textLengthValue(
                shiftRaw,
                "other",
                ownerCoordinate,
                ownerResolved.fontMetrics,
                owner,
                context,
                "baseline-shift",
              );
    const decorationValue = `${effective["text-decoration"] ?? ""} ${effective["text-decoration-line"] ?? ""}`;
    const decoration = (["underline", "overline", "line-through"] as const).filter((item) =>
      new RegExp(`(?:^|\\s)${item}(?:\\s|$)`).test(decorationValue),
    );
    const sizeAdjustRaw = String(effective["font-size-adjust"] ?? "none")
      .trim()
      .toLowerCase();
    const run: RawSegment["run"] = {
      font: {
        family: resolveTextFamily(owner, effective["font-family"], context),
        size,
        weight: fontWeight(effective["font-weight"]),
        width: fontWidth(effective["font-stretch"]),
        italic: ["italic", "oblique"].includes(String(effective["font-style"] ?? "normal").toLowerCase()),
        smallCaps: /small-caps/i.test(String(effective["font-variant"] ?? "normal")),
        ...(sizeAdjustRaw !== "none" && Number.isFinite(Number(sizeAdjustRaw))
          ? { sizeAdjust: Number(sizeAdjustRaw) }
          : {}),
      },
      letterSpacing: spacing("letter-spacing"),
      wordSpacing: spacing("word-spacing"),
      kerning: String(effective["font-kerning"] ?? "auto").toLowerCase() !== "none",
      baseline: textBaseline(effective["alignment-baseline"] ?? effective["dominant-baseline"]),
      baselineShift,
      decoration,
      direction,
      unicodeBidi: unicodeBidi(effective["unicode-bidi"]),
      textOrientation: textOrientation(effective, mode),
      style: ownerResolved.style,
      transform,
      source: sourceLocation(owner),
    };

    for (const child of owner.children) {
      if (typeof child !== "string" && child.type === "element") {
        if (child.tagName !== "tspan" && child.tagName !== "textPath") continue;
        if (child.tagName === "textPath" && inheritedPath)
          addDiagnostic(context, child, "nested-text-path", "A textPath cannot be nested inside another textPath.");
        const childResolved = resolvedPresentation(child, ownerResolved.effective, ownerCoordinate, context);
        visit(
          child,
          childResolved,
          { ...ownerCoordinate, fontMetrics: childResolved.fontMetrics },
          multiplyTransforms(transform, computedTransform(child, childResolved, context)),
          preserveSpace,
          scopes,
          activeLengthScopes,
          textPath,
        );
        continue;
      }
      const value = typeof child === "string" ? child : child.type === "text" ? String(child.value ?? "") : "";
      const decoded = textContent({ ...owner, children: [child] });
      if (!value && !decoded) continue;
      rawSegments.push({
        text: decoded,
        preserveSpace,
        scopes,
        lengthScopes: activeLengthScopes,
        anchor,
        direction,
        writingMode: mode,
        ...(textPath ? { textPath } : {}),
        run,
      });
    }
  };

  visit(element, resolved, rootCoordinate, IDENTITY_TRANSFORM, false, [], []);
  let previousCollapsedSpace = true;
  for (const segment of rawSegments) {
    if (segment.preserveSpace) {
      previousCollapsedSpace = /\s$/.test(segment.text);
      continue;
    }
    let normalized = segment.text.replace(/[\t\n\r ]+/g, " ");
    if (previousCollapsedSpace) normalized = normalized.replace(/^ /, "");
    previousCollapsedSpace = / $/.test(normalized);
    segment.text = normalized;
  }
  for (let index = rawSegments.length - 1; index >= 0; index--) {
    const segment = rawSegments[index]!;
    if (segment.preserveSpace) break;
    if (segment.text === "") continue;
    segment.text = segment.text.replace(/ $/, "");
    break;
  }

  const flat: FlatCharacter[] = [];
  const resolvedPosition = (scopes: PositionScope[], property: "x" | "y" | "dx" | "dy" | "rotate") => {
    for (let index = scopes.length - 1; index >= 0; index--) {
      const scope = scopes[index]!;
      const values = scope[property];
      if (values.length === 0) continue;
      if (property === "rotate") return values[Math.min(scope.count, values.length - 1)];
      if (scope.count < values.length) return values[scope.count];
    }
    return undefined;
  };
  for (const segment of rawSegments) {
    for (const text of graphemes(segment.text)) {
      const index = flat.length;
      const x = resolvedPosition(segment.scopes, "x");
      const y = resolvedPosition(segment.scopes, "y");
      const dx = resolvedPosition(segment.scopes, "dx") ?? 0;
      const dy = resolvedPosition(segment.scopes, "dy") ?? 0;
      const rotate = resolvedPosition(segment.scopes, "rotate") ?? 0;
      flat.push({
        text,
        dx,
        dy,
        rotate,
        ...(x === undefined ? {} : { x }),
        ...(y === undefined ? {} : { y }),
        index,
        segment,
      });
      for (const scope of segment.scopes) scope.count += 1;
      for (const scope of segment.lengthScopes) scope.characters.push(index);
    }
  }

  const chunks: RenderTextChunk[] = [];
  const chunkCharacters: FlatCharacter[][] = [];
  for (const character of flat) {
    const previousMembers = chunkCharacters[chunkCharacters.length - 1];
    const previous = previousMembers?.[previousMembers.length - 1];
    const startsChunk =
      !previous ||
      character.x !== undefined ||
      character.y !== undefined ||
      previous.segment.textPath !== character.segment.textPath ||
      previous.segment.anchor !== character.segment.anchor ||
      previous.segment.writingMode !== character.segment.writingMode;
    if (startsChunk) {
      chunks.push({
        ...(character.x === undefined ? {} : { x: character.x }),
        ...(character.y === undefined ? {} : { y: character.y }),
        anchor: character.segment.anchor,
        direction: character.segment.direction,
        writingMode: character.segment.writingMode,
        lengthAdjustments: [],
        ...(character.segment.textPath ? { textPath: character.segment.textPath } : {}),
        runs: [],
      });
      chunkCharacters.push([]);
    }
    const chunk = chunks[chunks.length - 1]!;
    const members = chunkCharacters[chunkCharacters.length - 1]!;
    members.push(character);
    const previousMember = members[members.length - 2];
    if (!previousMember || previousMember.segment !== character.segment) {
      chunk.runs.push({
        text: character.text,
        characters: [{ text: character.text, dx: character.dx, dy: character.dy, rotate: character.rotate }],
        dx: character.dx,
        dy: character.dy,
        ...character.segment.run,
      });
    } else {
      const run = chunk.runs[chunk.runs.length - 1]!;
      run.text += character.text;
      run.characters.push({ text: character.text, dx: character.dx, dy: character.dy, rotate: character.rotate });
    }
  }

  for (const scope of lengthScopes) {
    const total = scope.characters.length;
    if (total === 0) continue;
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const members = chunkCharacters[chunkIndex]!;
      const local = members
        .map((character, index) => (scope.characters.includes(character.index) ? index : -1))
        .filter((index) => index >= 0);
      if (local.length === 0) continue;
      chunks[chunkIndex]!.lengthAdjustments.push({
        start: Math.min(...local),
        end: Math.max(...local) + 1,
        target: scope.target * (local.length / total),
        mode: scope.mode,
      });
    }
  }

  return {
    type: "text",
    text: textContent(element),
    chunks,
    attributes: { ...(element.properties ?? {}) } as Record<string, string | number>,
    style: resolved.style,
    transform: computedTransform(element, resolved, context),
    source: sourceLocation(element),
    paintContext: {
      viewport: { ...coordinate.viewport },
      rootViewport: { ...coordinate.rootViewport },
      fontMetrics: { ...resolved.fontMetrics },
    },
  };
}

function buildImage(
  element: ElementNode,
  resolved: ReturnType<typeof resolvedPresentation>,
  coordinate: CoordinateContext,
  context: BuildContext,
): RenderImage {
  const properties = element.properties ?? {};
  const href = String(properties.href ?? properties["xlink:href"] ?? "").trim();
  let preserveAspectRatio = DEFAULT_PRESERVE_ASPECT_RATIO;
  try {
    preserveAspectRatio = parsePreserveAspectRatio(properties.preserveAspectRatio);
  } catch (error) {
    addDiagnostic(
      context,
      element,
      error instanceof SVGLengthError ? error.code : "invalid-preserve-aspect-ratio",
      error instanceof Error ? error.message : String(error),
    );
  }
  let imageResource: RenderImage["resource"];
  let intrinsicSize: { width: number; height: number } | undefined;

  if (!href) {
    addDiagnostic(context, element, "missing-image-resource", "Image href is empty or missing.");
  } else {
    const resolution = resolveResourceSync(href, "image", element, context.config);
    if ("failure" in resolution) {
      addDiagnostic(context, element, resolution.failure.code, resolution.failure.message);
    } else if (resolution.resource.mimeType === "image/svg+xml") {
      const state = resourceState(context.config);
      const limits = resourceLimits(context.config);
      const canonicalURL = resolution.resource.canonicalURL;
      if (state.activeCanonicalURLs.includes(canonicalURL)) {
        addDiagnostic(
          context,
          element,
          "recursive-svg-image",
          `Recursive SVG image cycle detected: ${[...state.activeCanonicalURLs, canonicalURL].join(" -> ")}.`,
        );
      } else if (state.depth + 1 > limits.maxNestingDepth) {
        addDiagnostic(
          context,
          element,
          "resource-nesting-limit",
          `SVG image '${href}' exceeds the nesting depth limit of ${limits.maxNestingDepth}.`,
        );
      } else if (!resolution.resource.bytes) {
        addDiagnostic(
          context,
          element,
          "svg-image-bytes-required",
          `SVG image '${href}' requires bytes; generated asset references are only supported for raster images.`,
        );
      } else {
        try {
          const ast = parse(decodeUTF8(resolution.resource.bytes));
          const svg = getSVGElement(ast);
          if (!svg) throw new Error("resource does not contain an svg root element");
          const childConfig: InternalGeneratorConfig = {
            ...context.config,
            fragment: undefined,
            outerViewport: undefined,
            __resourceState: state,
            __resourceBaseURL: canonicalURL,
          };
          const referencedProperties = resolveSVGProperties(svg, childConfig);
          const embeddedSVG: ElementNode = {
            ...svg,
            properties: { ...(svg.properties ?? {}), preserveAspectRatio: "none" },
          };
          const childProperties = resolveSVGProperties(embeddedSVG, childConfig);
          state.activeCanonicalURLs.push(canonicalURL);
          state.depth++;
          let document: RenderDocument;
          try {
            document = buildRenderDocument(
              embeddedSVG,
              childProperties.properties,
              childProperties.diagnostics,
              childConfig,
            );
          } finally {
            state.depth--;
            state.activeCanonicalURLs.pop();
          }
          intrinsicSize = { width: document.viewport.width, height: document.viewport.height };
          for (const diagnostic of document.diagnostics) {
            context.diagnostics.push({
              ...diagnostic,
              message: `SVG image '${href}': ${diagnostic.message}`,
            });
          }
          imageResource = {
            type: "svg",
            canonicalURL,
            document,
            referencedPreserveAspectRatio: referencedProperties.properties.preserveAspectRatio,
            hasReferencedPreserveAspectRatio: svg.properties?.preserveAspectRatio !== undefined,
          };
        } catch (error) {
          addDiagnostic(
            context,
            element,
            "malformed-svg-image",
            `SVG image '${href}' could not be parsed: ${error instanceof Error ? error.message : String(error)}.`,
          );
        }
      }
    } else {
      intrinsicSize = resolution.resource.intrinsicSize;
      imageResource = {
        type: "raster",
        ...(resolution.resource.bytes ? { bytes: resolution.resource.bytes } : {}),
        mimeType: resolution.resource.mimeType,
        canonicalURL: resolution.resource.canonicalURL,
        ...(resolution.resource.assetName ? { assetName: resolution.resource.assetName } : {}),
        ...(resolution.resource.intrinsicSize ? { intrinsicSize: resolution.resource.intrinsicSize } : {}),
      };
    }
  }

  const value = (name: string) =>
    resolved.provenance[name] === undefined ? properties[name] : resolved.effective[name];
  const dimension = (name: "width" | "height", axis: "horizontal" | "vertical") => {
    const raw = value(name);
    try {
      const parsed = parseSVGLength(raw, { allowAuto: true });
      if (parsed.kind === "missing" || parsed.kind === "auto") return undefined;
    } catch {}
    return lengthValue(
      raw,
      { ...coordinate, fontMetrics: resolved.fontMetrics },
      axis === "horizontal" ? "viewport-width" : "viewport-height",
      axis,
      element,
      context,
      { fallback: 0, negative: "reject", label: `image-${name}`, css: resolved.provenance[name] },
    );
  };
  let width = dimension("width", "horizontal");
  let height = dimension("height", "vertical");
  const ratio = intrinsicSize && intrinsicSize.height > 0 ? intrinsicSize.width / intrinsicSize.height : undefined;
  if (width === undefined && height === undefined) {
    width = intrinsicSize?.width;
    height = intrinsicSize?.height;
  } else if (width === undefined && height !== undefined && ratio) width = height * ratio;
  else if (height === undefined && width !== undefined && ratio) height = width / ratio;
  if (width === undefined || height === undefined) {
    addDiagnostic(
      context,
      element,
      "indeterminate-image-size",
      `Image '${href || "(missing)"}' needs explicit width and height when intrinsic dimensions are unavailable.`,
    );
    width ??= 0;
    height ??= 0;
  }
  if (width === 0 || height === 0)
    addDiagnostic(context, element, "zero-image-size", "An image with zero width or height renders nothing.");

  const x = lengthValue(
    value("x"),
    { ...coordinate, fontMetrics: resolved.fontMetrics },
    "viewport-width",
    "horizontal",
    element,
    context,
    { fallback: 0, negative: "allow", label: "image-x", css: resolved.provenance.x },
  )!;
  const y = lengthValue(
    value("y"),
    { ...coordinate, fontMetrics: resolved.fontMetrics },
    "viewport-height",
    "vertical",
    element,
    context,
    { fallback: 0, negative: "allow", label: "image-y", css: resolved.provenance.y },
  )!;
  return {
    type: "image",
    href,
    viewport: { x, y, width, height },
    preserveAspectRatio,
    imageRendering: String(resolved.effective["image-rendering"] ?? "auto")
      .trim()
      .toLowerCase(),
    ...(imageResource ? { resource: imageResource } : {}),
    attributes: { ...properties } as Record<string, string | number>,
    style: resolved.style,
    transform: computedTransform(element, resolved, context),
    source: sourceLocation(element),
    paintContext: {
      viewport: { ...coordinate.viewport },
      rootViewport: { ...coordinate.rootViewport },
      fontMetrics: { ...resolved.fontMetrics },
    },
  };
}

function buildForeignObject(
  element: ElementNode,
  resolved: ReturnType<typeof resolvedPresentation>,
  coordinate: CoordinateContext,
  context: BuildContext,
): RenderForeignObject {
  const viewport = viewportRect(element, coordinate, context, { width: 0, height: 0 }, resolved);
  const key = foreignObjectKey(element, context.resources.parents);
  const snapshot = foreignObjectSnapshotDocument(element, context.resources.parents, viewport, resolved.effective);
  const prepared = context.config.__foreignObjectSnapshots?.get(key);

  if (!context.config.__preparingForeignObjects && viewport.width > 0 && viewport.height > 0) {
    if (prepared) {
      for (const diagnostic of prepared.diagnostics)
        addDiagnostic(context, element, diagnostic.code, diagnostic.message);
    } else {
      addDiagnostic(
        context,
        element,
        "foreign-object-requires-async-conversion",
        "Static foreignObject content requires convertAsync() with a foreignObjectRenderer adapter; the content was omitted.",
      );
    }
  }

  const filter = String(resolved.effective.filter ?? "none").trim();
  if (!context.config.__preparingForeignObjects && filter.toLowerCase() !== "none")
    addDiagnostic(
      context,
      element,
      "foreign-object-filter-deferred",
      `foreignObject filter '${filter}' is retained for the filter runtime in issues #67-#71 but is not applied yet.`,
      resolved.provenance.filter,
    );

  return {
    type: "foreignObject",
    key,
    viewport,
    snapshotDocument: snapshot.document,
    ...(snapshot.accessibilityLabel ? { accessibilityLabel: snapshot.accessibilityLabel } : {}),
    snapshotScale: prepared?.scale ?? context.config.foreignObjects?.scale ?? 1,
    ...(prepared?.resource ? { resource: prepared.resource } : {}),
    filter,
    attributes: { ...(element.properties ?? {}) } as Record<string, string | number>,
    style: resolved.style,
    transform: computedTransform(element, resolved, context),
    source: sourceLocation(element),
    paintContext: {
      viewport: { ...coordinate.viewport },
      rootViewport: { ...coordinate.rootViewport },
      fontMetrics: { ...resolved.fontMetrics },
    },
  };
}

function safeViewBox(element: ElementNode, context: BuildContext): ViewBoxData | undefined {
  try {
    return parseViewBox(element.properties?.viewBox);
  } catch (error) {
    addDiagnostic(context, element, error instanceof SVGLengthError ? error.code : "invalid-viewbox", String(error));
    return undefined;
  }
}

function safePreserveAspectRatio(element: ElementNode, context: BuildContext) {
  try {
    return parsePreserveAspectRatio(element.properties?.preserveAspectRatio);
  } catch (error) {
    addDiagnostic(
      context,
      element,
      error instanceof SVGLengthError ? error.code : "invalid-preserve-aspect-ratio",
      String(error),
    );
    return DEFAULT_PRESERVE_ASPECT_RATIO;
  }
}

function viewportRect(
  host: ElementNode,
  coordinate: CoordinateContext,
  context: BuildContext,
  defaults?: { width?: number; height?: number },
  resolved?: ReturnType<typeof resolvedPresentation>,
): ViewBoxData {
  const properties = host.properties ?? {};
  const value = (name: string) =>
    resolved?.provenance[name] === undefined ? properties[name] : resolved.effective[name];
  const x =
    lengthValue(value("x"), coordinate, "viewport-width", "horizontal", host, context, {
      fallback: 0,
      negative: "allow",
      label: "x",
      css: resolved?.provenance.x,
    }) ?? 0;
  const y =
    lengthValue(value("y"), coordinate, "viewport-height", "vertical", host, context, {
      fallback: 0,
      negative: "allow",
      label: "y",
      css: resolved?.provenance.y,
    }) ?? 0;
  const width =
    lengthValue(value("width"), coordinate, "viewport-width", "horizontal", host, context, {
      fallback: defaults?.width ?? coordinate.viewport.width,
      allowAuto: true,
      auto: defaults?.width ?? coordinate.viewport.width,
      negative: "clamp-zero",
      label: "width",
      css: resolved?.provenance.width,
    }) ?? 0;
  const height =
    lengthValue(value("height"), coordinate, "viewport-height", "vertical", host, context, {
      fallback: defaults?.height ?? coordinate.viewport.height,
      allowAuto: true,
      auto: defaults?.height ?? coordinate.viewport.height,
      negative: "clamp-zero",
      label: "height",
      css: resolved?.provenance.height,
    }) ?? 0;
  return { x, y, width, height };
}

function buildGroup(
  element: ElementNode,
  inherited: Presentation,
  coordinate: CoordinateContext,
  context: BuildContext,
  transform?: AffineTransform,
  children = childElements(element),
  referenceId?: string,
): RenderGroup {
  const resolved = resolvedPresentation(element, inherited, coordinate, context);
  const childCoordinate = { ...coordinate, fontMetrics: resolved.fontMetrics };
  return {
    type: "group",
    children: children.flatMap((child) => buildNode(child, resolved.effective, childCoordinate, context)),
    style: resolved.style,
    transform: transform ?? computedTransform(element, resolved, context),
    source: sourceLocation(element),
    paintContext: {
      viewport: { ...coordinate.viewport },
      rootViewport: { ...coordinate.rootViewport },
      fontMetrics: { ...resolved.fontMetrics },
    },
    ...(referenceId ? { referenceId } : {}),
  };
}

function buildNestedSVG(
  element: ElementNode,
  inherited: Presentation,
  coordinate: CoordinateContext,
  context: BuildContext,
): RenderGroup {
  const resolved = resolvedPresentation(element, inherited, coordinate, context);
  const rect = viewportRect(element, coordinate, context, undefined, resolved);
  const viewBox = safeViewBox(element, context);
  const preserveAspectRatio = safePreserveAspectRatio(element, context);
  const outerTransform = computedTransform(element, resolved, context);
  const transform = multiplyTransforms(outerTransform, viewBoxTransform(viewBox, rect, preserveAspectRatio));
  const overflow = String(resolved.effective.overflow ?? "hidden").toLowerCase();
  const zeroSized = rect.width === 0 || rect.height === 0 || viewBox?.width === 0 || viewBox?.height === 0;
  const childCoordinate: CoordinateContext = {
    viewport: viewBox ? { width: viewBox.width, height: viewBox.height } : { width: rect.width, height: rect.height },
    rootViewport: coordinate.rootViewport,
    fontMetrics: resolved.fontMetrics,
  };
  return {
    type: "group",
    children: zeroSized
      ? []
      : childElements(element).flatMap((child) => buildNode(child, resolved.effective, childCoordinate, context)),
    style: resolved.style,
    transform,
    source: sourceLocation(element),
    paintContext: {
      viewport: { ...coordinate.viewport },
      rootViewport: { ...coordinate.rootViewport },
      fontMetrics: { ...resolved.fontMetrics },
    },
    viewport: {
      rect,
      ...(viewBox ? { viewBox } : {}),
      preserveAspectRatio,
      overflow,
      clip: overflow !== "visible",
      zeroSized,
      clipTransform: outerTransform,
    },
  };
}

function buildViewportUse(
  use: ElementNode,
  referenced: ElementNode,
  id: string,
  inherited: Presentation,
  coordinate: CoordinateContext,
  context: BuildContext,
  childContext: BuildContext,
): RenderGroup {
  const useResolved = resolvedPresentation(use, inherited, coordinate, context);
  const referencedResolved = resolvedPresentation(
    referenced,
    useResolved.effective,
    { ...coordinate, fontMetrics: useResolved.fontMetrics },
    context,
  );
  const viewBox = safeViewBox(referenced, context);
  const defaults = {
    width: viewBox?.width ?? coordinate.viewport.width,
    height: viewBox?.height ?? coordinate.viewport.height,
  };
  const rect = viewportRect(use, coordinate, context, defaults, useResolved);
  const preserveAspectRatio = safePreserveAspectRatio(referenced, context);
  const useTransform = computedTransform(use, useResolved, context);
  const referencedTransform = computedTransform(referenced, referencedResolved, context);
  const outerTransform = multiplyTransforms(useTransform, referencedTransform);
  const transform = multiplyTransforms(outerTransform, viewBoxTransform(viewBox, rect, preserveAspectRatio));
  const overflow = String(referencedResolved.effective.overflow ?? "hidden").toLowerCase();
  const zeroSized = rect.width === 0 || rect.height === 0 || viewBox?.width === 0 || viewBox?.height === 0;
  const childCoordinate: CoordinateContext = {
    viewport: viewBox ? { width: viewBox.width, height: viewBox.height } : { width: rect.width, height: rect.height },
    rootViewport: coordinate.rootViewport,
    fontMetrics: referencedResolved.fontMetrics,
  };
  const referencedGroup: RenderGroup = {
    type: "group",
    children: zeroSized
      ? []
      : childElements(referenced).flatMap((child) =>
          buildNode(child, referencedResolved.effective, childCoordinate, childContext),
        ),
    style: referencedResolved.style,
    transform: IDENTITY_TRANSFORM,
    source: sourceLocation(referenced),
    paintContext: {
      viewport: { ...childCoordinate.viewport },
      rootViewport: { ...childCoordinate.rootViewport },
      fontMetrics: { ...referencedResolved.fontMetrics },
    },
    referenceId: id,
  };
  return {
    type: "group",
    children: zeroSized ? [] : [referencedGroup],
    style: useResolved.style,
    transform,
    source: sourceLocation(use),
    paintContext: {
      viewport: { ...coordinate.viewport },
      rootViewport: { ...coordinate.rootViewport },
      fontMetrics: { ...useResolved.fontMetrics },
    },
    referenceId: id,
    viewport: {
      rect,
      ...(viewBox ? { viewBox } : {}),
      preserveAspectRatio,
      overflow,
      clip: overflow !== "visible",
      zeroSized,
      clipTransform: outerTransform,
    },
  };
}

function buildUse(
  element: ElementNode,
  inherited: Presentation,
  coordinate: CoordinateContext,
  context: BuildContext,
): RenderNode[] {
  const properties = element.properties ?? {};
  const href = properties.href ?? properties["xlink:href"];
  if (href === undefined || !String(href).startsWith("#")) throw new Error("<use> must reference a local element id.");
  const id = String(href).slice(1);
  const referenced = context.resources.definitions.get(id);
  if (!referenced) throw new Error(`<use> references missing element #${id}.`);
  if (context.activeReferences.has(id)) throw new Error(`<use> contains a circular reference to #${id}.`);
  const childContext = { ...context, activeReferences: new Set(context.activeReferences).add(id) };
  if (referenced.tagName === "symbol" || referenced.tagName === "svg") {
    return [buildViewportUse(element, referenced, id, inherited, coordinate, context, childContext)];
  }

  const resolved = resolvedPresentation(element, inherited, coordinate, context);
  const rect = viewportRect(element, coordinate, context, { width: 0, height: 0 }, resolved);
  const position = { ...IDENTITY_TRANSFORM, e: rect.x, f: rect.y };
  const transform = multiplyTransforms(computedTransform(element, resolved, context), position);
  return [
    {
      type: "group",
      children: buildNode(
        referenced,
        resolved.effective,
        { ...coordinate, fontMetrics: resolved.fontMetrics },
        childContext,
      ),
      style: resolved.style,
      transform,
      source: sourceLocation(element),
      paintContext: {
        viewport: { ...coordinate.viewport },
        rootViewport: { ...coordinate.rootViewport },
        fontMetrics: { ...resolved.fontMetrics },
      },
      referenceId: id,
    },
  ];
}

function buildNode(
  element: ElementNode,
  inherited: Presentation,
  coordinate: CoordinateContext,
  context: BuildContext,
): RenderNode[] {
  const tag = element.tagName ?? "unknown";
  if (NON_RENDERING_ELEMENTS.has(tag)) return [];
  if (tag === "use") return buildUse(element, inherited, coordinate, context);
  if (tag === "svg") return [buildNestedSVG(element, inherited, coordinate, context)];
  if (tag === "switch") {
    const first = childElements(element)[0];
    return [buildGroup(element, inherited, coordinate, context, undefined, first ? [first] : [])];
  }
  if (CONTAINER_ELEMENTS.has(tag)) return [buildGroup(element, inherited, coordinate, context)];

  const resolved = resolvedPresentation(element, inherited, coordinate, context);
  const transform = computedTransform(element, resolved, context);
  if (GEOMETRY_ELEMENTS.has(tag)) {
    const resolvedGeometry = geometry(element, resolved, { ...coordinate, fontMetrics: resolved.fontMetrics }, context);
    return resolvedGeometry
      ? [
          {
            type: "shape",
            geometry: resolvedGeometry,
            style: resolved.style,
            transform,
            source: sourceLocation(element),
            paintContext: {
              viewport: { ...coordinate.viewport },
              rootViewport: { ...coordinate.rootViewport },
              fontMetrics: { ...resolved.fontMetrics },
            },
          },
        ]
      : [];
  }
  if (tag === "text") {
    return [buildText(element, resolved, coordinate, context)];
  }
  if (tag === "image") {
    return [buildImage(element, resolved, coordinate, context)];
  }
  if (tag === "foreignObject") {
    return [buildForeignObject(element, resolved, coordinate, context)];
  }
  addDiagnostic(context, element, "unsupported-element", `Element <${tag}> is not supported by the current renderer.`);
  return [];
}

/** Build the semantic tree once. Both Swift output modes consume this exact document. */
export function buildRenderDocument(
  svg: ElementNode,
  properties: SVGElementProperties,
  initialDiagnostics: RenderDiagnostic[] = [],
  config: InternalGeneratorConfig = {},
): RenderDocument {
  const resources = createRegistry(svg);
  const diagnostics = [...initialDiagnostics];
  const styleResolver = new SVGStyleResolver(svg, diagnostics);
  const context: BuildContext = { resources, diagnostics, activeReferences: new Set(), styleResolver, config };
  const coordinate: CoordinateContext = {
    viewport: properties.userViewport,
    rootViewport: { width: properties.width, height: properties.height },
    fontMetrics: defaultFontMetrics(),
  };
  const resolved = resolvedPresentation(svg, {}, coordinate, context, true);
  resources.paints = resolvePaintServers(
    svg,
    resources.paintElements,
    resources.definitions,
    styleResolver,
    resolved.effective,
    diagnostics,
  );
  for (const [id, paint] of resolvePatternPaintServers(
    svg,
    resources.paintElements,
    resources.definitions,
    styleResolver,
    resolved.effective,
    diagnostics,
  )) {
    resources.paints.set(id, paint);
  }
  resources.masks = resolveMaskResources(svg, resources.maskElements, styleResolver, resolved.effective, diagnostics);
  resources.clips = resolveClipPathResources(
    svg,
    resources.clipElements,
    styleResolver,
    resolved.effective,
    diagnostics,
  );
  resources.markers = resolveMarkerResources(
    svg,
    resources.markerElements,
    styleResolver,
    resolved.effective,
    diagnostics,
  );
  const rootTransform = multiplyTransforms(computedTransform(svg, resolved, context), properties.viewBoxTransform);
  const childCoordinate = { ...coordinate, fontMetrics: resolved.fontMetrics };
  const root: RenderGroup = {
    type: "group",
    children: properties.zeroSized
      ? []
      : childElements(svg).flatMap((child) => buildNode(child, resolved.effective, childCoordinate, context)),
    style: resolved.style,
    transform: rootTransform,
    source: sourceLocation(svg),
    paintContext: {
      viewport: { ...coordinate.viewport },
      rootViewport: { ...coordinate.rootViewport },
      fontMetrics: { ...resolved.fontMetrics },
    },
  };
  const children: RenderNode[] = [root];

  function diagnoseMarkerOnce(node: RenderNode, code: string, message: string): void {
    if (
      diagnostics.some(
        (item) =>
          item.code === code &&
          item.source.element === node.source.element &&
          item.source.id === node.source.id &&
          item.message === message,
      )
    )
      return;
    diagnostics.push({ code, message, severity: "warning", source: node.source });
  }

  const translation = (x: number, y: number): AffineTransform => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
  const scaling = (value: number): AffineTransform => ({ a: value, b: 0, c: 0, d: value, e: 0, f: 0 });
  const rotation = (degrees: number): AffineTransform => {
    const radians = (degrees * Math.PI) / 180;
    return { a: Math.cos(radians), b: Math.sin(radians), c: -Math.sin(radians), d: Math.cos(radians), e: 0, f: 0 };
  };
  const transformedPoint = (matrix: AffineTransform, x: number, y: number) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  });

  function markerLength(
    resource: MarkerResource,
    shape: RenderShape,
    axis: "horizontal" | "vertical",
    fontMetrics: FontMetrics,
  ): number {
    const value = axis === "horizontal" ? resource.markerWidth : resource.markerHeight;
    const result = resolveSVGLength(
      value,
      lengthContext(
        shape.paintContext.viewport,
        shape.paintContext.rootViewport,
        axis === "horizontal" ? "viewport-width" : "viewport-height",
        axis,
        fontMetrics,
      ),
    );
    return typeof result === "number" ? result : 0;
  }

  function markerReferenceCoordinate(
    coordinateValue: MarkerRefCoordinate,
    axis: "horizontal" | "vertical",
    resource: MarkerResource,
    viewport: { width: number; height: number },
    shape: RenderShape,
    fontMetrics: FontMetrics,
  ): number {
    const source = resource.viewBox
      ? axis === "horizontal"
        ? { origin: resource.viewBox.x, size: resource.viewBox.width }
        : { origin: resource.viewBox.y, size: resource.viewBox.height }
      : { origin: 0, size: axis === "horizontal" ? viewport.width : viewport.height };
    if (coordinateValue.type === "keyword") {
      const ratio = coordinateValue.value === "min" ? 0 : coordinateValue.value === "center" ? 0.5 : 1;
      return source.origin + source.size * ratio;
    }
    const result = resolveSVGLength(
      coordinateValue.value,
      lengthContext(
        { width: source.size, height: source.size },
        shape.paintContext.rootViewport,
        source.size,
        axis,
        fontMetrics,
      ),
    );
    const resolvedValue = typeof result === "number" ? result : 0;
    return coordinateValue.value.unit === "%" ? source.origin + resolvedValue : resolvedValue;
  }

  function resolveContextPaint(paint: Paint, shape: RenderShape): Paint {
    if (paint.type !== "context") return paint;
    const resolvedPaint = paint.source === "fill" ? (shape.style.contextFill ?? shape.style.fill) : shape.style.stroke;
    return resolvedPaint.type === "context" ? { type: "none" } : resolvedPaint;
  }

  function resolveContextPaints(nodes: RenderNode[], shape: RenderShape): void {
    for (const node of nodes) {
      node.style = {
        ...node.style,
        fill: resolveContextPaint(node.style.fill, shape),
        stroke: resolveContextPaint(node.style.stroke, shape),
      };
      if (node.type === "group") resolveContextPaints(node.children, shape);
    }
  }

  function buildMarkerInstance(
    resource: MarkerResource,
    shape: RenderShape,
    kind: "start" | "mid" | "end",
    vertex: ReturnType<typeof markerVertices>[number],
    stack: string[],
  ): RenderGroup | undefined {
    const effective = { ...resource.presentation } as Presentation;
    const markerFontCoordinate: CoordinateContext = {
      viewport: { ...shape.paintContext.viewport },
      rootViewport: { ...shape.paintContext.rootViewport },
      fontMetrics: { ...shape.paintContext.fontMetrics },
    };
    const fontMetrics = computedFontMetrics(
      { "font-size": shape.paintContext.fontMetrics.fontSize },
      effective,
      resource.provenance,
      markerFontCoordinate,
      resource.element,
      context,
    );
    const width = markerLength(resource, shape, "horizontal", fontMetrics);
    const height = markerLength(resource, shape, "vertical", fontMetrics);
    if (width <= 0 || height <= 0 || resource.viewBox?.width === 0 || resource.viewBox?.height === 0) return undefined;

    const viewport = { width, height };
    const contentViewport = resource.viewBox
      ? { width: resource.viewBox.width, height: resource.viewBox.height }
      : viewport;
    const markerCoordinate: CoordinateContext = {
      viewport: contentViewport,
      rootViewport: { ...shape.paintContext.rootViewport },
      fontMetrics,
    };
    const resourceStyle = computeStyle(
      effective,
      resource.provenance,
      markerCoordinate,
      fontMetrics,
      resource.element,
      context,
    );
    const markerContext: BuildContext = {
      ...context,
      activeReferences: new Set(context.activeReferences).add(resource.id),
    };
    const built: RenderNode[] = [];
    for (const content of resource.contentElements) {
      try {
        built.push(...buildNode(content, effective, markerCoordinate, markerContext));
      } catch (error) {
        diagnoseMarkerOnce(
          shape,
          "invalid-marker-content-reference",
          `Marker #${resource.id} content could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    resolveContextPaints(built, shape);
    materializeMarkers(built, [...stack, resource.id]);

    const markerViewport = { x: 0, y: 0, width, height };
    const boxTransform = viewBoxTransform(resource.viewBox, markerViewport, resource.preserveAspectRatio);
    const ref = transformedPoint(
      boxTransform,
      markerReferenceCoordinate(resource.refX, "horizontal", resource, viewport, shape, fontMetrics),
      markerReferenceCoordinate(resource.refY, "vertical", resource, viewport, shape, fontMetrics),
    );
    const angle = orientedMarkerAngle(resource.orient, kind, vertex.angle);
    const unitScale = resource.units === "strokeWidth" ? shape.style.strokeStyle.width : 1;
    const placement = [
      translation(vertex.x, vertex.y),
      rotation(angle),
      scaling(unitScale),
      translation(-ref.x, -ref.y),
    ].reduce(multiplyTransforms);
    const group: RenderGroup = {
      type: "group",
      children: built,
      // display on the marker element is forced to none only for direct rendering;
      // referenced shadow content still consumes all other computed properties.
      style: { ...resourceStyle, display: "inline" },
      transform: multiplyTransforms(placement, boxTransform),
      source: resource.source,
      paintContext: {
        viewport: { ...contentViewport },
        rootViewport: { ...shape.paintContext.rootViewport },
        fontMetrics: { ...fontMetrics },
      },
      markerPlacement: {
        kind,
        x: vertex.x,
        y: vertex.y,
        angle,
        unitScale,
        refX: ref.x,
        refY: ref.y,
        viewBoxTransform: boxTransform,
      },
      viewport: {
        rect: markerViewport,
        ...(resource.viewBox ? { viewBox: resource.viewBox } : {}),
        preserveAspectRatio: resource.preserveAspectRatio,
        overflow: resource.overflow,
        clip: resource.overflow !== "visible",
        zeroSized: false,
        clipTransform: placement,
      },
    };
    if (resource.children.length === 0) resource.children = built;
    return group;
  }

  function materializeMarkers(nodes: RenderNode[], stack: string[] = []): void {
    for (const node of nodes) {
      if (node.type === "group") {
        materializeMarkers(node.children, stack);
        continue;
      }
      if (node.type !== "shape") continue;
      let vertices: ReturnType<typeof markerVertices>;
      try {
        vertices = markerVertices(node.geometry);
      } catch (error) {
        diagnoseMarkerOnce(
          node,
          "invalid-marker-geometry",
          `Marker vertices could not be computed: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      if (vertices.length === 0) continue;

      const requests: Array<{
        kind: "start" | "mid" | "end";
        reference: MarkerReference | undefined;
        vertex: (typeof vertices)[number];
      }> = [];
      if (vertices.length === 1) {
        requests.push(
          { kind: "start", reference: node.style.markerStart, vertex: vertices[0]! },
          { kind: "end", reference: node.style.markerEnd, vertex: vertices[0]! },
        );
      } else {
        requests.push({ kind: "start", reference: node.style.markerStart, vertex: vertices[0]! });
        for (let index = 1; index < vertices.length - 1; index++)
          requests.push({ kind: "mid", reference: node.style.markerMid, vertex: vertices[index]! });
        requests.push({
          kind: "end",
          reference: node.style.markerEnd,
          vertex: vertices[vertices.length - 1]!,
        });
      }

      const instances: RenderGroup[] = [];
      for (const request of requests) {
        const reference = request.reference;
        if (!reference || reference.invalid || !reference.id) continue;
        const id = reference.id;
        const resource = resources.markers.get(id);
        if (!resource) {
          const target = resources.definitions.get(id);
          diagnoseMarkerOnce(
            node,
            target ? "wrong-marker-resource-type" : "missing-marker-resource",
            target
              ? `Marker reference #${id} targets <${target.tagName}> instead of a marker.`
              : `Marker reference #${id} does not resolve to a local marker resource.`,
          );
          continue;
        }
        if (stack.includes(id)) {
          const cycle = [...stack.slice(stack.indexOf(id)), id];
          diagnoseMarkerOnce(
            node,
            "cyclic-marker-reference",
            `Marker cycle detected: ${cycle.map((item) => `#${item}`).join(" -> ")}.`,
          );
          continue;
        }
        const instance = buildMarkerInstance(resource, node, request.kind, request.vertex, stack);
        if (instance) instances.push(instance);
      }
      if (instances.length > 0) {
        node.markers = instances;
        for (const instance of instances) {
          const resource = resources.markers.get(instance.source.id ?? "");
          if (resource) resource.instances.set(node, [...(resource.instances.get(node) ?? []), instance]);
        }
      }
    }
  }
  materializeMarkers(children);

  function diagnosePatternOnce(pattern: PatternPaint, code: string, message: string): void {
    if (diagnostics.some((item) => item.code === code && item.source.id === pattern.id && item.message === message))
      return;
    diagnostics.push({ code, message, severity: "warning", source: pattern.source });
  }

  function buildPatternChildren(pattern: PatternPaint, shape: RenderShape): RenderNode[] {
    const viewport = pattern.viewBox
      ? { width: pattern.viewBox.width, height: pattern.viewBox.height }
      : pattern.contentUnits === "objectBoundingBox"
        ? { width: 1, height: 1 }
        : { ...shape.paintContext.viewport };
    const patternCoordinate: CoordinateContext = {
      viewport,
      rootViewport: { ...shape.paintContext.rootViewport },
      fontMetrics: { ...shape.paintContext.fontMetrics },
    };
    const patternContext: BuildContext = {
      ...context,
      activeReferences: new Set(context.activeReferences).add(pattern.id),
    };
    const built: RenderNode[] = [];
    for (const content of pattern.contentElements) {
      try {
        built.push(...buildNode(content, pattern.presentation as Presentation, patternCoordinate, patternContext));
      } catch (error) {
        pattern.invalid = true;
        const message = error instanceof Error ? error.message : String(error);
        diagnosePatternOnce(
          pattern,
          message.toLowerCase().includes("circular")
            ? "cyclic-pattern-use-reference"
            : "invalid-pattern-content-reference",
          `Pattern #${pattern.id} content could not be resolved: ${message}`,
        );
      }
    }
    materializeMarkers(built);
    return built;
  }

  function materializePattern(pattern: PatternPaint, shape: RenderShape, stack: PatternPaint[]): void {
    const cycleIndex = stack.findIndex((candidate) => candidate.id === pattern.id);
    if (cycleIndex >= 0) {
      const cycle = [...stack.slice(cycleIndex), pattern];
      for (const candidate of cycle) candidate.invalid = true;
      diagnosePatternOnce(
        pattern,
        "cyclic-pattern-content-reference",
        `Pattern paint cycle detected: ${cycle.map((candidate) => `#${candidate.id}`).join(" -> ")}.`,
      );
      return;
    }
    if (pattern.instances.has(shape)) return;

    const patternChildren = buildPatternChildren(pattern, shape);
    pattern.instances.set(shape, { children: patternChildren });
    if (pattern.children.length === 0) pattern.children = patternChildren;

    const visit = (nodes: RenderNode[]): void => {
      for (const node of nodes) {
        if (node.type === "group") {
          visit(node.children);
          continue;
        }
        if (node.type !== "shape") continue;
        if (node.markers) visit(node.markers);
        for (const paint of [node.style.fill, node.style.stroke]) {
          if (paint.type !== "reference") continue;
          const dependency = resources.paints.get(paint.id);
          if (dependency?.type === "pattern") materializePattern(dependency, node, [...stack, pattern]);
        }
      }
    };
    visit(patternChildren);
  }

  function materializeReferencedPatterns(nodes: RenderNode[]): void {
    for (const node of nodes) {
      if (node.type === "group") {
        materializeReferencedPatterns(node.children);
        continue;
      }
      if (node.type !== "shape") continue;
      if (node.markers) materializeReferencedPatterns(node.markers);
      for (const paint of [node.style.fill, node.style.stroke]) {
        if (paint.type !== "reference") continue;
        const pattern = resources.paints.get(paint.id);
        if (pattern?.type === "pattern") materializePattern(pattern, node, []);
      }
    }
  }
  materializeReferencedPatterns(children);

  function diagnoseClipOnce(node: RenderNode, code: string, message: string): void {
    if (
      diagnostics.some(
        (item) =>
          item.code === code &&
          item.source.element === node.source.element &&
          item.source.id === node.source.id &&
          item.message === message,
      )
    )
      return;
    diagnostics.push({ code, message, severity: "warning", source: node.source });
  }

  function emptyClip() {
    return {
      children: [],
      contentTransform: IDENTITY_TRANSFORM,
      invalid: true,
    };
  }

  function materializeClipPaths(nodes: RenderNode[], stack: string[] = []): void {
    for (const node of nodes) {
      if (node.type === "group") materializeClipPaths(node.children, stack);
      else if (node.type === "shape" && node.markers) materializeClipPaths(node.markers, stack);
      const reference = node.style.clipPath;
      if (!reference || reference.invalid || !reference.id) continue;
      const id = reference.id;
      const resource = resources.clips.get(id);
      if (!resource) {
        const target = resources.definitions.get(id);
        diagnoseClipOnce(
          node,
          target ? "wrong-clip-path-resource-type" : "missing-clip-path-resource",
          target
            ? `Clip-path reference #${id} targets <${target.tagName}> instead of a clipPath.`
            : `Clip-path reference #${id} does not resolve to a local clipPath resource.`,
        );
        // CSS Masking specifies that an invalid URI reference applies no clipping.
        // Strict conversion still fails because the diagnostic remains observable.
        continue;
      }
      if (stack.includes(id)) {
        const cycle = [...stack.slice(stack.indexOf(id)), id];
        diagnoseClipOnce(
          node,
          "cyclic-clip-path-reference",
          `Clip-path cycle detected: ${cycle.map((item) => `#${item}`).join(" -> ")}.`,
        );
        node.clipPath = emptyClip();
        continue;
      }

      const viewport =
        resource.units === "objectBoundingBox" ? { width: 1, height: 1 } : { ...node.paintContext.viewport };
      const effective = { ...resource.presentation } as Presentation;
      const inheritedFontSize = node.paintContext.fontMetrics.fontSize;
      const resourceFontSize = typeof effective["font-size"] === "number" ? effective["font-size"] : inheritedFontSize;
      const fontMetrics = defaultFontMetrics(resourceFontSize, node.paintContext.fontMetrics.rootFontSize);
      const clipCoordinate: CoordinateContext = {
        viewport,
        rootViewport: { ...node.paintContext.rootViewport },
        fontMetrics,
      };
      const resourceStyle = computeStyle(
        effective,
        resource.provenance,
        clipCoordinate,
        fontMetrics,
        resource.element,
        context,
      );
      const resourceResolved = {
        effective,
        fontMetrics,
        style: resourceStyle,
        provenance: resource.provenance,
      };
      const clipContext: BuildContext = {
        ...context,
        activeReferences: new Set(context.activeReferences).add(resource.id),
      };
      const built: RenderNode[] = [];
      for (const content of resource.contentElements) {
        try {
          built.push(...buildNode(content, effective, clipCoordinate, clipContext));
        } catch (error) {
          diagnoseClipOnce(
            node,
            "invalid-clip-path-content-reference",
            `ClipPath #${id} content could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      const rootGroup: RenderGroup = {
        type: "group",
        children: built,
        // display does not apply to the clipPath element itself. Other computed
        // properties still inherit normally into its graphics children.
        style: { ...resourceStyle, display: "inline" },
        transform: computedTransform(resource.element, resourceResolved, context),
        source: resource.source,
        paintContext: {
          viewport: { ...clipCoordinate.viewport },
          rootViewport: { ...clipCoordinate.rootViewport },
          fontMetrics: { ...fontMetrics },
        },
      };
      materializeMarkers([rootGroup]);
      materializeClipPaths([rootGroup], [...stack, id]);
      const instance = resolveClipPathInstance(resource, node, [rootGroup]);
      if (instance.invalid && resource.units === "objectBoundingBox")
        diagnoseClipOnce(
          node,
          "degenerate-clip-path-object-bounding-box",
          `ClipPath #${id} cannot resolve objectBoundingBox units against an empty or zero-sized target geometry.`,
        );
      resource.instances.set(node, instance);
      if (resource.children.length === 0) resource.children = [rootGroup];
      node.clipPath = instance;
    }
  }
  materializeClipPaths(children);
  for (const paint of resources.paints.values()) {
    if (paint.type !== "pattern") continue;
    for (const instance of paint.instances.values()) materializeClipPaths(instance.children);
  }

  function diagnoseMaskOnce(node: RenderNode, code: string, message: string): void {
    if (diagnostics.some((item) => item.code === code && item.source === node.source && item.message === message))
      return;
    diagnostics.push({ code, message, severity: "warning", source: node.source });
  }

  function transparentMask() {
    return {
      maskType: "alpha" as const,
      children: [],
      region: { x: 0, y: 0, width: 0, height: 0 },
      contentTransform: IDENTITY_TRANSFORM,
      invalid: true,
    };
  }

  function materializeMasks(nodes: RenderNode[], stack: string[] = []): void {
    for (const node of nodes) {
      if (node.type === "group") materializeMasks(node.children, stack);
      else if (node.type === "shape" && node.markers) materializeMasks(node.markers, stack);
      const reference = node.style.mask;
      if (!reference || reference.invalid || !reference.id) continue;
      const id = reference.id;
      const resource = resources.masks.get(id);
      if (!resource) {
        const target = resources.definitions.get(id);
        diagnoseMaskOnce(
          node,
          target ? "wrong-mask-resource-type" : "missing-mask-resource",
          target
            ? `Mask reference #${id} targets <${target.tagName}> instead of a mask.`
            : `Mask reference #${id} does not resolve to a local mask resource.`,
        );
        node.mask = transparentMask();
        continue;
      }
      if (stack.includes(id)) {
        const cycle = [...stack.slice(stack.indexOf(id)), id];
        diagnoseMaskOnce(
          node,
          "cyclic-mask-reference",
          `Mask cycle detected: ${cycle.map((item) => `#${item}`).join(" -> ")}.`,
        );
        node.mask = transparentMask();
        continue;
      }
      const viewport =
        resource.contentUnits === "objectBoundingBox" ? { width: 1, height: 1 } : { ...node.paintContext.viewport };
      const maskCoordinate: CoordinateContext = {
        viewport,
        rootViewport: { ...node.paintContext.rootViewport },
        fontMetrics: { ...node.paintContext.fontMetrics },
      };
      const maskContext: BuildContext = {
        ...context,
        activeReferences: new Set(context.activeReferences).add(resource.id),
      };
      const built: RenderNode[] = [];
      for (const content of resource.contentElements) {
        try {
          built.push(...buildNode(content, resource.presentation as Presentation, maskCoordinate, maskContext));
        } catch (error) {
          diagnoseMaskOnce(
            node,
            "invalid-mask-content-reference",
            `Mask #${id} content could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      materializeMarkers(built);
      materializeReferencedPatterns(built);
      materializeClipPaths(built);
      materializeMasks(built, [...stack, id]);
      const instance = resolveMaskInstance(resource, node, built);
      resource.instances.set(node, instance);
      if (resource.children.length === 0) resource.children = built;
      node.mask = instance;
    }
  }
  materializeMasks(children);

  function diagnosePaintReferences(nodes: RenderNode[]): void {
    for (const node of nodes) {
      if (node.type === "group") {
        diagnosePaintReferences(node.children);
        continue;
      }
      if (node.type !== "shape") continue;
      if (node.markers) diagnosePaintReferences(node.markers);
      for (const paint of [node.style.fill, node.style.stroke]) {
        if (paint.type !== "reference") continue;
        const server = resources.paints.get(paint.id);
        if (
          server?.type === "linearGradient" ||
          server?.type === "radialGradient" ||
          (server?.type === "pattern" && !server.invalid)
        )
          continue;
        const exists = resources.definitions.get(paint.id);
        diagnostics.push({
          code:
            server?.type === "pattern"
              ? "invalid-pattern-paint-server"
              : exists
                ? "wrong-paint-server-type"
                : "missing-paint-server",
          message:
            server?.type === "pattern"
              ? `Paint reference #${paint.id} targets an invalid pattern resource.`
              : exists
                ? `Paint reference #${paint.id} targets <${exists.tagName}> instead of a supported paint server.`
                : `Paint reference #${paint.id} does not resolve to a local resource.`,
          severity: "warning",
          source: node.source,
        });
      }
    }
  }
  diagnosePaintReferences(children);

  return {
    viewport: {
      width: properties.width,
      height: properties.height,
      viewBox: properties.viewBox,
      userViewport: properties.userViewport,
      preserveAspectRatio: properties.preserveAspectRatio,
      coordinateSpace: { x: 0, y: 0, width: properties.width, height: properties.height },
      zeroSized: properties.zeroSized,
    },
    resources,
    children,
    diagnostics,
  };
}
