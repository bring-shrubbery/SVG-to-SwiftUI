import type { ElementNode } from "svg-parser";
import { parseOpacity } from "../colorUtils";
import { filterStyleProps, parseStyle } from "../styleUtils";
import {
  type AffineTransform,
  getSVGTransform,
  IDENTITY_TRANSFORM,
  multiplyTransforms,
  parseTransform,
} from "../transformUtils";
import type { SVGElementProperties } from "../types";
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

const GEOMETRY_ELEMENTS = new Set(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
const CONTAINER_ELEMENTS = new Set(["svg", "g", "a"]);
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
  "filter",
]);

function sourceLocation(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) };
}

function ownPresentation(element: ElementNode): Presentation {
  const properties = element.properties ?? {};
  const attributes = filterStyleProps(properties);
  const inline = typeof properties.style === "string" ? parseStyle(properties.style) : {};
  return { ...attributes, ...inline };
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

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeStyle(inherited: Presentation, own: Presentation, isLine = false): ComputedStyle {
  const { transform: _transform, opacity: ownOpacity, ...inheritableOwn } = own;
  const effective = { ...inherited, ...inheritableOwn };
  const color = String(effective.color ?? "black");
  const fillRule = String(effective["fill-rule"] ?? effective.fillRule ?? "nonzero").toLowerCase();
  const clipRule = String(effective["clip-rule"] ?? "nonzero").toLowerCase();
  const dashArrayValue = effective["stroke-dasharray"];
  const dashArray =
    dashArrayValue === undefined || String(dashArrayValue).trim().toLowerCase() === "none"
      ? undefined
      : String(dashArrayValue)
          .trim()
          .split(/[\s,]+/)
          .map(Number)
          .filter(Number.isFinite);

  return {
    fill: parsePaint(isLine ? "none" : (effective.fill ?? "black"), color),
    stroke: parsePaint(effective.stroke ?? "none", color),
    color,
    opacity: parseOpacity(ownOpacity),
    fillOpacity: parseOpacity(effective["fill-opacity"]),
    strokeOpacity: parseOpacity(effective["stroke-opacity"]),
    fillRule: fillRule === "evenodd" ? "evenodd" : "nonzero",
    clipRule: clipRule === "evenodd" ? "evenodd" : "nonzero",
    display: String(effective.display ?? "inline"),
    visibility: String(effective.visibility ?? "visible"),
    strokeStyle: {
      width: finiteNumber(effective["stroke-width"], 1),
      lineCap: String(effective["stroke-linecap"] ?? "butt"),
      lineJoin: String(effective["stroke-linejoin"] ?? "miter"),
      miterLimit: finiteNumber(effective["stroke-miterlimit"], 4),
      ...(dashArray && dashArray.length > 0 ? { dashArray } : {}),
      dashOffset: finiteNumber(effective["stroke-dashoffset"], 0),
    },
    presentation: effective,
  };
}

function geometry(element: ElementNode): Geometry {
  const properties = element.properties ?? {};
  const value = (name: string, fallback = "0") => String(properties[name] ?? fallback);
  const optional = (name: string) => (properties[name] === undefined ? {} : { [name]: String(properties[name]) });

  switch (element.tagName) {
    case "path":
      return { type: "path", d: value("d", ""), ...optional("pathLength") };
    case "circle":
      return { type: "circle", cx: value("cx"), cy: value("cy"), r: value("r"), ...optional("pathLength") };
    case "ellipse":
      return {
        type: "ellipse",
        cx: value("cx"),
        cy: value("cy"),
        rx: value("rx"),
        ry: value("ry"),
        ...optional("pathLength"),
      };
    case "rect":
      return {
        type: "rect",
        x: value("x"),
        y: value("y"),
        width: value("width", ""),
        height: value("height", ""),
        ...optional("rx"),
        ...optional("ry"),
        ...optional("pathLength"),
      };
    case "line":
      return {
        type: "line",
        x1: value("x1"),
        y1: value("y1"),
        x2: value("x2"),
        y2: value("y2"),
        ...optional("pathLength"),
      };
    case "polyline":
      return { type: "polyline", points: value("points", ""), ...optional("pathLength") };
    case "polygon":
      return { type: "polygon", points: value("points", ""), ...optional("pathLength") };
    default:
      throw new Error(`Cannot create geometry for <${element.tagName}>.`);
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
  };

  function visit(element: ElementNode): void {
    const idValue = element.properties?.id;
    if (idValue !== undefined) {
      const id = String(idValue);
      registry.definitions.set(id, element);
      if (element.tagName === "symbol") registry.symbols.set(id, element);
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

function parseViewBox(value: unknown) {
  if (value === undefined) return undefined;
  const values = String(value)
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (values.length !== 4 || values.some((number) => !Number.isFinite(number))) return undefined;
  return { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! };
}

function symbolViewportTransform(use: ElementNode, symbol: ElementNode): AffineTransform {
  const viewBox = parseViewBox(symbol.properties?.viewBox);
  if (!viewBox) return IDENTITY_TRANSFORM;
  const properties = use.properties ?? {};
  const x = finiteNumber(properties.x, 0);
  const y = finiteNumber(properties.y, 0);
  const width = finiteNumber(properties.width, viewBox.width);
  const height = finiteNumber(properties.height, viewBox.height);
  const preserveAspectRatio = String(symbol.properties?.preserveAspectRatio ?? "xMidYMid meet").trim();

  if (preserveAspectRatio === "none") {
    const scaleX = width / viewBox.width;
    const scaleY = height / viewBox.height;
    return { a: scaleX, b: 0, c: 0, d: scaleY, e: x - viewBox.x * scaleX, f: y - viewBox.y * scaleY };
  }

  const scale = /\bslice\b/.test(preserveAspectRatio)
    ? Math.max(width / viewBox.width, height / viewBox.height)
    : Math.min(width / viewBox.width, height / viewBox.height);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const xAlignment = preserveAspectRatio.includes("xMin") ? 0 : preserveAspectRatio.includes("xMax") ? 1 : 0.5;
  const yAlignment = preserveAspectRatio.includes("YMin") ? 0 : preserveAspectRatio.includes("YMax") ? 1 : 0.5;
  return {
    a: scale,
    b: 0,
    c: 0,
    d: scale,
    e: x + (width - renderedWidth) * xAlignment - viewBox.x * scale,
    f: y + (height - renderedHeight) * yAlignment - viewBox.y * scale,
  };
}

interface BuildContext {
  resources: ResourceRegistry;
  diagnostics: RenderDiagnostic[];
  activeReferences: Set<string>;
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

function buildGroup(
  element: ElementNode,
  inherited: Presentation,
  context: BuildContext,
  transform = parseTransform(getSVGTransform(element)),
  children = childElements(element),
  referenceId?: string,
): RenderGroup {
  const own = ownPresentation(element);
  const { transform: _transform, opacity: _opacity, ...inheritableOwn } = own;
  const effective = { ...inherited, ...inheritableOwn };
  const style = computeStyle(inherited, own);
  return {
    type: "group",
    children: children.flatMap((child) => buildNode(child, effective, context)),
    style,
    transform,
    source: sourceLocation(element),
    ...(referenceId ? { referenceId } : {}),
  };
}

function buildUse(element: ElementNode, inherited: Presentation, context: BuildContext): RenderNode[] {
  const properties = element.properties ?? {};
  const href = properties.href ?? properties["xlink:href"];
  if (href === undefined || !String(href).startsWith("#")) {
    throw new Error("<use> must reference a local element id with href or xlink:href.");
  }
  const id = String(href).slice(1);
  const referenced = context.resources.definitions.get(id);
  if (!referenced) throw new Error(`<use> references missing element #${id}.`);
  if (context.activeReferences.has(id)) throw new Error(`<use> contains a circular reference to #${id}.`);

  const own = ownPresentation(element);
  const { transform: _transform, opacity: _opacity, ...inheritableOwn } = own;
  const useInherited = { ...inherited, ...inheritableOwn };
  const activeReferences = new Set(context.activeReferences).add(id);
  const childContext = { ...context, activeReferences };
  const isViewportReference = referenced.tagName === "symbol" || referenced.tagName === "svg";
  const position = isViewportReference
    ? symbolViewportTransform(element, referenced)
    : {
        ...IDENTITY_TRANSFORM,
        e: finiteNumber(properties.x, 0),
        f: finiteNumber(properties.y, 0),
      };
  const transform = multiplyTransforms(parseTransform(getSVGTransform(element)), position);
  const referencedChildren = isViewportReference ? childElements(referenced) : [referenced];
  const referencedOwn = isViewportReference ? ownPresentation(referenced) : {};
  const { opacity: _referencedOpacity, transform: _referencedTransform, ...referencedInherited } = referencedOwn;
  const effective = { ...useInherited, ...referencedInherited };
  const style = computeStyle(inherited, own);

  return [
    {
      type: "group",
      children: referencedChildren.flatMap((child) => buildNode(child, effective, childContext)),
      style,
      transform,
      source: sourceLocation(element),
      referenceId: id,
    },
  ];
}

function buildNode(element: ElementNode, inherited: Presentation, context: BuildContext): RenderNode[] {
  const tag = element.tagName ?? "unknown";
  if (NON_RENDERING_ELEMENTS.has(tag)) return [];
  if (tag === "use") return buildUse(element, inherited, context);

  if (tag === "switch") {
    const first = childElements(element)[0];
    return [buildGroup(element, inherited, context, parseTransform(getSVGTransform(element)), first ? [first] : [])];
  }
  if (CONTAINER_ELEMENTS.has(tag)) return [buildGroup(element, inherited, context)];

  const own = ownPresentation(element);
  const style = computeStyle(inherited, own, tag === "line");
  const transform = parseTransform(getSVGTransform(element));
  if (GEOMETRY_ELEMENTS.has(tag)) {
    return [{ type: "shape", geometry: geometry(element), style, transform, source: sourceLocation(element) }];
  }
  if (tag === "text") {
    context.diagnostics.push({
      code: "unsupported-text-rendering",
      message: "Text is represented in the render tree but is not implemented by the SwiftUI backend yet.",
      severity: "warning",
      source: sourceLocation(element),
    });
    return [
      {
        type: "text",
        text: textContent(element),
        attributes: { ...(element.properties ?? {}) } as Record<string, string | number>,
        style,
        transform,
        source: sourceLocation(element),
      },
    ];
  }
  if (tag === "image") {
    const href = element.properties?.href ?? element.properties?.["xlink:href"] ?? "";
    context.diagnostics.push({
      code: "unsupported-image-rendering",
      message: "Images are represented in the render tree but are not implemented by the SwiftUI backend yet.",
      severity: "warning",
      source: sourceLocation(element),
    });
    return [
      {
        type: "image",
        href: String(href),
        attributes: { ...(element.properties ?? {}) } as Record<string, string | number>,
        style,
        transform,
        source: sourceLocation(element),
      },
    ];
  }

  context.diagnostics.push({
    code: "unsupported-element",
    message: `Element <${tag}> is not supported by the current SwiftUI renderer.`,
    severity: "warning",
    source: sourceLocation(element),
  });
  return [];
}

/** Build the semantic tree once. Both Swift output modes consume this exact document. */
export function buildRenderDocument(svg: ElementNode, properties: SVGElementProperties): RenderDocument {
  const resources = createRegistry(svg);
  const diagnostics: RenderDiagnostic[] = [];
  const context: BuildContext = { resources, diagnostics, activeReferences: new Set() };
  const children: RenderNode[] = [buildGroup(svg, {}, context)];

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
          message: `Paint server #${paint.id} is represented in the render tree but is not implemented by the SwiftUI backend yet.`,
          severity: "warning",
          source: node.source,
        });
      }
    }
  }
  diagnosePaintReferences(children);

  return {
    viewport: { width: properties.width, height: properties.height, viewBox: properties.viewBox },
    resources,
    children,
    diagnostics,
  };
}
