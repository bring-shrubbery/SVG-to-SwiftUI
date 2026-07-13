import type { ElementNode } from "svg-parser";
import { swiftUIColor } from "../colorUtils";
import { handleElement } from "../elementHandlers";
import { createFunctionTemplate, createStructTemplate } from "../templates";
import { wrapWithTransform } from "../transformUtils";
import type { SVGElementProperties, SwiftUIGeneratorConfig, TranspilerOptions } from "../types";
import type { ComputedStyle, Geometry, Paint, RenderDocument, RenderNode, RenderShape } from "./types";

export interface GeneratedSwiftUI {
  lines: string[];
  preservesColors: boolean;
}

interface PaintLayer {
  lines: string[];
  swiftColor: string;
}

function createOptions(
  svgProperties: SVGElementProperties,
  document: RenderDocument,
  config: SwiftUIGeneratorConfig,
  separatePaintLayer: boolean,
): TranspilerOptions {
  return {
    ...svgProperties,
    precision: config.precision ?? 10,
    lastPathId: 0,
    indentationSize: config.indentationSize ?? 4,
    currentIndentationLevel: 0,
    parentStyle: {},
    fillColors: new Set(),
    strokeExpansion: 0,
    reverseWinding: false,
    normalizeWindingCW: false,
    hasFills: hasFill(document.children),
    hasStrokes: hasStroke(document.children),
    separatePaintLayer,
    fillRule: "nonzero",
    definitions: document.resources.definitions,
    activeUseReferences: new Set(),
  };
}

function hasFill(nodes: RenderNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.type === "shape" && node.style.fill.type !== "none") || (node.type === "group" && hasFill(node.children)),
  );
}

function hasStroke(nodes: RenderNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.type === "shape" && node.style.stroke.type !== "none") ||
      (node.type === "group" && hasStroke(node.children)),
  );
}

function paintValue(paint: Paint): string {
  if (paint.type === "none") return "none";
  if (paint.type === "solid") return paint.value;
  return paint.fallback ?? `url(#${paint.id})`;
}

function geometryProperties(geometry: Geometry): Record<string, string> {
  const { type: _type, ...properties } = geometry;
  return properties as Record<string, string>;
}

function styleProperties(style: ComputedStyle): Record<string, string | number> {
  return {
    fill: paintValue(style.fill),
    stroke: paintValue(style.stroke),
    "fill-rule": style.fillRule,
    "clip-rule": style.clipRule,
    "stroke-width": style.strokeStyle.width,
    "stroke-linecap": style.strokeStyle.lineCap,
    "stroke-linejoin": style.strokeStyle.lineJoin,
    "stroke-miterlimit": style.strokeStyle.miterLimit,
  };
}

function shapeElement(shape: RenderShape, override?: { fill: string; stroke: string }): ElementNode {
  return {
    type: "element",
    tagName: shape.geometry.type,
    properties: {
      ...geometryProperties(shape.geometry),
      ...styleProperties(shape.style),
      ...override,
    },
    children: [],
  };
}

function renderShape(
  shape: RenderShape,
  options: TranspilerOptions,
  override?: { fill: string; stroke: string },
): string[] {
  return wrapWithTransform(handleElement(shapeElement(shape, override), options), shape.transform, options);
}

function renderShapeNodes(nodes: RenderNode[], options: TranspilerOptions): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.style.display === "none" || node.style.visibility === "hidden") continue;
    if (node.type === "shape") {
      lines.push(...renderShape(node, options));
      continue;
    }
    if (node.type === "group") {
      lines.push(...wrapWithTransform(renderShapeNodes(node.children, options), node.transform, options));
    }
  }
  return lines;
}

function colorForPaint(paint: Paint, opacity: number): string | undefined {
  if (paint.type === "solid") return swiftUIColor(paint.value, opacity);
  if (paint.type === "reference" && paint.fallback) return swiftUIColor(paint.fallback, opacity);
  return undefined;
}

function collectPaintLayers(
  nodes: RenderNode[],
  options: TranspilerOptions,
  inheritedOpacity = 1,
  ancestorTransforms: RenderNode["transform"][] = [],
  layers: PaintLayer[] = [],
): PaintLayer[] {
  for (const node of nodes) {
    if (node.style.display === "none" || node.style.visibility === "hidden") continue;
    const opacity = inheritedOpacity * node.style.opacity;
    if (node.type === "group") {
      collectPaintLayers(node.children, options, opacity, [...ancestorTransforms, node.transform], layers);
      continue;
    }
    if (node.type !== "shape") continue;

    const addLayer = (kind: "fill" | "stroke", paint: Paint, paintOpacity: number) => {
      const swiftColor = colorForPaint(paint, opacity * paintOpacity);
      if (!swiftColor) return;
      let lines = renderShape(
        node,
        options,
        kind === "fill" ? { fill: "black", stroke: "none" } : { fill: "none", stroke: "black" },
      );
      for (let index = ancestorTransforms.length - 1; index >= 0; index--) {
        lines = wrapWithTransform(lines, ancestorTransforms[index]!, options);
      }
      if (lines.length > 0) layers.push({ lines, swiftColor });
    };

    if (node.style.fill.type !== "none" && opacity * node.style.fillOpacity > 0) {
      addLayer("fill", node.style.fill, node.style.fillOpacity);
    }
    if (node.style.stroke.type !== "none" && opacity * node.style.strokeOpacity > 0) {
      addLayer("stroke", node.style.stroke, node.style.strokeOpacity);
    }
  }
  return layers;
}

function createPathBody(lines: string[]): string[] {
  return ["var path = Path()", "let width = rect.size.width", "let height = rect.size.height", ...lines, "return path"];
}

function createView(name: string, layers: PaintLayer[], indentationSize: number): string[] {
  const indentation = " ".repeat(indentationSize);
  const body: string[] = [
    "var body: some View {",
    `${indentation}ZStack {`,
    ...layers.map((layer, index) => `${indentation}${indentation}Layer${index}().fill(${layer.swiftColor})`),
    `${indentation}}`,
    "}",
  ];
  for (const [index, layer] of layers.entries()) {
    const pathFunction = createFunctionTemplate({
      name: "path",
      parameters: [["in rect", "CGRect"]],
      returnType: "Path",
      indent: indentationSize,
      body: createPathBody(layer.lines),
    });
    const layerStruct = createStructTemplate({
      name: `Layer${index}`,
      indent: indentationSize,
      returnType: "Shape",
      body: pathFunction,
    });
    layerStruct[0] = `private ${layerStruct[0]}`;
    body.push("", ...layerStruct);
  }
  return createStructTemplate({ name, indent: indentationSize, returnType: "View", body });
}

export function generateShape(
  document: RenderDocument,
  svgProperties: SVGElementProperties,
  config: SwiftUIGeneratorConfig,
): GeneratedSwiftUI {
  const indentationSize = config.indentationSize ?? 4;
  const options = createOptions(svgProperties, document, config, false);
  const pathFunction = createFunctionTemplate({
    name: "path",
    parameters: [["in rect", "CGRect"]],
    returnType: "Path",
    indent: indentationSize,
    body: createPathBody(renderShapeNodes(document.children, options)),
  });
  return {
    lines: createStructTemplate({
      name: config.structName ?? "SVGShape",
      indent: indentationSize,
      returnType: "Shape",
      body: pathFunction,
    }),
    preservesColors: false,
  };
}

export function generateView(
  document: RenderDocument,
  svgProperties: SVGElementProperties,
  config: SwiftUIGeneratorConfig,
): GeneratedSwiftUI {
  const indentationSize = config.indentationSize ?? 4;
  const options = createOptions(svgProperties, document, config, true);
  const layers = collectPaintLayers(document.children, options);
  return {
    lines: createView(config.structName ?? "SVGView", layers, indentationSize),
    preservesColors: true,
  };
}
