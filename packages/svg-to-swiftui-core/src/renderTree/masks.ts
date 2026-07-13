import type { ElementNode } from "svg-parser";
import { lengthContext, type ParsedSVGLength, parseSVGLength, resolveSVGLength, SVGLengthError } from "../lengths";
import type { Presentation, StyleResolution, SVGStyleResolver } from "../styleCascade";
import { type AffineTransform, IDENTITY_TRANSFORM } from "../transformUtils";
import { objectBoundingBox } from "./bounds";
import type {
  MaskInstance,
  MaskResource,
  MaskType,
  MaskUnits,
  RenderDiagnostic,
  RenderNode,
  SourceLocation,
} from "./types";

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

function containsMask(element: ElementNode): boolean {
  return element.tagName === "mask" || children(element).some(containsMask);
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
    if (parsed.kind !== "length") throw new SVGLengthError("invalid-mask-length", `${label} requires a length.`);
    return parsed;
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      error instanceof SVGLengthError ? error.code : "invalid-mask-length",
      `Invalid ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return parseSVGLength(fallback) as ParsedSVGLength;
  }
}

function units(
  raw: unknown,
  fallback: MaskUnits,
  label: "maskUnits" | "maskContentUnits",
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): MaskUnits {
  const value = String(raw ?? fallback);
  if (value === "objectBoundingBox" || value === "userSpaceOnUse") return value;
  diagnostic(diagnostics, element, `invalid-${label}`, `Invalid ${label} '${value}'.`);
  return fallback;
}

/** Resolve all local mask definitions into typed, reusable resources. */
export function resolveMaskResources(
  root: ElementNode,
  maskElements: Map<string, ElementNode>,
  styleResolver: SVGStyleResolver,
  rootPresentation: Presentation,
  diagnostics: RenderDiagnostic[],
): Map<string, MaskResource> {
  const resolutions = new Map<ElementNode, StyleResolution>();
  const walk = (element: ElementNode, inherited: Presentation): void => {
    for (const child of children(element)) {
      if (!containsMask(child)) continue;
      const resolved = styleResolver.resolve(child, inherited);
      resolutions.set(child, resolved);
      walk(child, resolved.values);
    }
  };
  walk(root, rootPresentation);

  const resources = new Map<string, MaskResource>();
  for (const [id, element] of maskElements) {
    const resolved = resolutions.get(element);
    const rawType = String(resolved?.values["mask-type"] ?? "luminance")
      .trim()
      .toLowerCase();
    let maskType: MaskType = "luminance";
    if (rawType === "alpha" || rawType === "luminance") maskType = rawType;
    else diagnostic(diagnostics, element, "invalid-mask-type", `Invalid mask-type '${rawType}'.`);

    const width = parsedLength(element.properties?.width, "120%", "mask width", element, diagnostics);
    const height = parsedLength(element.properties?.height, "120%", "mask height", element, diagnostics);
    if (width.value < 0) diagnostic(diagnostics, element, "negative-mask-width", "Mask width cannot be negative.");
    if (height.value < 0) diagnostic(diagnostics, element, "negative-mask-height", "Mask height cannot be negative.");

    resources.set(id, {
      id,
      x: parsedLength(element.properties?.x, "-10%", "mask x", element, diagnostics),
      y: parsedLength(element.properties?.y, "-10%", "mask y", element, diagnostics),
      width,
      height,
      units: units(element.properties?.maskUnits, "objectBoundingBox", "maskUnits", element, diagnostics),
      contentUnits: units(
        element.properties?.maskContentUnits,
        "userSpaceOnUse",
        "maskContentUnits",
        element,
        diagnostics,
      ),
      maskType,
      source: sourceLocation(element),
      element,
      contentElements: children(element),
      children: [],
      instances: new Map(),
      presentation: resolved?.values ?? rootPresentation,
    });
  }
  return resources;
}

function coordinate(value: ParsedSVGLength, axis: "horizontal" | "vertical", unitsValue: MaskUnits, node: RenderNode) {
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

/** Resolve mask units and region for one target in its pre-transform local coordinate system. */
export function resolveMaskInstance(resource: MaskResource, node: RenderNode, children: RenderNode[]): MaskInstance {
  const bounds = objectBoundingBox(node);
  const needsBounds = resource.units === "objectBoundingBox" || resource.contentUnits === "objectBoundingBox";
  if (needsBounds && (!bounds || bounds.width === 0 || bounds.height === 0)) {
    return {
      resource,
      maskType: resource.maskType,
      children: [],
      region: { x: 0, y: 0, width: 0, height: 0 },
      contentTransform: IDENTITY_TRANSFORM,
      invalid: true,
    };
  }

  const x = coordinate(resource.x, "horizontal", resource.units, node);
  const y = coordinate(resource.y, "vertical", resource.units, node);
  const width = coordinate(resource.width, "horizontal", resource.units, node);
  const height = coordinate(resource.height, "vertical", resource.units, node);
  const unitsTransform: AffineTransform =
    resource.units === "objectBoundingBox" && bounds
      ? { a: bounds.width, b: 0, c: 0, d: bounds.height, e: bounds.x, f: bounds.y }
      : IDENTITY_TRANSFORM;
  const region = {
    x: unitsTransform.a * x + unitsTransform.e,
    y: unitsTransform.d * y + unitsTransform.f,
    width: unitsTransform.a * width,
    height: unitsTransform.d * height,
  };
  const contentTransform: AffineTransform =
    resource.contentUnits === "objectBoundingBox" && bounds
      ? { a: bounds.width, b: 0, c: 0, d: bounds.height, e: bounds.x, f: bounds.y }
      : IDENTITY_TRANSFORM;
  return {
    resource,
    maskType: resource.maskType,
    children,
    region,
    contentTransform,
    invalid: width <= 0 || height <= 0,
  };
}
