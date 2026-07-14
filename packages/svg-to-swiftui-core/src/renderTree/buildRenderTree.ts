import type { ElementNode } from "svg-parser";
import { parseOpacity } from "../colorUtils";
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
import { type Presentation, type StyleResolution, SVGStyleResolver } from "../styleCascade";
import { type AffineTransform, IDENTITY_TRANSFORM, multiplyTransforms, parseTransform } from "../transformUtils";
import type { SVGElementProperties, ViewBoxData } from "../types";
import { DEFAULT_PRESERVE_ASPECT_RATIO, parsePreserveAspectRatio, parseViewBox, viewBoxTransform } from "../viewports";
import { resolveClipPathInstance, resolveClipPathResources } from "./clips";
import { resolvePaintServers } from "./gradients";
import { resolveMaskInstance, resolveMaskResources } from "./masks";
import { resolvePatternPaintServers } from "./patterns";
import type {
  ComputedStyle,
  CSSDiagnosticContext,
  Geometry,
  Paint,
  PaintOrderPhase,
  PatternPaint,
  RenderDiagnostic,
  RenderDocument,
  RenderGroup,
  RenderNode,
  RenderShape,
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
    const values = String(dashSource)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    const resolved = values.map((value) =>
      lengthValue(value, styleCoordinate, "viewport-diagonal", "other", element, context, {
        negative: "reject",
        label: "stroke-dasharray",
        css: provenance["stroke-dasharray"],
      }),
    );
    if (resolved.length > 0 && resolved.every((value): value is number => value !== undefined)) dashArray = resolved;
  }
  const mask = computedMask(effective.mask, element, context, provenance.mask);
  const clipPath = computedClipPath(effective["clip-path"], element, context, provenance["clip-path"]);

  return {
    fill: parsePaint(isLine ? "none" : (effective.fill ?? "black"), color),
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
      lineCap: String(effective["stroke-linecap"] ?? "butt"),
      lineJoin: String(effective["stroke-linejoin"] ?? "miter"),
      miterLimit: plainNumber(
        effective["stroke-miterlimit"],
        4,
        "stroke-miterlimit",
        element,
        context,
        provenance["stroke-miterlimit"],
      ),
      ...(dashArray ? { dashArray } : {}),
      dashOffset,
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
    symbols: new Map(),
    paints: new Map(),
    paintElements: new Map(),
    clips: new Map(),
    clipElements: new Map(),
    masks: new Map(),
    maskElements: new Map(),
    markers: new Map(),
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
      if (element.tagName === "marker") registry.markers.set(id, element);
      if (element.tagName === "filter") registry.filters.set(id, element);
    }
    for (const child of element.children) {
      if (typeof child !== "string" && child.type === "element") visit(child);
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
  return element.children
    .map((child) => (typeof child === "string" ? child : child.type === "text" ? child.value : ""))
    .join("");
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
    addDiagnostic(
      context,
      element,
      "unsupported-text-rendering",
      "Text is represented in the render tree but is not implemented by the SwiftUI backend yet.",
    );
    return [
      {
        type: "text",
        text: textContent(element),
        attributes: { ...(element.properties ?? {}) } as Record<string, string | number>,
        style: resolved.style,
        transform,
        source: sourceLocation(element),
        paintContext: {
          viewport: { ...coordinate.viewport },
          rootViewport: { ...coordinate.rootViewport },
          fontMetrics: { ...resolved.fontMetrics },
        },
      },
    ];
  }
  if (tag === "image") {
    const href = element.properties?.href ?? element.properties?.["xlink:href"] ?? "";
    addDiagnostic(context, element, "unsupported-image-rendering", "Image rendering is deferred to the image ticket.");
    return [
      {
        type: "image",
        href: String(href),
        attributes: { ...(element.properties ?? {}) } as Record<string, string | number>,
        style: resolved.style,
        transform,
        source: sourceLocation(element),
        paintContext: {
          viewport: { ...coordinate.viewport },
          rootViewport: { ...coordinate.rootViewport },
          fontMetrics: { ...resolved.fontMetrics },
        },
      },
    ];
  }
  addDiagnostic(context, element, "unsupported-element", `Element <${tag}> is not supported by the current renderer.`);
  return [];
}

/** Build the semantic tree once. Both Swift output modes consume this exact document. */
export function buildRenderDocument(
  svg: ElementNode,
  properties: SVGElementProperties,
  initialDiagnostics: RenderDiagnostic[] = [],
): RenderDocument {
  const resources = createRegistry(svg);
  const diagnostics = [...initialDiagnostics];
  const styleResolver = new SVGStyleResolver(svg, diagnostics);
  const context: BuildContext = { resources, diagnostics, activeReferences: new Set(), styleResolver };
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
