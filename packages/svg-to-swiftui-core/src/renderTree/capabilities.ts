import { swiftUIColor } from "../colorUtils";
import type { SwiftUIGeneratorConfig } from "../types";
import type { CapabilityDecision, Paint, RenderDocument, RenderNode } from "./types";

interface VisiblePaint {
  paint: Paint;
  opacity: number;
}

function isHidden(visibility: string): boolean {
  return visibility === "hidden" || visibility === "collapse";
}

function collectVisiblePaints(nodes: RenderNode[], paints: VisiblePaint[] = []): VisiblePaint[] {
  for (const node of nodes) {
    if (node.style.display === "none") continue;
    if (node.type === "group") {
      collectVisiblePaints(node.children, paints);
      continue;
    }
    if (node.type !== "shape" || isHidden(node.style.visibility)) continue;
    if (node.style.fill.type !== "none") {
      paints.push({ paint: node.style.fill, opacity: node.style.fillOpacity });
    }
    if (node.style.stroke.type !== "none") {
      paints.push({ paint: node.style.stroke, opacity: node.style.strokeOpacity });
    }
  }
  return paints;
}

function containsGeneralViewContent(nodes: RenderNode[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "text" ||
      node.type === "image" ||
      (node.type === "group" && containsGeneralViewContent(node.children)),
  );
}

function containsViewportClip(nodes: RenderNode[]): boolean {
  return nodes.some(
    (node) => node.type === "group" && (node.viewport?.clip === true || containsViewportClip(node.children)),
  );
}

function containsIndependentCompositing(nodes: RenderNode[]): boolean {
  return nodes.some((node) => {
    if (node.style.display === "none") return false;
    if (
      node.style.opacity !== 1 ||
      node.style.fillOpacity !== 1 ||
      node.style.strokeOpacity !== 1 ||
      String(node.style.presentation.isolation).trim().toLowerCase() === "isolate"
    )
      return true;
    return node.type === "group" && containsIndependentCompositing(node.children);
  });
}

function solidColor(paint: Paint, opacity: number): string | undefined {
  if (paint.type === "solid") return swiftUIColor(paint.value, opacity);
  if (paint.type === "reference" && paint.fallback) return swiftUIColor(paint.fallback, opacity);
  return undefined;
}

function hasIntrinsicAlpha(paint: Paint): boolean {
  const color = solidColor(paint, 1);
  return color?.includes("opacity:") === true || color?.includes(".opacity(") === true;
}

/** Explain, deterministically, why this document uses the Shape fast path or the general View backend. */
export function analyzeCapabilities(document: RenderDocument, config: SwiftUIGeneratorConfig = {}): CapabilityDecision {
  const paints = collectVisiblePaints(document.children);
  const reasons: string[] = [];
  const needsViewportClip = containsViewportClip(document.children);
  const hasGradientPaint = paints.some(({ paint }) => {
    if (paint.type !== "reference") return false;
    const server = document.resources.paints.get(paint.id);
    return server?.type === "linearGradient" || server?.type === "radialGradient";
  });
  const needsIndependentCompositing =
    containsIndependentCompositing(document.children) || paints.some(({ paint }) => hasIntrinsicAlpha(paint));

  if (
    config.preserveColors === false &&
    !needsViewportClip &&
    !hasGradientPaint &&
    !needsIndependentCompositing &&
    !containsGeneralViewContent(document.children)
  ) {
    return {
      mode: "shape",
      reasons: ["preserveColors is false; using the tintable Shape fast path"],
      paintCount: paints.length,
    };
  }

  if (containsGeneralViewContent(document.children)) reasons.push("document contains non-geometry view content");
  if (needsViewportClip) reasons.push("document contains a clipped nested viewport");
  if (hasGradientPaint) reasons.push("document uses an SVG gradient paint server");
  if (needsIndependentCompositing) reasons.push("document uses independent paint or group opacity");

  const colors = paints.map(({ paint, opacity }) => {
    if (paint.type === "reference") {
      const server = document.resources.paints.get(paint.id);
      if (server?.type === "linearGradient" || server?.type === "radialGradient") return `gradient:#${paint.id}`;
    }
    return solidColor(paint, opacity);
  });
  const allColorsSupported = colors.every((color) => color !== undefined);
  if (!allColorsSupported) {
    return {
      mode:
        config.preserveColors === true || containsGeneralViewContent(document.children) || hasGradientPaint
          ? "view"
          : "shape",
      reasons: ["one or more source paints require a future paint backend"],
      paintCount: paints.length,
    };
  }

  if (config.preserveColors === true && paints.length > 0)
    reasons.push("preserveColors explicitly requests source paints");
  if (config.preserveColors === undefined && allColorsSupported && new Set(colors).size > 1) {
    reasons.push("document contains multiple distinct source paints");
  }

  // Referenced paints are represented in the tree but implemented by later paint-server tickets.
  // Until then the fast path preserves geometry and emits a diagnostic instead of an empty View.
  return {
    mode: reasons.length > 0 ? "view" : "shape",
    reasons: reasons.length > 0 ? reasons : ["all visible geometry is representable as one tintable path"],
    paintCount: paints.length,
  };
}
