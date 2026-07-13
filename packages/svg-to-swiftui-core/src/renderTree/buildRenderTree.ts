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
import { filterStyleProps, parseStyle } from "../styleUtils";
import { getSVGTransform, IDENTITY_TRANSFORM, multiplyTransforms, parseTransform } from "../transformUtils";
import type { SVGElementProperties, ViewBoxData } from "../types";
import { DEFAULT_PRESERVE_ASPECT_RATIO, parsePreserveAspectRatio, parseViewBox, viewBoxTransform } from "../viewports";
import type {
  ComputedStyle,
  Geometry,
  Paint,
  RenderDiagnostic,
  RenderDocument,
  RenderGroup,
  RenderNode,
  ResourceRegistry,
  SourceLocation,
} from "./types";

type Presentation = Record<string, string | number>;

interface CoordinateContext {
  viewport: { width: number; height: number };
  rootViewport: { width: number; height: number };
  fontMetrics: FontMetrics;
}

interface BuildContext {
  resources: ResourceRegistry;
  diagnostics: RenderDiagnostic[];
  activeReferences: Set<string>;
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

function addDiagnostic(context: BuildContext, element: ElementNode, code: string, message: string): void {
  context.diagnostics.push({ code, message, severity: "warning", source: sourceLocation(element) });
}

function ownPresentation(element: ElementNode): Presentation {
  const properties = element.properties ?? {};
  const attributes = filterStyleProps(properties);
  const inline = typeof properties.style === "string" ? parseStyle(properties.style) : {};
  return { ...attributes, ...inline };
}

function inheritablePresentation(inherited: Presentation, own: Presentation): Presentation {
  const { transform: _transform, opacity: _opacity, ...inheritableOwn } = own;
  return { ...inherited, ...inheritableOwn };
}

function parsePaint(value: unknown, currentColor: string): Paint {
  const normalized = String(value ?? "none").trim();
  if (normalized.toLowerCase() === "none") return { type: "none" };
  if (normalized.toLowerCase() === "currentcolor") return { type: "solid", value: currentColor };
  const reference = /^url\(\s*#([^\s)]+)\s*\)(?:\s+(.+))?$/i.exec(normalized);
  if (reference) {
    return { type: "reference", id: reference[1]!, ...(reference[2] ? { fallback: reference[2].trim() } : {}) };
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
      addDiagnostic(context, element, `negative-${options.label}`, `${options.label} cannot be negative.`);
      value = options.negative === "clamp-zero" ? 0 : undefined;
    }
    return value;
  } catch (error) {
    addDiagnostic(
      context,
      element,
      error instanceof SVGLengthError ? error.code : `invalid-${options.label}`,
      error instanceof Error ? error.message : String(error),
    );
    return options.fallback;
  }
}

function computedFontMetrics(
  inherited: Presentation,
  own: Presentation,
  coordinate: CoordinateContext,
  element: ElementNode,
  context: BuildContext,
  isRoot = false,
): FontMetrics {
  const inheritedSize =
    typeof inherited["font-size"] === "number" ? inherited["font-size"] : coordinate.fontMetrics.fontSize;
  const fontCoordinate = { ...coordinate, fontMetrics: { ...coordinate.fontMetrics, fontSize: inheritedSize } };
  const fontSize =
    own["font-size"] === undefined
      ? inheritedSize
      : (lengthValue(own["font-size"], fontCoordinate, inheritedSize, "other", element, context, {
          fallback: inheritedSize,
          negative: "reject",
          label: "font-size",
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
): number {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  try {
    return parsePlainNumber(value, label);
  } catch (error) {
    addDiagnostic(context, element, error instanceof SVGLengthError ? error.code : `invalid-${label}`, String(error));
    return fallback;
  }
}

function computeStyle(
  inherited: Presentation,
  own: Presentation,
  coordinate: CoordinateContext,
  fontMetrics: FontMetrics,
  element: ElementNode,
  context: BuildContext,
  isLine = false,
): ComputedStyle {
  const effective = inheritablePresentation(inherited, own);
  effective["font-size"] = fontMetrics.fontSize;
  const styleCoordinate = { ...coordinate, fontMetrics };
  const color = String(effective.color ?? "black");
  const fillRule = String(effective["fill-rule"] ?? effective.fillRule ?? "nonzero").toLowerCase();
  const clipRule = String(effective["clip-rule"] ?? "nonzero").toLowerCase();
  const width =
    lengthValue(effective["stroke-width"], styleCoordinate, "viewport-diagonal", "other", element, context, {
      fallback: 1,
      negative: "reject",
      label: "stroke-width",
    }) ?? 1;
  const dashOffset =
    lengthValue(effective["stroke-dashoffset"], styleCoordinate, "viewport-diagonal", "other", element, context, {
      fallback: 0,
      negative: "allow",
      label: "stroke-dashoffset",
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
      }),
    );
    if (resolved.length > 0 && resolved.every((value): value is number => value !== undefined)) dashArray = resolved;
  }

  return {
    fill: parsePaint(isLine ? "none" : (effective.fill ?? "black"), color),
    stroke: parsePaint(effective.stroke ?? "none", color),
    color,
    opacity: parseOpacity(own.opacity),
    fillOpacity: parseOpacity(effective["fill-opacity"]),
    strokeOpacity: parseOpacity(effective["stroke-opacity"]),
    fillRule: fillRule === "evenodd" ? "evenodd" : "nonzero",
    clipRule: clipRule === "evenodd" ? "evenodd" : "nonzero",
    display: String(effective.display ?? "inline"),
    visibility: String(effective.visibility ?? "visible"),
    strokeStyle: {
      width,
      lineCap: String(effective["stroke-linecap"] ?? "butt"),
      lineJoin: String(effective["stroke-linejoin"] ?? "miter"),
      miterLimit: plainNumber(effective["stroke-miterlimit"], 4, "stroke-miterlimit", element, context),
      ...(dashArray ? { dashArray } : {}),
      dashOffset,
    },
    presentation: effective,
  };
}

function resolvedPresentation(
  element: ElementNode,
  inherited: Presentation,
  coordinate: CoordinateContext,
  context: BuildContext,
  isRoot = false,
): { own: Presentation; effective: Presentation; fontMetrics: FontMetrics; style: ComputedStyle } {
  const own = ownPresentation(element);
  const fontMetrics = computedFontMetrics(inherited, own, coordinate, element, context, isRoot);
  const effective = inheritablePresentation(inherited, own);
  effective["font-size"] = fontMetrics.fontSize;
  return {
    own,
    effective,
    fontMetrics,
    style: computeStyle(inherited, own, coordinate, fontMetrics, element, context),
  };
}

function geometry(element: ElementNode, coordinate: CoordinateContext, context: BuildContext): Geometry | undefined {
  const properties = element.properties ?? {};
  const optional = (name: string) => (properties[name] === undefined ? {} : { [name]: String(properties[name]) });
  const horizontal = (name: string, fallback = 0, negative: "allow" | "reject" = "allow") =>
    lengthValue(properties[name], coordinate, "viewport-width", "horizontal", element, context, {
      fallback,
      negative,
      label: name,
    });
  const vertical = (name: string, fallback = 0, negative: "allow" | "reject" = "allow") =>
    lengthValue(properties[name], coordinate, "viewport-height", "vertical", element, context, {
      fallback,
      negative,
      label: name,
    });
  const other = (name: string, fallback = 0, negative: "allow" | "reject" = "allow") =>
    lengthValue(properties[name], coordinate, "viewport-diagonal", "other", element, context, {
      fallback,
      negative,
      label: name,
    });

  switch (element.tagName) {
    case "path":
      return { type: "path", d: String(properties.d ?? ""), ...optional("pathLength") };
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
      const rxRaw = properties.rx;
      const ryRaw = properties.ry;
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
      const rxRaw = properties.rx;
      const ryRaw = properties.ry;
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
    clips: new Map(),
    masks: new Map(),
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
        registry.paints.set(id, element);
      if (element.tagName === "clipPath") registry.clips.set(id, element);
      if (element.tagName === "mask") registry.masks.set(id, element);
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
): ViewBoxData {
  const properties = host.properties ?? {};
  const x =
    lengthValue(properties.x, coordinate, "viewport-width", "horizontal", host, context, {
      fallback: 0,
      negative: "allow",
      label: "x",
    }) ?? 0;
  const y =
    lengthValue(properties.y, coordinate, "viewport-height", "vertical", host, context, {
      fallback: 0,
      negative: "allow",
      label: "y",
    }) ?? 0;
  const width =
    lengthValue(properties.width, coordinate, "viewport-width", "horizontal", host, context, {
      fallback: defaults?.width ?? coordinate.viewport.width,
      allowAuto: true,
      auto: defaults?.width ?? coordinate.viewport.width,
      negative: "clamp-zero",
      label: "width",
    }) ?? 0;
  const height =
    lengthValue(properties.height, coordinate, "viewport-height", "vertical", host, context, {
      fallback: defaults?.height ?? coordinate.viewport.height,
      allowAuto: true,
      auto: defaults?.height ?? coordinate.viewport.height,
      negative: "clamp-zero",
      label: "height",
    }) ?? 0;
  return { x, y, width, height };
}

function buildGroup(
  element: ElementNode,
  inherited: Presentation,
  coordinate: CoordinateContext,
  context: BuildContext,
  transform = parseTransform(getSVGTransform(element)),
  children = childElements(element),
  referenceId?: string,
): RenderGroup {
  const resolved = resolvedPresentation(element, inherited, coordinate, context);
  const childCoordinate = { ...coordinate, fontMetrics: resolved.fontMetrics };
  return {
    type: "group",
    children: children.flatMap((child) => buildNode(child, resolved.effective, childCoordinate, context)),
    style: resolved.style,
    transform,
    source: sourceLocation(element),
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
  const rect = viewportRect(element, coordinate, context);
  const viewBox = safeViewBox(element, context);
  const preserveAspectRatio = safePreserveAspectRatio(element, context);
  const outerTransform = parseTransform(getSVGTransform(element));
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
  const referencedOwn = ownPresentation(referenced);
  const referencedMetrics = computedFontMetrics(
    useResolved.effective,
    referencedOwn,
    { ...coordinate, fontMetrics: useResolved.fontMetrics },
    referenced,
    context,
  );
  const effective = inheritablePresentation(useResolved.effective, referencedOwn);
  effective["font-size"] = referencedMetrics.fontSize;
  const viewBox = safeViewBox(referenced, context);
  const defaults = {
    width: viewBox?.width ?? coordinate.viewport.width,
    height: viewBox?.height ?? coordinate.viewport.height,
  };
  const rect = viewportRect(use, coordinate, context, defaults);
  const preserveAspectRatio = safePreserveAspectRatio(referenced, context);
  const useTransform = parseTransform(getSVGTransform(use));
  const referencedTransform = parseTransform(getSVGTransform(referenced));
  const outerTransform = multiplyTransforms(useTransform, referencedTransform);
  const transform = multiplyTransforms(outerTransform, viewBoxTransform(viewBox, rect, preserveAspectRatio));
  const overflow = String(effective.overflow ?? "hidden").toLowerCase();
  const zeroSized = rect.width === 0 || rect.height === 0 || viewBox?.width === 0 || viewBox?.height === 0;
  const childCoordinate: CoordinateContext = {
    viewport: viewBox ? { width: viewBox.width, height: viewBox.height } : { width: rect.width, height: rect.height },
    rootViewport: coordinate.rootViewport,
    fontMetrics: referencedMetrics,
  };
  return {
    type: "group",
    children: zeroSized
      ? []
      : childElements(referenced).flatMap((child) => buildNode(child, effective, childCoordinate, childContext)),
    style: useResolved.style,
    transform,
    source: sourceLocation(use),
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
  const rect = viewportRect(element, coordinate, context, { width: 0, height: 0 });
  const position = { ...IDENTITY_TRANSFORM, e: rect.x, f: rect.y };
  const transform = multiplyTransforms(parseTransform(getSVGTransform(element)), position);
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
    return [
      buildGroup(
        element,
        inherited,
        coordinate,
        context,
        parseTransform(getSVGTransform(element)),
        first ? [first] : [],
      ),
    ];
  }
  if (CONTAINER_ELEMENTS.has(tag)) return [buildGroup(element, inherited, coordinate, context)];

  const resolved = resolvedPresentation(element, inherited, coordinate, context);
  const transform = parseTransform(getSVGTransform(element));
  if (GEOMETRY_ELEMENTS.has(tag)) {
    const resolvedGeometry = geometry(element, { ...coordinate, fontMetrics: resolved.fontMetrics }, context);
    return resolvedGeometry
      ? [
          {
            type: "shape",
            geometry: resolvedGeometry,
            style: resolved.style,
            transform,
            source: sourceLocation(element),
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
  const context: BuildContext = { resources, diagnostics, activeReferences: new Set() };
  const coordinate: CoordinateContext = {
    viewport: properties.userViewport,
    rootViewport: { width: properties.width, height: properties.height },
    fontMetrics: defaultFontMetrics(),
  };
  const resolved = resolvedPresentation(svg, {}, coordinate, context, true);
  const rootTransform = multiplyTransforms(parseTransform(getSVGTransform(svg)), properties.viewBoxTransform);
  const childCoordinate = { ...coordinate, fontMetrics: resolved.fontMetrics };
  const root: RenderGroup = {
    type: "group",
    children: properties.zeroSized
      ? []
      : childElements(svg).flatMap((child) => buildNode(child, resolved.effective, childCoordinate, context)),
    style: resolved.style,
    transform: rootTransform,
    source: sourceLocation(svg),
  };
  const children: RenderNode[] = [root];

  function diagnosePaintReferences(nodes: RenderNode[]): void {
    for (const node of nodes) {
      if (node.type === "group") {
        diagnosePaintReferences(node.children);
        continue;
      }
      if (node.type !== "shape") continue;
      for (const paint of [node.style.fill, node.style.stroke]) {
        if (paint.type !== "reference") continue;
        diagnostics.push({
          code: "unsupported-paint-reference",
          message: `Paint server #${paint.id} is represented but is not implemented by the SwiftUI backend yet.`,
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
