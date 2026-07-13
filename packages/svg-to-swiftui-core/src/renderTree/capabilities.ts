import { swiftUIColor } from "../colorUtils";
import type { SwiftUIGeneratorConfig } from "../types";
import type { CapabilityDecision, Paint, RenderDocument, RenderNode } from "./types";

interface VisiblePaint {
  paint: Paint;
  opacity: number;
}

function collectVisiblePaints(nodes: RenderNode[], inheritedOpacity = 1, paints: VisiblePaint[] = []): VisiblePaint[] {
  for (const node of nodes) {
    if (node.style.display === "none" || node.style.visibility === "hidden") continue;
    const opacity = inheritedOpacity * node.style.opacity;
    if (node.type === "group") {
      collectVisiblePaints(node.children, opacity, paints);
      continue;
    }
    if (node.type !== "shape") continue;
    if (node.style.fill.type !== "none" && opacity * node.style.fillOpacity > 0) {
      paints.push({ paint: node.style.fill, opacity: opacity * node.style.fillOpacity });
    }
    if (node.style.stroke.type !== "none" && opacity * node.style.strokeOpacity > 0) {
      paints.push({ paint: node.style.stroke, opacity: opacity * node.style.strokeOpacity });
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

function solidColor(paint: Paint, opacity: number): string | undefined {
  if (paint.type !== "solid") return undefined;
  return swiftUIColor(paint.value, opacity);
}

/** Explain, deterministically, why this document uses the Shape fast path or the general View backend. */
export function analyzeCapabilities(document: RenderDocument, config: SwiftUIGeneratorConfig = {}): CapabilityDecision {
  const paints = collectVisiblePaints(document.children);
  const reasons: string[] = [];

  if (config.preserveColors === false) {
    return {
      mode: "shape",
      reasons: ["preserveColors is false; using the tintable Shape fast path"],
      paintCount: paints.length,
    };
  }

  if (containsGeneralViewContent(document.children)) reasons.push("document contains non-geometry view content");

  const colors = paints.map(({ paint, opacity }) => solidColor(paint, opacity));
  const allColorsSupported = colors.every((color) => color !== undefined);
  if (!allColorsSupported) {
    return {
      mode: containsGeneralViewContent(document.children) ? "view" : "shape",
      reasons: ["one or more source paints require a future paint backend"],
      paintCount: paints.length,
    };
  }

  if (config.preserveColors === true && paints.length > 0)
    reasons.push("preserveColors explicitly requests source paints");
  if (paints.some(({ opacity }) => opacity !== 1)) reasons.push("document uses independent paint or group opacity");
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
