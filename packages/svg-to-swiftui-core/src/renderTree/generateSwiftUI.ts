import type { ElementNode } from "svg-parser";
import { parseRGBAColor, type RGBAColor, swiftUIColor } from "../colorUtils";
import { handleElement } from "../elementHandlers";
import { createFunctionTemplate, createStructTemplate } from "../templates";
import { multiplyTransforms, wrapWithTransform } from "../transformUtils";
import type { SVGElementProperties, SwiftUIGeneratorConfig, TranspilerOptions, ViewBoxData } from "../types";
import { renderNodeBounds } from "./bounds";
import { type ResolvedGradient, resolveGradientForShape } from "./gradients";
import { type ResolvedPattern, resolvePatternForShape } from "./patterns";
import type { ComputedStyle, Geometry, GradientStop, Paint, RenderDocument, RenderNode, RenderShape } from "./types";

export interface GeneratedSwiftUI {
  lines: string[];
  preservesColors: boolean;
}

interface ShapeHelper {
  name: string;
  lines: string[];
}

type GeneratedViewNode =
  | {
      type: "paint";
      helper: string;
      swiftColor: string;
      cgColor: RGBAColor;
      tileContained?: boolean;
    }
  | {
      type: "gradient";
      helper: string;
      gradient: ResolvedGradient;
      paintOpacity: number;
      coordinateSpace: ViewBoxData;
    }
  | {
      type: "pattern";
      helper: string;
      pattern: ResolvedPattern;
      paintOpacity: number;
      coordinateSpace: ViewBoxData;
      patternIndex: number;
      tileClip?: string;
      contentNodes: GeneratedViewNode[];
    }
  | {
      type: "group";
      children: GeneratedViewNode[];
      opacity: number;
      isolated: boolean;
      clip?: string;
      tileContained?: boolean;
    };

interface ViewBuildContext {
  options: TranspilerOptions;
  helpers: ShapeHelper[];
  nextLayer: number;
  nextClip: number;
  nextPattern: number;
  document: RenderDocument;
  precision: number;
  coordinateSpace: ViewBoxData;
  activePatterns: Set<string>;
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

function rgbaForPaint(paint: Paint, opacity: number): RGBAColor | undefined {
  const source = paint.type === "solid" ? paint.value : paint.type === "reference" ? paint.fallback : undefined;
  if (!source) return undefined;
  const color = parseRGBAColor(source);
  return color ? { ...color, alpha: color.alpha * opacity } : undefined;
}

function formatNumber(value: number, precision = 10): string {
  const rounded = Number(value.toFixed(precision));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function colorForStop(stop: GradientStop, opacity: number, precision: number): string {
  const { red, green, blue, alpha } = stop.color;
  const channels = `red: ${formatNumber(red, precision)}, green: ${formatNumber(green, precision)}, blue: ${formatNumber(blue, precision)}`;
  const effectiveAlpha = alpha * opacity;
  return effectiveAlpha === 1
    ? `Color(${channels})`
    : `Color(${channels}, opacity: ${formatNumber(effectiveAlpha, precision)})`;
}

function rgbaForStop(stop: GradientStop, opacity: number): RGBAColor {
  return { ...stop.color, alpha: stop.color.alpha * opacity };
}

function addHelper(context: ViewBuildContext, name: string, lines: string[]): string {
  context.helpers.push({ name, lines });
  return name;
}

function isContainedInTile(node: RenderNode, pattern: ResolvedPattern): boolean {
  const bounds = renderNodeBounds(node, pattern.contentTransform);
  if (!bounds) return false;
  const epsilon = 1e-9;
  return (
    bounds.x >= -epsilon &&
    bounds.y >= -epsilon &&
    bounds.x + bounds.width <= pattern.tile.width + epsilon &&
    bounds.y + bounds.height <= pattern.tile.height + epsilon
  );
}

function markTileContained(nodes: GeneratedViewNode[]): GeneratedViewNode[] {
  return nodes.map((node) => {
    if (node.type === "paint") return { ...node, tileContained: true };
    if (node.type === "group") {
      return {
        ...node,
        tileContained: true,
        children: markTileContained(node.children),
      };
    }
    return node;
  });
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
      let lines = renderShape(
        node,
        context.options,
        kind === "fill" ? { fill: "black", stroke: "none" } : { fill: "none", stroke: "black" },
      );
      for (let index = ancestorTransforms.length - 1; index >= 0; index--) {
        lines = wrapWithTransform(lines, ancestorTransforms[index]!, context.options);
      }
      if (lines.length === 0) return;
      const helper = addHelper(context, `Layer${context.nextLayer++}`, lines);
      if (paint.type === "reference") {
        const server = context.document.resources.paints.get(paint.id);
        if (server?.type === "linearGradient" || server?.type === "radialGradient") {
          if (server.stops.length === 0) return;
          if (server.stops.length === 1) {
            paints.push({
              type: "paint",
              helper,
              swiftColor: colorForStop(server.stops[0]!, paintOpacity, context.precision),
              cgColor: rgbaForStop(server.stops[0]!, paintOpacity),
            });
            return;
          }
          const gradient = resolveGradientForShape(server, node, ancestorTransforms);
          if (gradient.type === "solid") {
            paints.push({
              type: "paint",
              helper,
              swiftColor: colorForStop(gradient.stop, paintOpacity, context.precision),
              cgColor: rgbaForStop(gradient.stop, paintOpacity),
            });
            return;
          }
          if (gradient.type === "none") return;
          paints.push({
            type: "gradient",
            helper,
            gradient,
            paintOpacity,
            coordinateSpace: context.coordinateSpace,
          });
          return;
        }
        if (server?.type === "pattern" && !server.invalid) {
          if (context.activePatterns.has(server.id)) return;
          const pattern = resolvePatternForShape(server, node, kind, ancestorTransforms);
          if (pattern.type === "none") return;
          const patternIndex = context.nextPattern++;
          let tileClip: string | undefined;
          if (pattern.clipTile) {
            let clipLines = handleElement(
              {
                type: "element",
                tagName: "rect",
                properties: {
                  x: 0,
                  y: 0,
                  width: pattern.tile.width,
                  height: pattern.tile.height,
                  fill: "black",
                  stroke: "none",
                },
                children: [],
              },
              context.options,
            );
            clipLines = wrapWithTransform(clipLines, pattern.matrix, context.options);
            tileClip = addHelper(context, `PatternClip${patternIndex}`, clipLines);
          }
          const patternContext: ViewBuildContext = {
            ...context,
            options: { ...context.options, lastPathId: 0 },
            activePatterns: new Set(context.activePatterns).add(server.id),
          };
          const contentTransform = multiplyTransforms(pattern.matrix, pattern.contentTransform);
          const contentNodes = pattern.children.flatMap((child) => {
            const childNodes = buildViewNodes([child], patternContext, [contentTransform]);
            return isContainedInTile(child, pattern) ? markTileContained(childNodes) : childNodes;
          });
          context.nextLayer = patternContext.nextLayer;
          context.nextClip = patternContext.nextClip;
          context.nextPattern = patternContext.nextPattern;
          if (contentNodes.length === 0) return;
          paints.push({
            type: "pattern",
            helper,
            pattern,
            paintOpacity,
            coordinateSpace: context.coordinateSpace,
            patternIndex,
            ...(tileClip ? { tileClip } : {}),
            contentNodes,
          });
          return;
        }
      }
      const swiftColor = colorForPaint(paint, paintOpacity);
      const cgColor = rgbaForPaint(paint, paintOpacity);
      if (swiftColor && cgColor) paints.push({ type: "paint", helper, swiftColor, cgColor });
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

function gradientStopLiteral(stop: GradientStop, opacity: number): string {
  return `SVGGradientStop(offset: ${formatNumber(stop.offset)}, red: ${formatNumber(stop.color.red)}, green: ${formatNumber(stop.color.green)}, blue: ${formatNumber(stop.color.blue)}, alpha: ${formatNumber(stop.color.alpha * opacity)})`;
}

function runtimeTransform(matrix: RenderNode["transform"], coordinateSpace: ViewBoxData): string {
  const scaleX = `size.width / ${formatNumber(coordinateSpace.width)}`;
  const scaleY = `size.height / ${formatNumber(coordinateSpace.height)}`;
  return `CGAffineTransform(a: ${formatNumber(matrix.a)} * ${scaleX}, b: ${formatNumber(matrix.b)} * ${scaleY}, c: ${formatNumber(matrix.c)} * ${scaleX}, d: ${formatNumber(matrix.d)} * ${scaleY}, tx: ${formatNumber(matrix.e - coordinateSpace.x)} * ${scaleX}, ty: ${formatNumber(matrix.f - coordinateSpace.y)} * ${scaleY})`;
}

function renderGradientNode(
  node: Extract<GeneratedViewNode, { type: "gradient" }>,
  level: number,
  indentation: string,
): string[] {
  const prefix = indentation.repeat(level);
  const inner = indentation.repeat(level + 1);
  const nested = indentation.repeat(level + 2);
  const deep = indentation.repeat(level + 3);
  const gradient = node.gradient;
  const matrix = gradient.matrix;
  const stops = gradient.stops.map((stop) => gradientStopLiteral(stop, node.paintOpacity)).join(", ");
  const transform = runtimeTransform(matrix, node.coordinateSpace);
  const lines = [
    `${prefix}Canvas { context, size in`,
    `${inner}let clipPath = ${node.helper}().path(in: CGRect(origin: .zero, size: size))`,
    `${inner}let stops = [${stops}]`,
    `${inner}if let gradient = svgGradient(stops: stops, spread: .${gradient.spreadMethod === "repeat" ? "repeating" : gradient.spreadMethod}, startT: ${formatNumber(gradient.startT)}, endT: ${formatNumber(gradient.endT)}, linearRGB: ${gradient.colorInterpolation === "linearRGB"}) {`,
    `${nested}context.withCGContext { graphics in`,
    `${deep}graphics.saveGState()`,
    `${deep}graphics.addPath(clipPath.cgPath)`,
    `${deep}graphics.clip()`,
    `${deep}graphics.concatenate(${transform})`,
  ];
  if (gradient.type === "linearGradient") {
    const dx = gradient.x2 - gradient.x1;
    const dy = gradient.y2 - gradient.y1;
    const startX = gradient.x1 + dx * gradient.startT;
    const startY = gradient.y1 + dy * gradient.startT;
    const endX = gradient.x1 + dx * gradient.endT;
    const endY = gradient.y1 + dy * gradient.endT;
    lines.push(
      `${deep}graphics.drawLinearGradient(gradient, start: CGPoint(x: ${formatNumber(startX)}, y: ${formatNumber(startY)}), end: CGPoint(x: ${formatNumber(endX)}, y: ${formatNumber(endY)}), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
    );
  } else {
    const dx = gradient.cx - gradient.fx;
    const dy = gradient.cy - gradient.fy;
    const dr = gradient.r - gradient.fr;
    lines.push(
      `${deep}graphics.drawRadialGradient(gradient, startCenter: CGPoint(x: ${formatNumber(gradient.fx + dx * gradient.startT)}, y: ${formatNumber(gradient.fy + dy * gradient.startT)}), startRadius: ${formatNumber(gradient.fr + dr * gradient.startT)}, endCenter: CGPoint(x: ${formatNumber(gradient.fx + dx * gradient.endT)}, y: ${formatNumber(gradient.fy + dy * gradient.endT)}), endRadius: ${formatNumber(gradient.fr + dr * gradient.endT)}, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
    );
  }
  lines.push(`${deep}graphics.restoreGState()`, `${nested}}`, `${inner}}`, `${prefix}}`);
  return lines;
}

function renderPatternNode(
  node: Extract<GeneratedViewNode, { type: "pattern" }>,
  level: number,
  indentation: string,
): string[] {
  const prefix = indentation.repeat(level);
  const inner = indentation.repeat(level + 1);
  const lines = [
    `${prefix}Canvas { context, size in`,
    `${inner}context.withCGContext { graphics in`,
    ...renderPatternCommands(node, "graphics", level + 2, indentation),
    `${inner}}`,
    `${prefix}}`,
  ];
  return lines;
}

function renderGradientCommands(
  node: Extract<GeneratedViewNode, { type: "gradient" }>,
  graphicsName: string,
  level: number,
  indentation: string,
): string[] {
  const prefix = indentation.repeat(level);
  const inner = indentation.repeat(level + 1);
  const nested = indentation.repeat(level + 2);
  const gradient = node.gradient;
  const transform = runtimeTransform(gradient.matrix, node.coordinateSpace);
  const stops = gradient.stops.map((stop) => gradientStopLiteral(stop, node.paintOpacity)).join(", ");
  const lines = [
    `${prefix}do {`,
    `${inner}let clipPath = ${node.helper}().path(in: CGRect(origin: .zero, size: size))`,
    `${inner}let stops = [${stops}]`,
    `${inner}if let gradient = svgGradient(stops: stops, spread: .${gradient.spreadMethod === "repeat" ? "repeating" : gradient.spreadMethod}, startT: ${formatNumber(gradient.startT)}, endT: ${formatNumber(gradient.endT)}, linearRGB: ${gradient.colorInterpolation === "linearRGB"}) {`,
    `${nested}${graphicsName}.saveGState()`,
    `${nested}${graphicsName}.addPath(clipPath.cgPath)`,
    `${nested}${graphicsName}.clip()`,
    `${nested}${graphicsName}.concatenate(${transform})`,
  ];
  if (gradient.type === "linearGradient") {
    const dx = gradient.x2 - gradient.x1;
    const dy = gradient.y2 - gradient.y1;
    lines.push(
      `${nested}${graphicsName}.drawLinearGradient(gradient, start: CGPoint(x: ${formatNumber(gradient.x1 + dx * gradient.startT)}, y: ${formatNumber(gradient.y1 + dy * gradient.startT)}), end: CGPoint(x: ${formatNumber(gradient.x1 + dx * gradient.endT)}, y: ${formatNumber(gradient.y1 + dy * gradient.endT)}), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
    );
  } else {
    const dx = gradient.cx - gradient.fx;
    const dy = gradient.cy - gradient.fy;
    const dr = gradient.r - gradient.fr;
    lines.push(
      `${nested}${graphicsName}.drawRadialGradient(gradient, startCenter: CGPoint(x: ${formatNumber(gradient.fx + dx * gradient.startT)}, y: ${formatNumber(gradient.fy + dy * gradient.startT)}), startRadius: ${formatNumber(gradient.fr + dr * gradient.startT)}, endCenter: CGPoint(x: ${formatNumber(gradient.fx + dx * gradient.endT)}, y: ${formatNumber(gradient.fy + dy * gradient.endT)}), endRadius: ${formatNumber(gradient.fr + dr * gradient.endT)}, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
    );
  }
  lines.push(`${nested}${graphicsName}.restoreGState()`, `${inner}}`, `${prefix}}`);
  return lines;
}

function renderGeneratedCommands(
  nodes: GeneratedViewNode[],
  graphicsName: string,
  level: number,
  indentation: string,
): string[] {
  const lines: string[] = [];
  const prefix = indentation.repeat(level);
  const inner = indentation.repeat(level + 1);
  for (const node of nodes) {
    if (node.type === "paint") {
      const color = node.cgColor;
      lines.push(
        `${prefix}do {`,
        `${inner}${graphicsName}.saveGState()`,
        `${inner}${graphicsName}.addPath(${node.helper}().path(in: CGRect(origin: .zero, size: size)).cgPath)`,
        `${inner}${graphicsName}.setFillColor(CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [${formatNumber(color.red)}, ${formatNumber(color.green)}, ${formatNumber(color.blue)}, ${formatNumber(color.alpha)}])!)`,
        `${inner}${graphicsName}.fillPath()`,
        `${inner}${graphicsName}.restoreGState()`,
        `${prefix}}`,
      );
      continue;
    }
    if (node.type === "gradient") {
      lines.push(...renderGradientCommands(node, graphicsName, level, indentation));
      continue;
    }
    if (node.type === "pattern") {
      lines.push(...renderPatternCommands(node, graphicsName, level, indentation));
      continue;
    }
    const needsLayer = node.isolated || node.clip !== undefined;
    if (!needsLayer) {
      lines.push(...renderGeneratedCommands(node.children, graphicsName, level, indentation));
      continue;
    }
    lines.push(`${prefix}do {`, `${inner}${graphicsName}.saveGState()`);
    if (node.clip)
      lines.push(
        `${inner}${graphicsName}.addPath(${node.clip}().path(in: CGRect(origin: .zero, size: size)).cgPath)`,
        `${inner}${graphicsName}.clip()`,
      );
    if (node.isolated) {
      if (node.opacity !== 1) lines.push(`${inner}${graphicsName}.setAlpha(${formatNumber(node.opacity)})`);
      lines.push(`${inner}${graphicsName}.beginTransparencyLayer(auxiliaryInfo: nil)`);
    }
    lines.push(...renderGeneratedCommands(node.children, graphicsName, level + 1, indentation));
    if (node.isolated) lines.push(`${inner}${graphicsName}.endTransparencyLayer()`);
    lines.push(`${inner}${graphicsName}.restoreGState()`, `${prefix}}`);
  }
  return lines;
}

interface PatternRepeatRuntime {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
  columnX: string;
  columnY: string;
  rowX: string;
  rowY: string;
  originX: string;
  originY: string;
  scaleX: string;
  scaleY: string;
  suffix: number;
  tileClip?: string;
}

function canBatchPatternNode(node: GeneratedViewNode): boolean {
  if (node.type === "paint") return node.tileContained === true;
  return (
    node.type === "group" &&
    node.tileContained === true &&
    !node.isolated &&
    !node.clip &&
    node.children.every(canBatchPatternNode)
  );
}

function renderBatchedPatternNode(
  node: GeneratedViewNode,
  runtime: PatternRepeatRuntime,
  graphicsName: string,
  level: number,
  indentation: string,
): string[] {
  if (node.type === "group")
    return node.children.flatMap((child) => renderBatchedPatternNode(child, runtime, graphicsName, level, indentation));
  if (node.type !== "paint") return [];
  const prefix = indentation.repeat(level);
  const inner = indentation.repeat(level + 1);
  const nested = indentation.repeat(level + 2);
  const deep = indentation.repeat(level + 3);
  const color = node.cgColor;
  return [
    `${prefix}do {`,
    `${inner}${graphicsName}.saveGState()`,
    `${inner}let repeatedPath = CGMutablePath()`,
    `${inner}for row in (${runtime.minRow})...(${runtime.maxRow}) {`,
    `${nested}for column in (${runtime.minColumn})...(${runtime.maxColumn}) {`,
    `${deep}let offsetX${runtime.suffix} = (${runtime.originX} + CGFloat(column) * ${runtime.columnX} + CGFloat(row) * ${runtime.rowX}) * ${runtime.scaleX}`,
    `${deep}let offsetY${runtime.suffix} = (${runtime.originY} + CGFloat(column) * ${runtime.columnY} + CGFloat(row) * ${runtime.rowY}) * ${runtime.scaleY}`,
    `${deep}repeatedPath.addPath(${node.helper}().path(in: CGRect(origin: .zero, size: size)).cgPath, transform: CGAffineTransform(translationX: offsetX${runtime.suffix}, y: offsetY${runtime.suffix}))`,
    `${nested}}`,
    `${inner}}`,
    `${inner}${graphicsName}.addPath(repeatedPath)`,
    `${inner}${graphicsName}.setFillColor(CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [${formatNumber(color.red)}, ${formatNumber(color.green)}, ${formatNumber(color.blue)}, ${formatNumber(color.alpha)}])!)`,
    `${inner}${graphicsName}.fillPath()`,
    `${inner}${graphicsName}.restoreGState()`,
    `${prefix}}`,
  ];
}

function renderUnbatchedPatternNode(
  node: GeneratedViewNode,
  runtime: PatternRepeatRuntime,
  graphicsName: string,
  level: number,
  indentation: string,
): string[] {
  const prefix = indentation.repeat(level);
  const inner = indentation.repeat(level + 1);
  const nested = indentation.repeat(level + 2);
  const lines = [
    `${prefix}for row in (${runtime.minRow})...(${runtime.maxRow}) {`,
    `${inner}for column in (${runtime.minColumn})...(${runtime.maxColumn}) {`,
    `${nested}${graphicsName}.saveGState()`,
    `${nested}let offsetX${runtime.suffix} = (${runtime.originX} + CGFloat(column) * ${runtime.columnX} + CGFloat(row) * ${runtime.rowX}) * ${runtime.scaleX}`,
    `${nested}let offsetY${runtime.suffix} = (${runtime.originY} + CGFloat(column) * ${runtime.columnY} + CGFloat(row) * ${runtime.rowY}) * ${runtime.scaleY}`,
    `${nested}${graphicsName}.translateBy(x: offsetX${runtime.suffix}, y: offsetY${runtime.suffix})`,
  ];
  if (runtime.tileClip)
    lines.push(
      `${nested}${graphicsName}.addPath(${runtime.tileClip}().path(in: CGRect(origin: .zero, size: size)).cgPath)`,
      `${nested}${graphicsName}.clip()`,
    );
  lines.push(
    ...renderGeneratedCommands([node], graphicsName, level + 2, indentation),
    `${nested}${graphicsName}.restoreGState()`,
    `${inner}}`,
    `${prefix}}`,
  );
  return lines;
}

function renderPatternCommands(
  node: Extract<GeneratedViewNode, { type: "pattern" }>,
  graphicsName: string,
  level: number,
  indentation: string,
): string[] {
  const prefix = indentation.repeat(level);
  const inner = indentation.repeat(level + 1);
  const pattern = node.pattern;
  const matrix = pattern.matrix;
  const runtime: PatternRepeatRuntime = {
    minRow: pattern.minRow,
    maxRow: pattern.maxRow,
    minColumn: pattern.minColumn,
    maxColumn: pattern.maxColumn,
    columnX: formatNumber(matrix.a * pattern.tile.width),
    columnY: formatNumber(matrix.b * pattern.tile.width),
    rowX: formatNumber(matrix.c * pattern.tile.height),
    rowY: formatNumber(matrix.d * pattern.tile.height),
    originX: formatNumber(matrix.a * pattern.tile.x + matrix.c * pattern.tile.y),
    originY: formatNumber(matrix.b * pattern.tile.x + matrix.d * pattern.tile.y),
    scaleX: `size.width / ${formatNumber(node.coordinateSpace.width)}`,
    scaleY: `size.height / ${formatNumber(node.coordinateSpace.height)}`,
    suffix: node.patternIndex,
    ...(node.tileClip ? { tileClip: node.tileClip } : {}),
  };
  const lines = [
    `${prefix}do {`,
    `${inner}${graphicsName}.saveGState()`,
    `${inner}${graphicsName}.addPath(${node.helper}().path(in: CGRect(origin: .zero, size: size)).cgPath)`,
    `${inner}${graphicsName}.clip()`,
  ];
  if (node.paintOpacity !== 1) {
    lines.push(
      `${inner}${graphicsName}.setAlpha(${formatNumber(node.paintOpacity)})`,
      `${inner}${graphicsName}.beginTransparencyLayer(auxiliaryInfo: nil)`,
    );
  }
  for (const contentNode of node.contentNodes) {
    lines.push(
      ...(canBatchPatternNode(contentNode)
        ? renderBatchedPatternNode(contentNode, runtime, graphicsName, level + 1, indentation)
        : renderUnbatchedPatternNode(contentNode, runtime, graphicsName, level + 1, indentation)),
    );
  }
  if (node.paintOpacity !== 1) lines.push(`${inner}${graphicsName}.endTransparencyLayer()`);
  lines.push(`${inner}${graphicsName}.restoreGState()`, `${prefix}}`);
  return lines;
}

function renderViewNode(node: GeneratedViewNode, level: number, indentation: string): string[] {
  const prefix = indentation.repeat(level);
  if (node.type === "paint") return [`${prefix}${node.helper}().fill(${node.swiftColor})`];
  if (node.type === "gradient") return renderGradientNode(node, level, indentation);
  if (node.type === "pattern") return renderPatternNode(node, level, indentation);
  const lines = [`${prefix}ZStack {`];
  for (const child of node.children) lines.push(...renderViewNode(child, level + 1, indentation));
  lines.push(`${prefix}}`);
  if (node.clip) lines.push(`${prefix}.clipShape(${node.clip}())`);
  if (node.isolated) lines.push(`${prefix}.compositingGroup()`);
  if (node.opacity !== 1) lines.push(`${prefix}.opacity(${swiftNumber(node.opacity)})`);
  return lines;
}

function containsGradientNode(nodes: GeneratedViewNode[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "gradient" ||
      (node.type === "group" && containsGradientNode(node.children)) ||
      (node.type === "pattern" && containsGradientNode(node.contentNodes)),
  );
}

function gradientSupport(indentationSize: number): string[] {
  const indentation = " ".repeat(indentationSize);
  return [
    "private struct SVGGradientStop {",
    `${indentation}let offset: CGFloat`,
    `${indentation}let red: CGFloat`,
    `${indentation}let green: CGFloat`,
    `${indentation}let blue: CGFloat`,
    `${indentation}let alpha: CGFloat`,
    "}",
    "",
    "private enum SVGGradientSpread {",
    `${indentation}case pad, reflect, repeating`,
    "}",
    "",
    "private func svgLinearComponent(_ value: CGFloat) -> CGFloat {",
    `${indentation}value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)`,
    "}",
    "",
    "private func svgEncodedComponent(_ value: CGFloat) -> CGFloat {",
    `${indentation}value <= 0.0031308 ? value * 12.92 : 1.055 * pow(value, 1 / 2.4) - 0.055`,
    "}",
    "",
    "private func svgGradientPosition(_ value: CGFloat, spread: SVGGradientSpread) -> CGFloat {",
    `${indentation}switch spread {`,
    `${indentation}case .pad:`,
    `${indentation}${indentation}return min(1, max(0, value))`,
    `${indentation}case .repeating:`,
    `${indentation}${indentation}return value - floor(value)`,
    `${indentation}case .reflect:`,
    `${indentation}${indentation}let period = value - floor(value / 2) * 2`,
    `${indentation}${indentation}return period <= 1 ? period : 2 - period`,
    `${indentation}}`,
    "}",
    "",
    "private func svgGradient(stops: [SVGGradientStop], spread: SVGGradientSpread, startT: CGFloat, endT: CGFloat, linearRGB: Bool) -> CGGradient? {",
    `${indentation}guard stops.count >= 2, endT > startT else { return nil }`,
    `${indentation}let sampleCount = max(256, Int(ceil(abs(endT - startT) * 256)))`,
    `${indentation}var components: [CGFloat] = []`,
    `${indentation}var locations: [CGFloat] = []`,
    `${indentation}components.reserveCapacity((sampleCount + 1) * 4)`,
    `${indentation}locations.reserveCapacity(sampleCount + 1)`,
    `${indentation}for index in 0...sampleCount {`,
    `${indentation}${indentation}let location = CGFloat(index) / CGFloat(sampleCount)`,
    `${indentation}${indentation}let source = startT + (endT - startT) * location`,
    `${indentation}${indentation}let position = svgGradientPosition(source, spread: spread)`,
    `${indentation}${indentation}var lower = stops[0]`,
    `${indentation}${indentation}var upper = stops[stops.count - 1]`,
    `${indentation}${indentation}for stop in stops {`,
    `${indentation}${indentation}${indentation}if stop.offset <= position { lower = stop } else { upper = stop; break }`,
    `${indentation}${indentation}}`,
    `${indentation}${indentation}let distance = upper.offset - lower.offset`,
    `${indentation}${indentation}let ratio = distance == 0 ? 0 : (position - lower.offset) / distance`,
    `${indentation}${indentation}let lowerRed = linearRGB ? svgLinearComponent(lower.red) : lower.red`,
    `${indentation}${indentation}let lowerGreen = linearRGB ? svgLinearComponent(lower.green) : lower.green`,
    `${indentation}${indentation}let lowerBlue = linearRGB ? svgLinearComponent(lower.blue) : lower.blue`,
    `${indentation}${indentation}let upperRed = linearRGB ? svgLinearComponent(upper.red) : upper.red`,
    `${indentation}${indentation}let upperGreen = linearRGB ? svgLinearComponent(upper.green) : upper.green`,
    `${indentation}${indentation}let upperBlue = linearRGB ? svgLinearComponent(upper.blue) : upper.blue`,
    `${indentation}${indentation}var red = lowerRed + (upperRed - lowerRed) * ratio`,
    `${indentation}${indentation}var green = lowerGreen + (upperGreen - lowerGreen) * ratio`,
    `${indentation}${indentation}var blue = lowerBlue + (upperBlue - lowerBlue) * ratio`,
    `${indentation}${indentation}if linearRGB {`,
    `${indentation}${indentation}${indentation}red = svgEncodedComponent(red)`,
    `${indentation}${indentation}${indentation}green = svgEncodedComponent(green)`,
    `${indentation}${indentation}${indentation}blue = svgEncodedComponent(blue)`,
    `${indentation}${indentation}}`,
    `${indentation}${indentation}components.append(contentsOf: [red, green, blue, lower.alpha + (upper.alpha - lower.alpha) * ratio])`,
    `${indentation}${indentation}locations.append(location)`,
    `${indentation}}`,
    `${indentation}let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!`,
    `${indentation}return components.withUnsafeBufferPointer { componentBuffer in`,
    `${indentation}${indentation}locations.withUnsafeBufferPointer { locationBuffer in`,
    `${indentation}${indentation}${indentation}CGGradient(colorSpace: colorSpace, colorComponents: componentBuffer.baseAddress!, locations: locationBuffer.baseAddress!, count: locations.count)`,
    `${indentation}${indentation}}`,
    `${indentation}}`,
    "}",
  ];
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
  if (containsGradientNode(nodes)) body.push("", ...gradientSupport(indentationSize));
  return createStructTemplate({
    name,
    indent: indentationSize,
    returnType: "View",
    body,
  });
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
  const context: ViewBuildContext = {
    options,
    helpers: [],
    nextLayer: 0,
    nextClip: 0,
    nextPattern: 0,
    document,
    precision: config.precision ?? 10,
    coordinateSpace: document.viewport.coordinateSpace,
    activePatterns: new Set(),
  };
  const nodes = buildViewNodes(document.children, context);
  return {
    lines: createView(config.structName ?? "SVGView", nodes, context.helpers, indentationSize),
    preservesColors: true,
  };
}
