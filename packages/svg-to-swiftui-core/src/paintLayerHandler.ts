import type { ElementNode } from "svg-parser";
import { parseOpacity, swiftUIColor } from "./colorUtils";
import { handleElement } from "./elementHandlers";
import { filterStyleProps, parseStyle } from "./styleUtils";
import { getSVGTransform, wrapWithSVGTransform } from "./transformUtils";
import type { TranspilerOptions } from "./types";

type PresentationStyle = Record<string, string | number>;
type PaintKind = "fill" | "stroke";

export interface PaintDescriptor {
  color: string;
  opacity: number;
  swiftColor?: string;
}

export interface PaintLayer extends PaintDescriptor {
  lines: string[];
}

const FILLABLE_TAGS = new Set(["path", "circle", "ellipse", "rect", "polygon", "polyline"]);

function extractOwnStyle(element: ElementNode): PresentationStyle {
  const properties = element.properties;
  if (!properties) return {};

  const presentation = filterStyleProps(properties);
  const inline = typeof properties.style === "string" ? parseStyle(properties.style) : {};
  return { ...presentation, ...inline };
}

function resolvePaint(value: string, style: PresentationStyle): string {
  if (value.trim().toLowerCase() !== "currentcolor") return value;
  const inheritedColor = style.color;
  return inheritedColor ? String(inheritedColor) : value;
}

function isVisiblePaint(value: string | undefined): value is string {
  return value !== undefined && value.trim().toLowerCase() !== "none";
}

function cloneForPaint(element: ElementNode, ownStyle: PresentationStyle, kind: PaintKind): ElementNode {
  const { style: _style, ...properties } = element.properties ?? {};

  return {
    ...element,
    properties: {
      ...properties,
      ...ownStyle,
      fill: kind === "fill" ? "black" : "none",
      stroke: kind === "stroke" ? "black" : "none",
    },
  };
}

function visitPaints(
  element: ElementNode,
  parentStyle: PresentationStyle,
  inheritedOpacity: number,
  ancestorTransforms: string[],
  visitor: (
    element: ElementNode,
    kind: PaintKind,
    paint: PaintDescriptor,
    parentStyle: PresentationStyle,
    ownStyle: PresentationStyle,
    ancestorTransforms: string[],
  ) => void,
): void {
  const ownStyle = extractOwnStyle(element);
  const { transform: _transform, opacity: ownOpacity, ...inheritableStyle } = ownStyle;
  const effectiveStyle = { ...parentStyle, ...inheritableStyle };
  const opacity = inheritedOpacity * parseOpacity(ownOpacity);

  if (element.tagName === "g" || element.tagName === "svg") {
    const transform = getSVGTransform(element);
    const transforms = transform ? [...ancestorTransforms, transform] : ancestorTransforms;

    for (const child of element.children) {
      if (typeof child === "string" || child.type !== "element") continue;
      visitPaints(child, effectiveStyle, opacity, transforms, visitor);
    }
    return;
  }

  if (!FILLABLE_TAGS.has(element.tagName ?? "") && element.tagName !== "line") return;

  if (element.tagName !== "line") {
    const fill = String(effectiveStyle.fill ?? "black");
    if (isVisiblePaint(fill)) {
      const color = resolvePaint(fill, effectiveStyle);
      const paintOpacity = opacity * parseOpacity(effectiveStyle["fill-opacity"]);
      if (paintOpacity > 0) {
        visitor(
          element,
          "fill",
          { color, opacity: paintOpacity, swiftColor: swiftUIColor(color, paintOpacity) },
          parentStyle,
          ownStyle,
          ancestorTransforms,
        );
      }
    }
  }

  const strokeValue = effectiveStyle.stroke;
  const stroke = strokeValue === undefined ? undefined : String(strokeValue);
  if (isVisiblePaint(stroke)) {
    const color = resolvePaint(stroke, effectiveStyle);
    const paintOpacity = opacity * parseOpacity(effectiveStyle["stroke-opacity"]);
    if (paintOpacity > 0) {
      visitor(
        element,
        "stroke",
        { color, opacity: paintOpacity, swiftColor: swiftUIColor(color, paintOpacity) },
        parentStyle,
        ownStyle,
        ancestorTransforms,
      );
    }
  }
}

export function collectPaintDescriptors(svgElement: ElementNode): PaintDescriptor[] {
  const paints: PaintDescriptor[] = [];
  visitPaints(svgElement, {}, 1, [], (_element, _kind, paint) => paints.push(paint));
  return paints;
}

export function collectPaintLayers(svgElement: ElementNode, options: TranspilerOptions): PaintLayer[] {
  const layers: PaintLayer[] = [];

  visitPaints(svgElement, {}, 1, [], (element, kind, paint, parentStyle, ownStyle, ancestorTransforms) => {
    const childOptions: TranspilerOptions = {
      ...options,
      parentStyle,
      separatePaintLayer: true,
    };
    const clone = cloneForPaint(element, ownStyle, kind);
    let lines = handleElement(clone, childOptions);

    for (let index = ancestorTransforms.length - 1; index >= 0; index--) {
      lines = wrapWithSVGTransform(lines, ancestorTransforms[index], childOptions);
    }

    options.lastPathId = childOptions.lastPathId;
    if (lines.length > 0) layers.push({ ...paint, lines });
  });

  return layers;
}
