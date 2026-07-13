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

interface ShapeHelper {
  name: string;
  lines: string[];
}

type GeneratedViewNode =
  | { type: "paint"; helper: string; swiftColor: string }
  | {
      type: "group";
      children: GeneratedViewNode[];
      opacity: number;
      isolated: boolean;
      clip?: string;
    };

interface ViewBuildContext {
  options: TranspilerOptions;
  helpers: ShapeHelper[];
  nextLayer: number;
  nextClip: number;
}

function createOptions(
  svgProperties: SVGElementProperties,
  document: RenderDocument,
  config: SwiftUIGeneratorConfig,
  separatePaintLayer: boolean,
): TranspilerOptions {
  return {
    ...svgProperties,
    viewBox: document.viewport.coordinateSpace,
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

function geometryProperties(geometry: Geometry): Record<string, string | number> {
  const { type: _type, ...properties } = geometry;
  return properties as Record<string, string | number>;
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
  const previous = options.resolvedStyle;
  options.resolvedStyle = override
    ? {
        ...shape.style,
        fill: override.fill === "none" ? { type: "none" } : { type: "solid", value: override.fill },
        stroke: override.stroke === "none" ? { type: "none" } : { type: "solid", value: override.stroke },
      }
    : shape.style;
  const lines = handleElement(shapeElement(shape, override), options);
  options.resolvedStyle = previous;
  return wrapWithTransform(lines, shape.transform, options);
}

function renderShapeNodes(nodes: RenderNode[], options: TranspilerOptions): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.style.display === "none") continue;
    if (node.type === "shape") {
      if (node.style.visibility === "hidden" || node.style.visibility === "collapse") continue;
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

function addHelper(context: ViewBuildContext, name: string, lines: string[]): string {
  context.helpers.push({ name, lines });
  return name;
}

function buildViewNodes(
  nodes: RenderNode[],
  context: ViewBuildContext,
  ancestorTransforms: RenderNode["transform"][] = [],
): GeneratedViewNode[] {
  const generated: GeneratedViewNode[] = [];
  for (const node of nodes) {
    if (node.style.display === "none") continue;
    if (node.type === "group") {
      let clip: string | undefined;
      if (node.viewport?.clip) {
        const { rect, clipTransform } = node.viewport;
        let clipLines = handleElement(
          {
            type: "element",
            tagName: "rect",
            properties: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              fill: "black",
              stroke: "none",
            },
            children: [],
          },
          context.options,
        );
        clipLines = wrapWithTransform(clipLines, clipTransform, context.options);
        for (let index = ancestorTransforms.length - 1; index >= 0; index--) {
          clipLines = wrapWithTransform(clipLines, ancestorTransforms[index]!, context.options);
        }
        clip = addHelper(context, `Clip${context.nextClip++}`, clipLines);
      }
      const children = buildViewNodes(node.children, context, [...ancestorTransforms, node.transform]);
      if (children.length > 0) {
        generated.push({
          type: "group",
          children,
          opacity: node.style.opacity,
          isolated: node.style.opacity !== 1 || String(node.style.presentation.isolation).toLowerCase() === "isolate",
          ...(clip ? { clip } : {}),
        });
      }
      continue;
    }
    if (node.type !== "shape" || node.style.visibility === "hidden" || node.style.visibility === "collapse") continue;

    const paints: GeneratedViewNode[] = [];

    const addLayer = (kind: "fill" | "stroke", paint: Paint, paintOpacity: number) => {
      const swiftColor = colorForPaint(paint, paintOpacity);
      if (!swiftColor) return;
      let lines = renderShape(
        node,
        context.options,
        kind === "fill" ? { fill: "black", stroke: "none" } : { fill: "none", stroke: "black" },
      );
      for (let index = ancestorTransforms.length - 1; index >= 0; index--) {
        lines = wrapWithTransform(lines, ancestorTransforms[index]!, context.options);
      }
      if (lines.length > 0) {
        const helper = addHelper(context, `Layer${context.nextLayer++}`, lines);
        paints.push({ type: "paint", helper, swiftColor });
      }
    };

    for (const kind of node.style.paintOrder) {
      if (kind === "fill" && node.style.fill.type !== "none") {
        addLayer("fill", node.style.fill, node.style.fillOpacity);
      }
      if (kind === "stroke" && node.style.stroke.type !== "none") {
        addLayer("stroke", node.style.stroke, node.style.strokeOpacity);
      }
    }
    if (paints.length > 0) {
      generated.push({
        type: "group",
        children: paints,
        opacity: node.style.opacity,
        isolated: node.style.opacity !== 1 || String(node.style.presentation.isolation).toLowerCase() === "isolate",
      });
    }
  }
  return generated;
}

function createPathBody(lines: string[]): string[] {
  return ["var path = Path()", "let width = rect.size.width", "let height = rect.size.height", ...lines, "return path"];
}

function swiftNumber(value: number): string {
  return String(Object.is(value, -0) ? 0 : value);
}

function renderViewNode(node: GeneratedViewNode, level: number, indentation: string): string[] {
  const prefix = indentation.repeat(level);
  if (node.type === "paint") return [`${prefix}${node.helper}().fill(${node.swiftColor})`];
  const lines = [`${prefix}ZStack {`];
  for (const child of node.children) lines.push(...renderViewNode(child, level + 1, indentation));
  lines.push(`${prefix}}`);
  if (node.clip) lines.push(`${prefix}.clipShape(${node.clip}())`);
  if (node.isolated) lines.push(`${prefix}.compositingGroup()`);
  if (node.opacity !== 1) lines.push(`${prefix}.opacity(${swiftNumber(node.opacity)})`);
  return lines;
}

function createView(
  name: string,
  nodes: GeneratedViewNode[],
  helpers: ShapeHelper[],
  indentationSize: number,
): string[] {
  const indentation = " ".repeat(indentationSize);
  const body: string[] = [
    "var body: some View {",
    `${indentation}ZStack {`,
    ...nodes.flatMap((node) => renderViewNode(node, 2, indentation)),
    `${indentation}}`,
    "}",
  ];
  for (const helper of helpers) {
    const pathFunction = createFunctionTemplate({
      name: "path",
      parameters: [["in rect", "CGRect"]],
      returnType: "Path",
      indent: indentationSize,
      body: createPathBody(helper.lines),
    });
    const layerStruct = createStructTemplate({
      name: helper.name,
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
  const context: ViewBuildContext = { options, helpers: [], nextLayer: 0, nextClip: 0 };
  const nodes = buildViewNodes(document.children, context);
  return {
    lines: createView(config.structName ?? "SVGView", nodes, context.helpers, indentationSize),
    preservesColors: true,
  };
}
