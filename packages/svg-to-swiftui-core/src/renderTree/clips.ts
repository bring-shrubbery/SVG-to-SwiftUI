import type { ElementNode } from "svg-parser";
import type { Presentation, StyleResolution, SVGStyleResolver } from "../styleCascade";
import { type AffineTransform, IDENTITY_TRANSFORM } from "../transformUtils";
import { objectBoundingBox } from "./bounds";
import type {
  ClipPathInstance,
  ClipPathResource,
  ClipPathUnits,
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

function containsClipPath(element: ElementNode): boolean {
  return element.tagName === "clipPath" || children(element).some(containsClipPath);
}

function units(element: ElementNode, diagnostics: RenderDiagnostic[]): ClipPathUnits {
  const value = String(element.properties?.clipPathUnits ?? "userSpaceOnUse");
  if (value === "objectBoundingBox" || value === "userSpaceOnUse") return value;
  diagnostic(diagnostics, element, "invalid-clipPathUnits", `Invalid clipPathUnits '${value}'.`);
  return "userSpaceOnUse";
}

/** Resolve local clipPath definitions while preserving their document-tree inheritance. */
export function resolveClipPathResources(
  root: ElementNode,
  clipElements: Map<string, ElementNode>,
  styleResolver: SVGStyleResolver,
  rootPresentation: Presentation,
  diagnostics: RenderDiagnostic[],
): Map<string, ClipPathResource> {
  const resolutions = new Map<ElementNode, StyleResolution>();
  const walk = (element: ElementNode, inherited: Presentation): void => {
    for (const child of children(element)) {
      if (!containsClipPath(child)) continue;
      const resolved = styleResolver.resolve(child, inherited);
      resolutions.set(child, resolved);
      walk(child, resolved.values);
    }
  };
  walk(root, rootPresentation);

  const resources = new Map<string, ClipPathResource>();
  for (const [id, element] of clipElements) {
    const resolved = resolutions.get(element);
    resources.set(id, {
      id,
      units: units(element, diagnostics),
      source: sourceLocation(element),
      element,
      contentElements: children(element),
      children: [],
      instances: new Map(),
      presentation: resolved?.values ?? rootPresentation,
      provenance: resolved?.provenance ?? {},
    });
  }
  return resources;
}

/** Resolve clipPathUnits for one target before the target's own transform. */
export function resolveClipPathInstance(
  resource: ClipPathResource,
  node: RenderNode,
  children: RenderNode[],
): ClipPathInstance {
  if (resource.units === "userSpaceOnUse") {
    return { resource, children, contentTransform: IDENTITY_TRANSFORM, invalid: false };
  }

  // SVG object bounding boxes use geometry only: stroke, markers, clipping, masking,
  // filtering, and other paint effects do not contribute.
  const bounds = objectBoundingBox(node);
  if (!bounds || bounds.width === 0 || bounds.height === 0) {
    return { resource, children: [], contentTransform: IDENTITY_TRANSFORM, invalid: true };
  }
  const contentTransform: AffineTransform = {
    a: bounds.width,
    b: 0,
    c: 0,
    d: bounds.height,
    e: bounds.x,
    f: bounds.y,
  };
  return { resource, children, contentTransform, invalid: false };
}
