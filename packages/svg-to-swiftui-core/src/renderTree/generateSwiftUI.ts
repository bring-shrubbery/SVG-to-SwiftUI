import type { ElementNode } from "svg-parser";
import { parseRGBAColor, type RGBAColor, swiftUIColor } from "../colorUtils";
import { handleElement } from "../elementHandlers";
import { lengthContext, type ParsedSVGLength, resolveSVGLength } from "../lengths";
import { createFunctionTemplate, createStructTemplate } from "../templates";
import { multiplyTransforms, wrapWithTransform } from "../transformUtils";
import type { SVGElementProperties, SwiftUIGeneratorConfig, TranspilerOptions, ViewBoxData } from "../types";
import { viewBoxTransform } from "../viewports";
import { renderNodeBounds } from "./bounds";
import { type ResolvedGradient, resolveGradientForShape } from "./gradients";
import { type ResolvedPattern, resolvePatternForShape } from "./patterns";
import type {
  ClipPathInstance,
  ComputedStyle,
  Geometry,
  GradientStop,
  MaskInstance,
  Paint,
  RenderDocument,
  RenderNode,
  RenderShape,
  RenderText,
  SVGBlendMode,
} from "./types";

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
      clipUnions?: string[][];
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
      type: "text";
      helper: string;
    }
  | {
      type: "image";
      helper: string;
    }
  | {
      type: "group";
      children: GeneratedViewNode[];
      opacity: number;
      isolated: boolean;
      blendMode: SVGBlendMode;
      viewportClip?: string;
      clipPath?: GeneratedClipPath;
      mask?: GeneratedMask;
      tileContained?: boolean;
    };

interface GeneratedMask {
  children: GeneratedViewNode[];
  clip: string;
  luminance: boolean;
}

interface GeneratedClipPath {
  children: GeneratedViewNode[];
}

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
  textHelpers: Array<{ name: string; node: RenderText; transform: RenderNode["transform"] }>;
  imageHelpers: Array<{
    name: string;
    node: Extract<RenderNode, { type: "image" }>;
    transform: RenderNode["transform"];
    subdocumentName?: string;
  }>;
  subdocuments: string[][];
  rootName: string;
  config: SwiftUIGeneratorConfig;
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
      (node.type === "shape" &&
        (node.style.fill.type !== "none" || (node.markers !== undefined && hasFill(node.markers)))) ||
      (node.type === "group" && hasFill(node.children)),
  );
}

function hasStroke(nodes: RenderNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.type === "shape" && node.style.stroke.type !== "none") ||
      (node.type === "shape" && node.markers !== undefined && hasStroke(node.markers)) ||
      (node.type === "group" && hasStroke(node.children)),
  );
}

function paintValue(paint: Paint): string {
  if (paint.type === "none") return "none";
  if (paint.type === "solid") return paint.value;
  if (paint.type === "context") return `context-${paint.source}`;
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
    ...(style.strokeStyle.dashArray ? { "stroke-dasharray": style.strokeStyle.dashArray.join(" ") } : {}),
    "stroke-dashoffset": style.strokeStyle.dashOffset,
    "vector-effect": style.strokeStyle.vectorEffect,
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
  preStrokeTransform?: RenderNode["transform"],
): string[] {
  const previous = options.resolvedStyle;
  const previousPreStrokeTransform = options.preStrokeTransform;
  options.preStrokeTransform = preStrokeTransform;
  options.resolvedStyle = override
    ? {
        ...shape.style,
        fill: override.fill === "none" ? { type: "none" } : { type: "solid", value: override.fill },
        stroke: override.stroke === "none" ? { type: "none" } : { type: "solid", value: override.stroke },
      }
    : shape.style;
  const lines = handleElement(shapeElement(shape, override), options);
  options.resolvedStyle = previous;
  options.preStrokeTransform = previousPreStrokeTransform;
  return preStrokeTransform ? lines : wrapWithTransform(lines, shape.transform, options);
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

  const buildMask = (
    mask: MaskInstance | undefined,
    targetTransforms: RenderNode["transform"][],
  ): GeneratedMask | undefined => {
    if (!mask) return undefined;
    let clipLines = handleElement(
      {
        type: "element",
        tagName: "rect",
        properties: { ...mask.region, fill: "black", stroke: "none" },
        children: [],
      },
      context.options,
    );
    for (let index = targetTransforms.length - 1; index >= 0; index--)
      clipLines = wrapWithTransform(clipLines, targetTransforms[index]!, context.options);
    const clip = addHelper(context, `MaskClip${context.nextClip++}`, clipLines);
    const children = mask.invalid
      ? []
      : buildViewNodes(mask.children, context, [...targetTransforms, mask.contentTransform]);
    return { children, clip, luminance: mask.maskType === "luminance" };
  };

  let buildClipPath: (
    clipPath: ClipPathInstance | undefined,
    targetTransforms: RenderNode["transform"][],
  ) => GeneratedClipPath | undefined;

  const addCoverageClip = (node: GeneratedViewNode, helpers: string[]): GeneratedViewNode => {
    if (node.type === "paint") return { ...node, clipUnions: [...(node.clipUnions ?? []), helpers] };
    if (node.type === "group")
      return { ...node, children: node.children.map((child) => addCoverageClip(child, helpers)) };
    return node;
  };

  const buildClipCoverage = (
    clipNodes: RenderNode[],
    coverageTransforms: RenderNode["transform"][],
  ): GeneratedViewNode[] => {
    const coverage: GeneratedViewNode[] = [];
    for (const clipNode of clipNodes) {
      if (clipNode.style.display === "none") continue;
      const targetTransforms = [...coverageTransforms, clipNode.transform];
      if (clipNode.type === "group") {
        const children = buildClipCoverage(clipNode.children, targetTransforms);
        const nested = buildClipPath(clipNode.clipPath, targetTransforms);
        if (nested) {
          const helpers = simpleClipPathHelpers(nested);
          // Intersection distributes over the clip subtree's logical union.
          // Simple nested regions become GraphicsContext clips on each leaf;
          // SwiftUI otherwise ignores nested view masks inside mask content.
          if (helpers && helpers.length > 0) {
            coverage.push(...children.map((child) => addCoverageClip(child, helpers)));
          } else {
            for (const child of children)
              coverage.push({
                type: "group",
                children: [child],
                opacity: 1,
                isolated: true,
                blendMode: "normal",
                clipPath: nested,
              });
          }
        } else if (children.length > 0) {
          coverage.push({
            type: "group",
            children,
            opacity: 1,
            isolated: false,
            blendMode: "normal",
          });
        }
        continue;
      }
      if (
        clipNode.type !== "shape" ||
        clipNode.style.visibility === "hidden" ||
        clipNode.style.visibility === "collapse"
      )
        continue;

      // A clipPath consumes raw geometry. Convert clip-rule into the helper's
      // non-zero-compatible path representation, independent of source paint.
      const coverageShape: RenderShape = {
        ...clipNode,
        style: { ...clipNode.style, fillRule: clipNode.style.clipRule },
      };
      let lines = renderShape(coverageShape, context.options, { fill: "black", stroke: "none" });
      for (let index = coverageTransforms.length - 1; index >= 0; index--)
        lines = wrapWithTransform(lines, coverageTransforms[index]!, context.options);
      if (lines.length === 0) continue;
      const helper = addHelper(context, `ClipCoverage${context.nextClip++}`, lines);
      const path: GeneratedViewNode = {
        type: "paint",
        helper,
        swiftColor: "Color.white",
        cgColor: { red: 1, green: 1, blue: 1, alpha: 1 },
      };
      const nested = buildClipPath(clipNode.clipPath, targetTransforms);
      const helpers = nested ? simpleClipPathHelpers(nested) : undefined;
      const clippedPath = helpers && helpers.length > 0 ? addCoverageClip(path, helpers) : path;
      coverage.push({
        type: "group",
        children: [clippedPath],
        opacity: 1,
        isolated: !!nested && !helpers,
        blendMode: "normal",
        ...(nested && !helpers ? { clipPath: nested } : {}),
      });
    }
    return coverage;
  };

  buildClipPath = (clipPath, targetTransforms) => {
    if (!clipPath) return undefined;
    const content = clipPath.children.map((node) =>
      node.type === "group"
        ? { ...node, transform: multiplyTransforms(node.transform, clipPath.contentTransform) }
        : node,
    );
    // clipPath's transform operates outside the clipPathUnits mapping:
    // target × resource-transform × object-bounding-box.
    const children = clipPath.invalid ? [] : buildClipCoverage(content, targetTransforms);
    return { children };
  };

  for (const node of nodes) {
    if (node.style.display === "none") continue;
    if (node.type === "group") {
      let viewportClip: string | undefined;
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
        viewportClip = addHelper(context, `Clip${context.nextClip++}`, clipLines);
      }
      const targetTransforms = [...ancestorTransforms, node.transform];
      const children = buildViewNodes(node.children, context, targetTransforms);
      if (children.length > 0) {
        const clipPath = buildClipPath(node.clipPath, targetTransforms);
        const mask = buildMask(node.mask, targetTransforms);
        generated.push({
          type: "group",
          children,
          opacity: node.style.opacity,
          isolated:
            node.style.opacity !== 1 ||
            node.style.isolation === "isolate" ||
            node.style.blendMode !== "normal" ||
            !!clipPath ||
            !!mask,
          blendMode: node.style.blendMode,
          ...(viewportClip ? { viewportClip } : {}),
          ...(clipPath ? { clipPath } : {}),
          ...(mask ? { mask } : {}),
        });
      }
      continue;
    }
    if (node.type === "text") {
      if (node.style.visibility === "hidden" || node.style.visibility === "collapse" || node.text === "") continue;
      const completeTransform = [...ancestorTransforms, node.transform].reduce(multiplyTransforms);
      const name = `TextLayer${context.textHelpers.length}`;
      context.textHelpers.push({ name, node, transform: completeTransform });
      const targetTransforms = [...ancestorTransforms, node.transform];
      const clipPath = buildClipPath(node.clipPath, targetTransforms);
      const mask = buildMask(node.mask, targetTransforms);
      generated.push({
        type: "group",
        children: [{ type: "text", helper: name }],
        opacity: node.style.opacity,
        isolated:
          node.style.opacity !== 1 ||
          node.style.isolation === "isolate" ||
          node.style.blendMode !== "normal" ||
          !!clipPath ||
          !!mask,
        blendMode: node.style.blendMode,
        ...(clipPath ? { clipPath } : {}),
        ...(mask ? { mask } : {}),
      });
      continue;
    }
    if (node.type === "image") {
      if (
        node.style.visibility === "hidden" ||
        node.style.visibility === "collapse" ||
        node.viewport.width <= 0 ||
        node.viewport.height <= 0 ||
        !node.resource
      )
        continue;
      const completeTransform = [...ancestorTransforms, node.transform].reduce(multiplyTransforms);
      const name = `ImageLayer${context.imageHelpers.length}`;
      let subdocumentName: string | undefined;
      if (node.resource.type === "svg") {
        subdocumentName = `${context.rootName}ImageDocument${context.subdocuments.length}`;
        const child = node.resource.document;
        const childProperties: SVGElementProperties = {
          width: child.viewport.width,
          height: child.viewport.height,
          viewBox: child.viewport.viewBox,
          userViewport: child.viewport.userViewport,
          preserveAspectRatio: child.viewport.preserveAspectRatio,
          viewBoxTransform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          zeroSized: child.viewport.zeroSized,
        };
        const generatedChild = generateView(child, childProperties, {
          ...context.config,
          structName: subdocumentName,
          preserveColors: true,
          usageCommentPrefix: false,
        });
        context.subdocuments.push(generatedChild.lines);
      }
      context.imageHelpers.push({
        name,
        node,
        transform: completeTransform,
        ...(subdocumentName ? { subdocumentName } : {}),
      });
      const targetTransforms = [...ancestorTransforms, node.transform];
      const clipPath = buildClipPath(node.clipPath, targetTransforms);
      const mask = buildMask(node.mask, targetTransforms);
      generated.push({
        type: "group",
        children: [{ type: "image", helper: name }],
        opacity: node.style.opacity,
        isolated:
          node.style.opacity !== 1 ||
          node.style.isolation === "isolate" ||
          node.style.blendMode !== "normal" ||
          !!clipPath ||
          !!mask,
        blendMode: node.style.blendMode,
        ...(clipPath ? { clipPath } : {}),
        ...(mask ? { mask } : {}),
      });
      continue;
    }
    if (node.type !== "shape" || node.style.visibility === "hidden" || node.style.visibility === "collapse") continue;

    const paints: GeneratedViewNode[] = [];

    const addLayer = (kind: "fill" | "stroke", paint: Paint, paintOpacity: number) => {
      const nonScalingStroke = kind === "stroke" && node.style.strokeStyle.vectorEffect === "non-scaling-stroke";
      const completeTransform = nonScalingStroke
        ? [...ancestorTransforms, node.transform].reduce(multiplyTransforms)
        : undefined;
      let lines = renderShape(
        node,
        context.options,
        kind === "fill" ? { fill: "black", stroke: "none" } : { fill: "none", stroke: "black" },
        completeTransform,
      );
      if (!nonScalingStroke) {
        for (let index = ancestorTransforms.length - 1; index >= 0; index--) {
          lines = wrapWithTransform(lines, ancestorTransforms[index]!, context.options);
        }
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
      if (kind === "markers" && node.markers && node.markers.length > 0) {
        paints.push(...buildViewNodes(node.markers, context, [...ancestorTransforms, node.transform]));
      }
    }
    if (paints.length > 0) {
      const targetTransforms = [...ancestorTransforms, node.transform];
      const clipPath = buildClipPath(node.clipPath, targetTransforms);
      const mask = buildMask(node.mask, targetTransforms);
      generated.push({
        type: "group",
        children: paints,
        opacity: node.style.opacity,
        isolated:
          node.style.opacity !== 1 ||
          node.style.isolation === "isolate" ||
          node.style.blendMode !== "normal" ||
          !!clipPath ||
          !!mask,
        blendMode: node.style.blendMode,
        ...(clipPath ? { clipPath } : {}),
        ...(mask ? { mask } : {}),
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

function swiftString(value: string): string {
  return JSON.stringify(value).replace(/\\\//g, "/");
}

function swiftTransform(matrix: RenderNode["transform"]): string {
  return `CGAffineTransform(a: ${formatNumber(matrix.a)}, b: ${formatNumber(matrix.b)}, c: ${formatNumber(matrix.c)}, d: ${formatNumber(matrix.d)}, tx: ${formatNumber(matrix.e)}, ty: ${formatNumber(matrix.f)})`;
}

function textGradientLength(
  value: ParsedSVGLength,
  units: "objectBoundingBox" | "userSpaceOnUse",
  axis: "horizontal" | "vertical" | "other",
  node: RenderText,
): number {
  if (units === "objectBoundingBox") return value.unit === "%" ? value.value / 100 : value.value;
  const resolved = resolveSVGLength(
    value,
    lengthContext(
      node.paintContext.viewport,
      node.paintContext.rootViewport,
      axis === "horizontal" ? "viewport-width" : axis === "vertical" ? "viewport-height" : "viewport-diagonal",
      axis,
      node.paintContext.fontMetrics,
    ),
  );
  return typeof resolved === "number" ? resolved : 0;
}

function textPaintLiteral(
  paint: Paint,
  opacity: number,
  node: RenderText,
  document: RenderDocument,
  transform: RenderNode["transform"],
): string {
  const value = paint.type === "solid" ? paint.value : paint.type === "reference" ? paint.fallback : undefined;
  if (value) {
    const color = parseRGBAColor(value);
    if (color)
      return `SVGTextSource.color(SVGTextColor(red: ${formatNumber(color.red)}, green: ${formatNumber(color.green)}, blue: ${formatNumber(color.blue)}, alpha: ${formatNumber(color.alpha * opacity)}))`;
  }
  if (paint.type !== "reference") return "nil";
  const server = document.resources.paints.get(paint.id);
  if (!server || (server.type !== "linearGradient" && server.type !== "radialGradient") || server.stops.length === 0)
    return "nil";
  if (server.stops.length === 1) {
    const color = server.stops[0]!.color;
    return `SVGTextSource.color(SVGTextColor(red: ${formatNumber(color.red)}, green: ${formatNumber(color.green)}, blue: ${formatNumber(color.blue)}, alpha: ${formatNumber(color.alpha * opacity)}))`;
  }
  const stops = server.stops
    .map(
      (stop) =>
        `SVGTextGradientStop(location: ${formatNumber(stop.offset)}, color: SVGTextColor(red: ${formatNumber(stop.color.red)}, green: ${formatNumber(stop.color.green)}, blue: ${formatNumber(stop.color.blue)}, alpha: ${formatNumber(stop.color.alpha * opacity)}))`,
    )
    .join(", ");
  const matrix = server.units === "userSpaceOnUse" ? multiplyTransforms(transform, server.transform) : server.transform;
  const common = `stops: [${stops}], objectBoundingBox: ${server.units === "objectBoundingBox"}, transform: ${swiftTransform(matrix)}`;
  if (server.type === "linearGradient") {
    return `SVGTextSource.linear(SVGTextLinearGradient(${common}, x1: ${formatNumber(textGradientLength(server.x1, server.units, "horizontal", node))}, y1: ${formatNumber(textGradientLength(server.y1, server.units, "vertical", node))}, x2: ${formatNumber(textGradientLength(server.x2, server.units, "horizontal", node))}, y2: ${formatNumber(textGradientLength(server.y2, server.units, "vertical", node))}))`;
  }
  return `SVGTextSource.radial(SVGTextRadialGradient(${common}, cx: ${formatNumber(textGradientLength(server.cx, server.units, "horizontal", node))}, cy: ${formatNumber(textGradientLength(server.cy, server.units, "vertical", node))}, radius: ${formatNumber(textGradientLength(server.r, server.units, "other", node))}, fx: ${formatNumber(textGradientLength(server.fx, server.units, "horizontal", node))}, fy: ${formatNumber(textGradientLength(server.fy, server.units, "vertical", node))}, innerRadius: ${formatNumber(textGradientLength(server.fr, server.units, "other", node))}))`;
}

function createTextHelper(
  helper: { name: string; node: RenderText; transform: RenderNode["transform"] },
  coordinateSpace: ViewBoxData,
  document: RenderDocument,
  indentationSize: number,
): string[] {
  const indentation = " ".repeat(indentationSize);
  const i2 = indentation.repeat(2);
  const i3 = indentation.repeat(3);
  const i4 = indentation.repeat(4);
  const i5 = indentation.repeat(5);
  const chunks = helper.node.chunks
    .map((chunk) => {
      const runs = chunk.runs
        .map((run) => {
          const transform = multiplyTransforms(helper.transform, run.transform);
          const localOpacity = run.source.element === "tspan" ? run.style.opacity : 1;
          const order = run.style.paintOrder
            .filter((phase) => phase !== "markers")
            .map((phase) => (phase === "fill" ? ".fill" : ".stroke"))
            .join(", ");
          const baseline = run.baseline.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
          const decorations = run.decoration
            .map((item) => `.${item === "line-through" ? "lineThrough" : item}`)
            .join(", ");
          const characters = run.characters
            .map(
              (character) =>
                `SVGTextCharacter(text: ${swiftString(character.text)}, dx: ${formatNumber(character.dx)}, dy: ${formatNumber(character.dy)}, rotation: ${formatNumber(character.rotate)})`,
            )
            .join(", ");
          const bidi = run.unicodeBidi.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
          return `SVGTextRun(text: ${swiftString(run.text)}, characters: [${characters}], dx: ${formatNumber(run.dx)}, dy: ${formatNumber(run.dy)}, family: ${swiftString(run.font.family)}, size: ${formatNumber(run.font.size)}, weight: ${formatNumber(run.font.weight)}, width: ${formatNumber(run.font.width)}, italic: ${run.font.italic}, smallCaps: ${run.font.smallCaps}, sizeAdjust: ${run.font.sizeAdjust === undefined ? "nil" : formatNumber(run.font.sizeAdjust)}, letterSpacing: ${formatNumber(run.letterSpacing)}, wordSpacing: ${formatNumber(run.wordSpacing)}, kerning: ${run.kerning}, baseline: .${baseline}, baselineShift: ${formatNumber(run.baselineShift)}, decorations: [${decorations}], direction: .${run.direction}, unicodeBidi: .${bidi}, textOrientation: .${run.textOrientation}, fill: ${textPaintLiteral(run.style.fill, run.style.fillOpacity * localOpacity, helper.node, document, transform)}, stroke: ${textPaintLiteral(run.style.stroke, run.style.strokeOpacity * localOpacity, helper.node, document, transform)}, strokeWidth: ${formatNumber(run.style.strokeStyle.width)}, lineCap: .${run.style.strokeStyle.lineCap}, lineJoin: .${run.style.strokeStyle.lineJoin}, miterLimit: ${formatNumber(run.style.strokeStyle.miterLimit)}, paintOrder: [${order}], transform: ${swiftTransform(transform)})`;
        })
        .join(", ");
      const adjustments = chunk.lengthAdjustments
        .map(
          (adjustment) =>
            `SVGTextLengthAdjustment(start: ${adjustment.start}, end: ${adjustment.end}, target: ${formatNumber(adjustment.target)}, mode: .${adjustment.mode})`,
        )
        .join(", ");
      const path = chunk.textPath
        ? `SVGTextPath(points: [${chunk.textPath.points.map((point) => `SVGTextPathPoint(x: ${formatNumber(point.x)}, y: ${formatNumber(point.y)}, distance: ${formatNumber(point.distance)}, move: ${point.move})`).join(", ")}], length: ${formatNumber(chunk.textPath.length)}, closed: ${chunk.textPath.closed}, distanceScale: ${formatNumber(chunk.textPath.distanceScale)}, startOffset: ${formatNumber(chunk.textPath.startOffset)}, method: .${chunk.textPath.method}, spacing: .${chunk.textPath.spacing}, side: .${chunk.textPath.side})`
        : "nil";
      const writingMode = chunk.writingMode.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
      return `SVGTextChunk(x: ${chunk.x === undefined ? "nil" : formatNumber(chunk.x)}, y: ${chunk.y === undefined ? "nil" : formatNumber(chunk.y)}, anchor: .${chunk.anchor}, direction: .${chunk.direction}, writingMode: .${writingMode}, lengthAdjustments: [${adjustments}], textPath: ${path}, runs: [${runs}])`;
    })
    .join(`,\n${i3}`);

  return [
    "// CoreText glyph paths preserve SVG metrics; accessibility text is retained, but selection is unavailable.",
    `private struct ${helper.name}: View {`,
    `${indentation}var body: some View {`,
    `${i2}Canvas { context, size in`,
    `${i3}context.withCGContext { graphics in`,
    `${i4}graphics.saveGState()`,
    `${i4}graphics.scaleBy(x: size.width / ${formatNumber(coordinateSpace.width)}, y: size.height / ${formatNumber(coordinateSpace.height)})`,
    `${i4}graphics.translateBy(x: ${formatNumber(-coordinateSpace.x)}, y: ${formatNumber(-coordinateSpace.y)})`,
    `${i4}draw(chunks: [`,
    `${i3}${chunks}`,
    `${i4}], in: graphics)`,
    `${i4}graphics.restoreGState()`,
    `${i3}}`,
    `${i2}}`,
    `${i2}.accessibilityElement(children: .ignore)`,
    `${i2}.accessibilityLabel(${swiftString(helper.node.text)})`,
    `${indentation}}`,
    "",
    `${indentation}private struct SVGTextColor { let red: CGFloat; let green: CGFloat; let blue: CGFloat; let alpha: CGFloat }`,
    `${indentation}private struct SVGTextGradientStop { let location: CGFloat; let color: SVGTextColor }`,
    `${indentation}private struct SVGTextLinearGradient { let stops: [SVGTextGradientStop]; let objectBoundingBox: Bool; let transform: CGAffineTransform; let x1: CGFloat; let y1: CGFloat; let x2: CGFloat; let y2: CGFloat }`,
    `${indentation}private struct SVGTextRadialGradient { let stops: [SVGTextGradientStop]; let objectBoundingBox: Bool; let transform: CGAffineTransform; let cx: CGFloat; let cy: CGFloat; let radius: CGFloat; let fx: CGFloat; let fy: CGFloat; let innerRadius: CGFloat }`,
    `${indentation}private enum SVGTextSource { case color(SVGTextColor), linear(SVGTextLinearGradient), radial(SVGTextRadialGradient) }`,
    `${indentation}private enum SVGTextAnchor { case start, middle, end }`,
    `${indentation}private enum SVGTextBaseline { case alphabetic, middle, central, hanging, textBeforeEdge, textAfterEdge }`,
    `${indentation}private enum SVGTextDecoration { case underline, overline, lineThrough }`,
    `${indentation}private enum SVGTextPaint { case fill, stroke }`,
    `${indentation}private enum SVGTextDirection { case ltr, rtl }`,
    `${indentation}private enum SVGTextWritingMode { case horizontalTb, verticalRl, verticalLr }`,
    `${indentation}private enum SVGTextUnicodeBidi { case normal, embed, isolate, bidiOverride, isolateOverride, plaintext }`,
    `${indentation}private enum SVGTextOrientation { case mixed, upright, sideways }`,
    `${indentation}private enum SVGTextLengthMode { case spacing, spacingAndGlyphs }`,
    `${indentation}private enum SVGTextPathMethod { case align, stretch }`,
    `${indentation}private enum SVGTextPathSpacing { case auto, exact }`,
    `${indentation}private enum SVGTextPathSide { case left, right }`,
    `${indentation}private struct SVGTextCharacter { let text: String; let dx: CGFloat; let dy: CGFloat; let rotation: CGFloat }`,
    `${indentation}private struct SVGTextLengthAdjustment { let start: Int; let end: Int; let target: CGFloat; let mode: SVGTextLengthMode }`,
    `${indentation}private struct SVGTextPathPoint { let x: CGFloat; let y: CGFloat; let distance: CGFloat; let move: Bool }`,
    `${indentation}private struct SVGTextPath { let points: [SVGTextPathPoint]; let length: CGFloat; let closed: Bool; let distanceScale: CGFloat; let startOffset: CGFloat; let method: SVGTextPathMethod; let spacing: SVGTextPathSpacing; let side: SVGTextPathSide }`,
    `${indentation}private struct SVGTextChunk { let x: CGFloat?; let y: CGFloat?; let anchor: SVGTextAnchor; let direction: SVGTextDirection; let writingMode: SVGTextWritingMode; let lengthAdjustments: [SVGTextLengthAdjustment]; let textPath: SVGTextPath?; let runs: [SVGTextRun] }`,
    `${indentation}private struct SVGTextRun {`,
    `${i2}let text: String; let characters: [SVGTextCharacter]; let dx: CGFloat; let dy: CGFloat`,
    `${i2}let family: String; let size: CGFloat; let weight: CGFloat; let width: CGFloat`,
    `${i2}let italic: Bool; let smallCaps: Bool; let sizeAdjust: CGFloat?`,
    `${i2}let letterSpacing: CGFloat; let wordSpacing: CGFloat; let kerning: Bool`,
    `${i2}let baseline: SVGTextBaseline; let baselineShift: CGFloat`,
    `${i2}let decorations: [SVGTextDecoration]; let direction: SVGTextDirection; let unicodeBidi: SVGTextUnicodeBidi; let textOrientation: SVGTextOrientation`,
    `${i2}let fill: SVGTextSource?; let stroke: SVGTextSource?`,
    `${i2}let strokeWidth: CGFloat; let lineCap: CGLineCap; let lineJoin: CGLineJoin; let miterLimit: CGFloat`,
    `${i2}let paintOrder: [SVGTextPaint]; let transform: CGAffineTransform`,
    `${indentation}}`,
    "",
    `${indentation}private struct PreparedChunk { let fonts: [CTFont]; let line: CTLine; let characterRanges: [NSRange]; let runRanges: [NSRange] }`,
    `${indentation}private struct PositionedGlyph { var path: CGPath; let font: CTFont; let glyph: CGGlyph; let runIndex: Int; let characterIndex: Int; var inline: CGFloat; var cross: CGFloat; var advance: CGFloat; var inlineScale: CGFloat }`,
    "",
    `${indentation}private func font(for run: SVGTextRun) -> CTFont {`,
    `${i2}var symbolic: CTFontSymbolicTraits = []`,
    `${i2}if run.italic { symbolic.insert(.traitItalic) }`,
    `${i2}let normalizedWeight = max(-1, min(1, (run.weight - 400) / 750))`,
    `${i2}let normalizedWidth = max(-1, min(1, (run.width - 100) / 100))`,
    `${i2}let traits: [CFString: Any] = [kCTFontWeightTrait: normalizedWeight, kCTFontWidthTrait: normalizedWidth, kCTFontSymbolicTrait: symbolic.rawValue]`,
    `${i2}let variation: [NSNumber: Any] = [NSNumber(value: 2003265652): run.weight, NSNumber(value: 2003072104): run.width]`,
    `${i2}let attributes: [CFString: Any] = [kCTFontFamilyNameAttribute: run.family, kCTFontTraitsAttribute: traits, kCTFontVariationAttribute: variation]`,
    `${i2}let descriptor = CTFontDescriptorCreateWithAttributes(attributes as CFDictionary)`,
    `${i2}var result = CTFontCreateWithFontDescriptor(descriptor, run.size, nil)`,
    `${i2}if let desired = run.sizeAdjust, CTFontGetXHeight(result) > 0 {`,
    `${i3}result = CTFontCreateWithFontDescriptor(descriptor, run.size * desired / (CTFontGetXHeight(result) / run.size), nil)`,
    `${i2}}`,
    `${i2}return result`,
    `${indentation}}`,
    "",
    `${indentation}private let svgRunIndexKey = NSAttributedString.Key("SVGToSwiftUIRunIndex")`,
    "",
    `${indentation}private func bidiControls(_ run: SVGTextRun) -> (prefix: String, suffix: String) {`,
    `${i2}let embed = run.direction == .rtl ? "\\u{202B}" : "\\u{202A}"; let override = run.direction == .rtl ? "\\u{202E}" : "\\u{202D}"`,
    `${i2}let isolate = run.direction == .rtl ? "\\u{2067}" : "\\u{2066}"`,
    `${i2}switch run.unicodeBidi {`,
    `${i2}case .normal: return ("", "")`,
    `${i2}case .embed: return (embed, "\\u{202C}")`,
    `${i2}case .bidiOverride: return (override, "\\u{202C}")`,
    `${i2}case .isolate: return (isolate, "\\u{2069}")`,
    `${i2}case .isolateOverride: return (isolate + override, "\\u{202C}\\u{2069}")`,
    `${i2}case .plaintext: return ("\\u{2068}", "\\u{2069}")`,
    `${i2}}`,
    `${indentation}}`,
    "",
    `${indentation}private func prepare(_ chunk: SVGTextChunk) -> PreparedChunk {`,
    `${i2}let attributed = NSMutableAttributedString()`,
    `${i2}var fonts: [CTFont] = []; var characterRanges: [NSRange] = []; var runRanges: [NSRange] = []`,
    `${i2}for (runIndex, run) in chunk.runs.enumerated() {`,
    `${i3}let resolvedFont = font(for: run); fonts.append(resolvedFont)`,
    `${i3}let start = attributed.length; let characterStart = characterRanges.count`,
    `${i3}let controls = bidiControls(run); attributed.append(NSAttributedString(string: controls.prefix))`,
    `${i3}for character in run.characters {`,
    `${i4}let range = NSRange(location: attributed.length, length: (character.text as NSString).length)`,
    `${i4}attributed.append(NSAttributedString(string: character.text)); characterRanges.append(range)`,
    `${i3}}`,
    `${i3}attributed.append(NSAttributedString(string: controls.suffix))`,
    `${i3}let range = NSRange(location: start, length: attributed.length - start); runRanges.append(range)`,
    `${i3}attributed.addAttribute(NSAttributedString.Key(kCTFontAttributeName as String), value: resolvedFont, range: range)`,
    `${i3}attributed.addAttribute(svgRunIndexKey, value: NSNumber(value: runIndex), range: range)`,
    `${i3}if run.letterSpacing != 0 || !run.kerning { attributed.addAttribute(NSAttributedString.Key(kCTKernAttributeName as String), value: run.letterSpacing, range: range) }`,
    `${i3}if run.wordSpacing != 0 { for index in run.characters.indices where run.characters[index].text == " " { attributed.addAttribute(NSAttributedString.Key(kCTKernAttributeName as String), value: run.letterSpacing + run.wordSpacing, range: characterRanges[characterStart + index]) } }`,
    `${i2}}`,
    `${i2}let fullRange = NSRange(location: 0, length: attributed.length); let baseDirection = chunk.direction == .rtl ? 1 : 0`,
    `${i2}attributed.addAttribute(NSAttributedString.Key(kCTWritingDirectionAttributeName as String), value: [NSNumber(value: baseDirection)], range: fullRange)`,
    `${i2}if chunk.runs.flatMap(\\.characters).contains(where: { $0.dx != 0 || $0.dy != 0 || $0.rotation != 0 }) {`,
    `${i3}attributed.addAttribute(NSAttributedString.Key(kCTLigatureAttributeName as String), value: 0, range: NSRange(location: 0, length: attributed.length))`,
    `${i2}}`,
    `${i2}return PreparedChunk(fonts: fonts, line: CTLineCreateWithAttributedString(attributed), characterRanges: characterRanges, runRanges: runRanges)`,
    `${indentation}}`,
    "",
    `${indentation}private func baselineOffset(run: SVGTextRun, font: CTFont) -> CGFloat {`,
    `${i2}let ascent = CTFontGetAscent(font); let descent = CTFontGetDescent(font)`,
    `${i2}switch run.baseline {`,
    `${i2}case .alphabetic: return -run.baselineShift`,
    `${i2}case .middle: return CTFontGetXHeight(font) / 2 - run.baselineShift`,
    `${i2}case .central: return (ascent - descent) / 2 - run.baselineShift`,
    `${i2}case .hanging: return ascent * 0.8 - run.baselineShift`,
    `${i2}case .textBeforeEdge: return ascent - run.baselineShift`,
    `${i2}case .textAfterEdge: return -descent - run.baselineShift`,
    `${i2}}`,
    `${indentation}}`,
    "",
    `${indentation}private func characterIndex(_ stringIndex: CFIndex, ranges: [NSRange]) -> Int {`,
    `${i2}guard stringIndex != kCFNotFound else { return 0 }`,
    `${i2}return ranges.firstIndex(where: { NSLocationInRange(stringIndex, $0) }) ?? max(0, ranges.count - 1)`,
    `${indentation}}`,
    "",
    `${indentation}private func glyphs(for chunk: SVGTextChunk, prepared: PreparedChunk) -> [PositionedGlyph] {`,
    `${i2}let characters = chunk.runs.flatMap(\\.characters)`,
    `${i2}let characterRuns = chunk.runs.enumerated().flatMap { index, run in run.characters.map { _ in index } }`,
    `${i2}var verticalOffsets: [CGFloat] = []; var verticalAdvances: [CGFloat] = []; var verticalCursor: CGFloat = 0`,
    `${i2}for index in characters.indices {`,
    `${i3}let run = chunk.runs[characterRuns[index]]; let range = prepared.characterRanges[index]`,
    `${i3}let start = CTLineGetOffsetForStringIndex(prepared.line, range.location, nil); let end = CTLineGetOffsetForStringIndex(prepared.line, range.location + range.length, nil)`,
    `${i3}let upright = run.textOrientation == .upright || (run.textOrientation == .mixed && naturallyUpright(characters[index].text))`,
    `${i3}let advance = upright ? run.size + run.letterSpacing : abs(end - start)`,
    `${i3}verticalOffsets.append(verticalCursor); verticalAdvances.append(advance); verticalCursor += advance`,
    `${i2}}`,
    `${i2}var xAdjust: [CGFloat] = []; var yAdjust: [CGFloat] = []; var x: CGFloat = 0; var y: CGFloat = 0`,
    `${i2}for character in characters { x += character.dx; y += character.dy; xAdjust.append(x); yAdjust.append(y) }`,
    `${i2}var result: [PositionedGlyph] = []`,
    `${i2}for case let glyphRun as CTRun in CTLineGetGlyphRuns(prepared.line) as NSArray {`,
    `${i3}let count = CTRunGetGlyphCount(glyphRun); if count == 0 { continue }`,
    `${i3}let attributes = CTRunGetAttributes(glyphRun) as NSDictionary`,
    `${i3}let runIndex = (attributes[svgRunIndexKey] as? NSNumber)?.intValue ?? 0`,
    `${i3}let resolvedFont = attributes[NSAttributedString.Key(kCTFontAttributeName as String)] as! CTFont`,
    `${i3}var glyphValues = [CGGlyph](repeating: 0, count: count); var positions = [CGPoint](repeating: .zero, count: count)`,
    `${i3}var advances = [CGSize](repeating: .zero, count: count); var indices = [CFIndex](repeating: 0, count: count)`,
    `${i3}CTRunGetGlyphs(glyphRun, CFRange(location: 0, length: 0), &glyphValues); CTRunGetPositions(glyphRun, CFRange(location: 0, length: 0), &positions)`,
    `${i3}CTRunGetAdvances(glyphRun, CFRange(location: 0, length: 0), &advances); CTRunGetStringIndices(glyphRun, CFRange(location: 0, length: 0), &indices)`,
    `${i3}for index in 0..<count {`,
    `${i4}guard let glyphPath = CTFontCreatePathForGlyph(resolvedFont, glyphValues[index], nil) else { continue }`,
    `${i4}let character = characterIndex(indices[index], ranges: prepared.characterRanges)`,
    `${i4}let inlineAdjust = chunk.writingMode == .horizontalTb ? xAdjust[character] : yAdjust[character]`,
    `${i4}let crossAdjust = chunk.writingMode == .horizontalTb ? yAdjust[character] : xAdjust[character]`,
    `${i4}let inline = chunk.writingMode == .horizontalTb ? positions[index].x + inlineAdjust : verticalOffsets[character] + inlineAdjust`,
    `${i4}let advance = chunk.writingMode == .horizontalTb ? advances[index].width : verticalAdvances[character]`,
    `${i4}result.append(PositionedGlyph(path: glyphPath, font: resolvedFont, glyph: glyphValues[index], runIndex: runIndex, characterIndex: character, inline: inline, cross: -positions[index].y + crossAdjust, advance: advance, inlineScale: 1))`,
    `${i3}}`,
    `${i2}}`,
    `${i2}return result`,
    `${indentation}}`,
    "",
    `${indentation}private func applyLengthAdjustments(_ adjustments: [SVGTextLengthAdjustment], to source: [PositionedGlyph]) -> [PositionedGlyph] {`,
    `${i2}var glyphs = source`,
    `${i2}for adjustment in adjustments.sorted(by: { ($0.end - $0.start) < ($1.end - $1.start) }) {`,
    `${i3}let selected = glyphs.indices.filter { glyphs[$0].characterIndex >= adjustment.start && glyphs[$0].characterIndex < adjustment.end }.sorted { glyphs[$0].inline < glyphs[$1].inline }`,
    `${i3}guard let first = selected.first, let last = selected.last else { continue }`,
    `${i3}let start = glyphs[first].inline; let end = glyphs[last].inline + glyphs[last].advance * glyphs[last].inlineScale`,
    `${i3}let natural = end - start; guard natural != 0 else { continue }`,
    `${i3}let delta = adjustment.target - natural`,
    `${i3}if adjustment.mode == .spacing && selected.count > 1 {`,
    `${i4}let gap = delta / CGFloat(selected.count - 1)`,
    `${i4}for (ordinal, index) in selected.enumerated() { glyphs[index].inline += CGFloat(ordinal) * gap }`,
    `${i3}} else {`,
    `${i4}let scale = adjustment.target / natural`,
    `${i4}for index in selected { glyphs[index].inline = start + (glyphs[index].inline - start) * scale; glyphs[index].inlineScale *= scale }`,
    `${i3}}`,
    `${i3}let selectedSet = Set(selected)`,
    `${i3}for index in glyphs.indices where !selectedSet.contains(index) && glyphs[index].inline > end { glyphs[index].inline += delta }`,
    `${i2}}`,
    `${i2}return glyphs`,
    `${indentation}}`,
    "",
    `${indentation}private func cgColor(_ color: SVGTextColor) -> CGColor {`,
    `${i2}CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [color.red, color.green, color.blue, color.alpha])!`,
    `${indentation}}`,
    "",
    `${indentation}private func cgGradient(_ stops: [SVGTextGradientStop]) -> CGGradient? {`,
    `${i2}CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB)!, colors: stops.map { cgColor($0.color) } as CFArray, locations: stops.map(\\.location))`,
    `${indentation}}`,
    "",
    `${indentation}private func paint(_ source: SVGTextSource, path: CGPath, run: SVGTextRun, stroke: Bool, in graphics: CGContext) {`,
    `${i2}graphics.saveGState()`,
    `${i2}graphics.addPath(path)`,
    `${i2}if stroke { graphics.setLineWidth(run.strokeWidth); graphics.setLineCap(run.lineCap); graphics.setLineJoin(run.lineJoin); graphics.setMiterLimit(run.miterLimit) }`,
    `${i2}switch source {`,
    `${i2}case .color(let color):`,
    `${i3}if stroke { graphics.setStrokeColor(cgColor(color)); graphics.strokePath() } else { graphics.setFillColor(cgColor(color)); graphics.fillPath() }`,
    `${i2}case .linear(let value):`,
    `${i3}if stroke { graphics.replacePathWithStrokedPath() }`,
    `${i3}let bounds = stroke ? path.boundingBoxOfPath.insetBy(dx: -run.strokeWidth / 2, dy: -run.strokeWidth / 2) : path.boundingBoxOfPath`,
    `${i3}graphics.clip()`,
    `${i3}if value.objectBoundingBox { graphics.concatenate(CGAffineTransform(translationX: bounds.minX, y: bounds.minY).scaledBy(x: bounds.width, y: bounds.height)) }`,
    `${i3}graphics.concatenate(value.transform)`,
    `${i3}if let gradient = cgGradient(value.stops) {`,
    `${i4}graphics.drawLinearGradient(gradient, start: CGPoint(x: value.x1, y: value.y1), end: CGPoint(x: value.x2, y: value.y2), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
    `${i3}}`,
    `${i2}case .radial(let value):`,
    `${i3}if stroke { graphics.replacePathWithStrokedPath() }`,
    `${i3}let bounds = stroke ? path.boundingBoxOfPath.insetBy(dx: -run.strokeWidth / 2, dy: -run.strokeWidth / 2) : path.boundingBoxOfPath`,
    `${i3}graphics.clip()`,
    `${i3}if value.objectBoundingBox { graphics.concatenate(CGAffineTransform(translationX: bounds.minX, y: bounds.minY).scaledBy(x: bounds.width, y: bounds.height)) }`,
    `${i3}graphics.concatenate(value.transform)`,
    `${i3}if let gradient = cgGradient(value.stops) {`,
    `${i4}graphics.drawRadialGradient(gradient, startCenter: CGPoint(x: value.fx, y: value.fy), startRadius: value.innerRadius, endCenter: CGPoint(x: value.cx, y: value.cy), endRadius: value.radius, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
    `${i3}}`,
    `${i2}}`,
    `${i2}graphics.restoreGState()`,
    `${indentation}}`,
    "",
    `${indentation}private func anchorShift(_ chunk: SVGTextChunk, length: CGFloat) -> CGFloat {`,
    `${i2}if chunk.anchor == .middle { return -length / 2 }`,
    `${i2}if chunk.writingMode != .horizontalTb { return chunk.anchor == .end ? -length : 0 }`,
    `${i2}if chunk.direction == .rtl { return chunk.anchor == .start ? -length : 0 }`,
    `${i2}return chunk.anchor == .end ? -length : 0`,
    `${indentation}}`,
    "",
    `${indentation}private func position(on path: SVGTextPath, at authoredDistance: CGFloat) -> (point: CGPoint, angle: CGFloat)? {`,
    `${i2}var distance = authoredDistance`,
    `${i2}if path.closed { distance = distance.truncatingRemainder(dividingBy: path.length); if distance < 0 { distance += path.length } }`,
    `${i2}guard distance >= 0 && distance <= path.length else { return nil }`,
    `${i2}if path.side == .right { distance = path.length - distance }`,
    `${i2}for index in 1..<path.points.count {`,
    `${i3}let end = path.points[index]; let start = path.points[index - 1]`,
    `${i3}if end.move || distance < start.distance || distance > end.distance { continue }`,
    `${i3}let span = end.distance - start.distance; let ratio = span == 0 ? 0 : (distance - start.distance) / span`,
    `${i3}let point = CGPoint(x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio)`,
    `${i3}var angle = atan2(end.y - start.y, end.x - start.x)`,
    `${i3}if path.side == .right { angle += .pi }`,
    `${i3}return (point, angle)`,
    `${i2}}`,
    `${i2}return nil`,
    `${indentation}}`,
    "",
    `${indentation}private func naturallyUpright(_ text: String) -> Bool {`,
    `${i2}guard let value = text.unicodeScalars.first?.value else { return false }`,
    `${i2}return (0x2E80...0xA4CF).contains(value) || (0xAC00...0xD7AF).contains(value) || (0xF900...0xFAFF).contains(value) || (0xFE10...0xFE6F).contains(value) || (0x1F200...0x1F2FF).contains(value)`,
    `${indentation}}`,
    "",
    `${indentation}private func mappedPath(_ source: CGPath, map: @escaping (CGPoint) -> CGPoint?) -> CGPath {`,
    `${i2}let result = CGMutablePath()`,
    `${i2}source.applyWithBlock { pointer in`,
    `${i3}let element = pointer.pointee`,
    `${i3}switch element.type {`,
    `${i3}case .moveToPoint: if let point = map(element.points[0]) { result.move(to: point) }`,
    `${i3}case .addLineToPoint: if let point = map(element.points[0]) { result.addLine(to: point) }`,
    `${i3}case .addQuadCurveToPoint: if let control = map(element.points[0]), let point = map(element.points[1]) { result.addQuadCurve(to: point, control: control) }`,
    `${i3}case .addCurveToPoint: if let first = map(element.points[0]), let second = map(element.points[1]), let point = map(element.points[2]) { result.addCurve(to: point, control1: first, control2: second) }`,
    `${i3}case .closeSubpath: result.closeSubpath()`,
    `${i3}@unknown default: break`,
    `${i3}}`,
    `${i2}}`,
    `${i2}return result`,
    `${indentation}}`,
    "",
    `${indentation}private func placedPath(_ source: CGPath, item: PositionedGlyph, chunk: SVGTextChunk, origin: CGPoint, shift: CGFloat, rotation: CGFloat, character: SVGTextCharacter) -> CGPath? {`,
    `${i2}let run = chunk.runs[item.runIndex]; let baseline = baselineOffset(run: run, font: item.font)`,
    `${i2}if let path = chunk.textPath {`,
    `${i3}let scale = item.inlineScale; let start = path.startOffset + shift + item.inline`,
    `${i3}if path.method == .stretch {`,
    `${i4}return mappedPath(source) { point in`,
    `${i5}let radians = rotation * .pi / 180; let localX = point.x * cos(radians) - point.y * sin(radians); let localY = point.x * sin(radians) + point.y * cos(radians)`,
    `${i5}guard let placement = position(on: path, at: start + localX * scale) else { return nil }`,
    `${i5}let normal = placement.angle - .pi / 2; let cross = item.cross + baseline - localY`,
    `${i5}return CGPoint(x: placement.point.x + cos(normal) * cross, y: placement.point.y + sin(normal) * cross)`,
    `${i4}}`,
    `${i3}}`,
    `${i3}let center = start + item.advance * scale / 2; guard let placement = position(on: path, at: center) else { return nil }`,
    `${i3}var transform = CGAffineTransform(translationX: placement.point.x, y: placement.point.y).rotated(by: placement.angle + rotation * .pi / 180).translatedBy(x: -item.advance * scale / 2, y: item.cross + baseline).scaledBy(x: scale, y: -1)`,
    `${i3}return source.copy(using: &transform)`,
    `${i2}}`,
    `${i2}if chunk.writingMode == .horizontalTb {`,
    `${i3}var transform = CGAffineTransform(translationX: origin.x + shift + item.inline, y: origin.y + item.cross + baseline).rotated(by: rotation * .pi / 180).scaledBy(x: item.inlineScale, y: -1)`,
    `${i3}return source.copy(using: &transform)`,
    `${i2}}`,
    `${i2}let orientation = run.textOrientation; let sideways = orientation == .sideways || (orientation == .mixed && !naturallyUpright(character.text))`,
    `${i2}let orientationAngle: CGFloat = sideways ? 90 : 0`,
    `${i2}let bounds = source.boundingBoxOfPath`,
    `${i2}let verticalX = sideways ? origin.x + item.cross + baseline - run.size * 0.31 : origin.x + item.cross + baseline - bounds.midX`,
    `${i2}let verticalY = sideways ? origin.y + shift + item.inline : origin.y + shift + item.inline + bounds.maxY`,
    `${i2}var transform = CGAffineTransform(translationX: verticalX, y: verticalY).rotated(by: (orientationAngle + rotation) * .pi / 180).scaledBy(x: item.inlineScale, y: -1)`,
    `${i2}return source.copy(using: &transform)`,
    `${indentation}}`,
    "",
    `${indentation}private func draw(chunks: [SVGTextChunk], in graphics: CGContext) {`,
    `${i2}var currentX: CGFloat = 0; var currentY: CGFloat = 0`,
    `${i2}for chunk in chunks {`,
    `${i3}if let x = chunk.x { currentX = x }; if let y = chunk.y { currentY = y }`,
    `${i3}let prepared = prepare(chunk); let characters = chunk.runs.flatMap(\\.characters)`,
    `${i3}let glyphs = applyLengthAdjustments(chunk.lengthAdjustments, to: glyphs(for: chunk, prepared: prepared))`,
    `${i3}guard !glyphs.isEmpty else { continue }`,
    `${i3}let minimum = glyphs.map(\\.inline).min() ?? 0; let maximum = glyphs.map { $0.inline + $0.advance * $0.inlineScale }.max() ?? 0`,
    `${i3}let length = maximum - minimum; let shift = anchorShift(chunk, length: length) - minimum`,
    `${i3}let origin = CGPoint(x: currentX, y: currentY); let paths = chunk.runs.map { _ in CGMutablePath() }`,
    `${i3}for item in glyphs {`,
    `${i4}let character = characters[item.characterIndex]`,
    `${i4}if let path = placedPath(item.path, item: item, chunk: chunk, origin: origin, shift: shift, rotation: character.rotation, character: character) {`,
    `${i5}var transform = chunk.runs[item.runIndex].transform; paths[item.runIndex].addPath(path.copy(using: &transform) ?? path)`,
    `${i4}}`,
    `${i4}let run = chunk.runs[item.runIndex]; let thickness = max(CTFontGetUnderlineThickness(item.font), run.size / 16)`,
    `${i4}for decoration in run.decorations {`,
    `${i5}let y: CGFloat`,
    `${i5}switch decoration { case .underline: y = CTFontGetUnderlinePosition(item.font); case .overline: y = CTFontGetAscent(item.font); case .lineThrough: y = CTFontGetXHeight(item.font) / 2 }`,
    `${i5}let decorationPath = CGPath(rect: CGRect(x: 0, y: y, width: item.advance, height: thickness), transform: nil)`,
    `${i5}if let placed = placedPath(decorationPath, item: item, chunk: chunk, origin: origin, shift: shift, rotation: character.rotation, character: character) { var transform = run.transform; paths[item.runIndex].addPath(placed.copy(using: &transform) ?? placed) }`,
    `${i4}}`,
    `${i3}}`,
    `${i3}for (index, run) in chunk.runs.enumerated() {`,
    `${i4}let path = paths[index]`,
    `${i4}for phase in run.paintOrder {`,
    `${i5}switch phase {`,
    `${i5}case .fill: if let fill = run.fill { paint(fill, path: path, run: run, stroke: false, in: graphics) }`,
    `${i5}case .stroke: if let stroke = run.stroke, run.strokeWidth > 0 { paint(stroke, path: path, run: run, stroke: true, in: graphics) }`,
    `${i5}}`,
    `${i4}}`,
    `${i3}}`,
    `${i3}if let path = chunk.textPath, let end = position(on: path, at: path.length) { currentX = end.point.x; currentY = end.point.y } else if chunk.writingMode == .horizontalTb { currentX += shift + maximum } else { currentY += shift + maximum }`,
    `${i2}}`,
    `${indentation}}`,
    `}`,
  ];
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
    if (node.type === "text" || node.type === "image") continue;
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
    const commandClipHelpers = node.clipPath ? simpleClipPathHelpers(node.clipPath) : [];
    const needsLayer =
      node.isolated || node.viewportClip !== undefined || node.clipPath !== undefined || node.blendMode !== "normal";
    if (!needsLayer) {
      lines.push(...renderGeneratedCommands(node.children, graphicsName, level, indentation));
      continue;
    }
    lines.push(`${prefix}do {`, `${inner}${graphicsName}.saveGState()`);
    if (node.viewportClip)
      lines.push(
        `${inner}${graphicsName}.addPath(${node.viewportClip}().path(in: CGRect(origin: .zero, size: size)).cgPath)`,
        `${inner}${graphicsName}.clip()`,
      );
    if (commandClipHelpers && commandClipHelpers.length > 0) {
      lines.push(`${inner}let clipUnion = CGMutablePath()`);
      for (const helper of commandClipHelpers)
        lines.push(`${inner}clipUnion.addPath(${helper}().path(in: CGRect(origin: .zero, size: size)).cgPath)`);
      lines.push(`${inner}${graphicsName}.addPath(clipUnion)`, `${inner}${graphicsName}.clip()`);
    } else if (node.clipPath) {
      // Complex clip subtrees are rendered correctly by the SwiftUI view path.
      // Command-mode pattern content currently has no Core Graphics path
      // boolean operation for a nested clipped union, so an empty clip is the
      // safe deterministic result instead of leaking unclipped paint.
      lines.push(`${inner}${graphicsName}.clip(to: .zero)`);
    }
    if (node.blendMode !== "normal")
      lines.push(`${inner}${graphicsName}.setBlendMode(.${swiftBlendMode(node.blendMode)})`);
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

function simpleClipPathHelpers(clipPath: GeneratedClipPath): string[] | undefined {
  const helpers: string[] = [];
  const visit = (nodes: GeneratedViewNode[]): boolean => {
    for (const node of nodes) {
      if (node.type === "paint") {
        if (node.clipUnions) return false;
        helpers.push(node.helper);
        continue;
      }
      if (
        node.type !== "group" ||
        node.opacity !== 1 ||
        node.isolated ||
        node.blendMode !== "normal" ||
        node.viewportClip ||
        node.clipPath ||
        node.mask ||
        !visit(node.children)
      )
        return false;
    }
    return true;
  };
  return visit(clipPath.children) ? helpers : undefined;
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
    !node.viewportClip &&
    !node.clipPath &&
    !node.mask &&
    node.blendMode === "normal" &&
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
  if (node.type === "text" || node.type === "image") return [`${prefix}${node.helper}()`];
  if (node.type === "paint") {
    if (!node.clipUnions) return [`${prefix}${node.helper}().fill(${node.swiftColor})`];
    const inner = `${prefix}${indentation}`;
    const deep = `${inner}${indentation}`;
    const lines = [
      `${prefix}Canvas { context, size in`,
      `${inner}context.withCGContext { graphics in`,
      `${deep}graphics.saveGState()`,
    ];
    for (const [index, helpers] of node.clipUnions.entries()) {
      lines.push(`${deep}let clipUnion${index} = CGMutablePath()`);
      for (const helper of helpers)
        lines.push(`${deep}clipUnion${index}.addPath(${helper}().path(in: CGRect(origin: .zero, size: size)).cgPath)`);
      lines.push(`${deep}graphics.addPath(clipUnion${index})`, `${deep}graphics.clip()`);
    }
    lines.push(
      `${deep}graphics.addPath(${node.helper}().path(in: CGRect(origin: .zero, size: size)).cgPath)`,
      `${deep}graphics.setFillColor(CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [${formatNumber(node.cgColor.red)}, ${formatNumber(node.cgColor.green)}, ${formatNumber(node.cgColor.blue)}, ${formatNumber(node.cgColor.alpha)}])!)`,
      `${deep}graphics.fillPath()`,
      `${deep}graphics.restoreGState()`,
      `${inner}}`,
      `${prefix}}`,
    );
    return lines;
  }
  if (node.type === "gradient") return renderGradientNode(node, level, indentation);
  if (node.type === "pattern") return renderPatternNode(node, level, indentation);
  const lines = [`${prefix}ZStack {`];
  for (const child of node.children) lines.push(...renderViewNode(child, level + 1, indentation));
  lines.push(`${prefix}}`);
  // Flatten the source subtree before applying SVG effects. SwiftUI otherwise
  // distributes masks and opacity across ZStack children, which changes
  // overlap colors and prevents nested clip-path intersections from composing.
  if (node.isolated) lines.push(`${prefix}.compositingGroup()`);
  if (node.viewportClip) lines.push(`${prefix}.clipShape(${node.viewportClip}())`);
  if (node.clipPath) {
    const simpleHelpers = simpleClipPathHelpers(node.clipPath);
    if (simpleHelpers?.length === 1) {
      lines.push(`${prefix}.clipShape(${simpleHelpers[0]}())`);
    } else {
      lines.push(
        `${prefix}.mask {`,
        `${prefix}${indentation}GeometryReader { proxy in`,
        `${prefix}${indentation}${indentation}ZStack {`,
      );
      if (node.clipPath.children.length === 0)
        lines.push(`${prefix}${indentation}${indentation}${indentation}Color.clear`);
      else for (const child of node.clipPath.children) lines.push(...renderViewNode(child, level + 3, indentation));
      lines.push(
        `${prefix}${indentation}${indentation}}`,
        `${prefix}${indentation}${indentation}.frame(width: proxy.size.width, height: proxy.size.height)`,
        `${prefix}${indentation}}`,
        `${prefix}}`,
      );
    }
  }
  if (node.mask) {
    if (node.mask.luminance) {
      lines.push(
        `${prefix}.mask {`,
        `${prefix}${indentation}GeometryReader { proxy in`,
        `${prefix}${indentation}${indentation}Canvas { context, size in`,
        `${prefix}${indentation}${indentation}${indentation}var matrix = ColorMatrix()`,
        `${prefix}${indentation}${indentation}${indentation}matrix.r1 = 0`,
        `${prefix}${indentation}${indentation}${indentation}matrix.g2 = 0`,
        `${prefix}${indentation}${indentation}${indentation}matrix.b3 = 0`,
        `${prefix}${indentation}${indentation}${indentation}matrix.a1 = 0.2125`,
        `${prefix}${indentation}${indentation}${indentation}matrix.a2 = 0.7154`,
        `${prefix}${indentation}${indentation}${indentation}matrix.a3 = 0.0721`,
        `${prefix}${indentation}${indentation}${indentation}matrix.a4 = 0`,
        `${prefix}${indentation}${indentation}${indentation}context.addFilter(.colorMatrix(matrix))`,
        `${prefix}${indentation}${indentation}${indentation}if let symbol = context.resolveSymbol(id: 0) {`,
        `${prefix}${indentation}${indentation}${indentation}${indentation}context.draw(symbol, at: .zero, anchor: .topLeading)`,
        `${prefix}${indentation}${indentation}${indentation}}`,
        `${prefix}${indentation}${indentation}} symbols: {`,
        `${prefix}${indentation}${indentation}${indentation}ZStack {`,
      );
      if (node.mask.children.length === 0)
        lines.push(`${prefix}${indentation}${indentation}${indentation}${indentation}Color.clear`);
      else for (const child of node.mask.children) lines.push(...renderViewNode(child, level + 4, indentation));
      lines.push(
        `${prefix}${indentation}${indentation}${indentation}}`,
        `${prefix}${indentation}${indentation}${indentation}.clipShape(${node.mask.clip}())`,
        `${prefix}${indentation}${indentation}${indentation}.frame(width: proxy.size.width, height: proxy.size.height)`,
        `${prefix}${indentation}${indentation}${indentation}.tag(0)`,
        `${prefix}${indentation}${indentation}}`,
        `${prefix}${indentation}${indentation}.mask {`,
        `${prefix}${indentation}${indentation}${indentation}ZStack {`,
      );
      if (node.mask.children.length === 0)
        lines.push(`${prefix}${indentation}${indentation}${indentation}${indentation}Color.clear`);
      else for (const child of node.mask.children) lines.push(...renderViewNode(child, level + 4, indentation));
      lines.push(
        `${prefix}${indentation}${indentation}${indentation}}`,
        `${prefix}${indentation}${indentation}${indentation}.clipShape(${node.mask.clip}())`,
        `${prefix}${indentation}${indentation}}`,
        `${prefix}${indentation}}`,
        `${prefix}}`,
      );
    } else {
      lines.push(`${prefix}.mask {`, `${prefix}${indentation}ZStack {`);
      if (node.mask.children.length === 0) lines.push(`${prefix}${indentation}${indentation}Color.clear`);
      else for (const child of node.mask.children) lines.push(...renderViewNode(child, level + 2, indentation));
      lines.push(`${prefix}${indentation}}`, `${prefix}${indentation}.clipShape(${node.mask.clip}())`, `${prefix}}`);
    }
  }
  if (node.opacity !== 1) lines.push(`${prefix}.opacity(${swiftNumber(node.opacity)})`);
  if (node.blendMode !== "normal") lines.push(`${prefix}.blendMode(.${swiftBlendMode(node.blendMode)})`);
  return lines;
}

function swiftBlendMode(mode: SVGBlendMode): string {
  return mode.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function containsGradientNode(nodes: GeneratedViewNode[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "gradient" ||
      (node.type === "group" &&
        (containsGradientNode(node.children) ||
          (node.clipPath ? containsGradientNode(node.clipPath.children) : false) ||
          (node.mask ? containsGradientNode(node.mask.children) : false))) ||
      (node.type === "pattern" && containsGradientNode(node.contentNodes)),
  );
}

function base64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const combined = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    result += alphabet[(combined >> 18) & 63];
    result += alphabet[(combined >> 12) & 63];
    result += index + 1 < bytes.length ? alphabet[(combined >> 6) & 63] : "=";
    result += index + 2 < bytes.length ? alphabet[combined & 63] : "=";
  }
  return result;
}

function createImageHelper(
  helper: ViewBuildContext["imageHelpers"][number],
  coordinateSpace: ViewBoxData,
  indentationSize: number,
): string[] {
  const indentation = " ".repeat(indentationSize);
  const i2 = indentation.repeat(2);
  const i3 = indentation.repeat(3);
  const i4 = indentation.repeat(4);
  const node = helper.node;
  const resource = node.resource!;
  const intrinsic =
    resource.type === "raster"
      ? (resource.intrinsicSize ?? { width: node.viewport.width, height: node.viewport.height })
      : { width: resource.document.viewport.width, height: resource.document.viewport.height };
  const preserveAspectRatio =
    resource.type === "svg" && node.preserveAspectRatio.defer && resource.hasReferencedPreserveAspectRatio
      ? resource.referencedPreserveAspectRatio
      : node.preserveAspectRatio;
  const placement = viewBoxTransform(
    { x: 0, y: 0, width: intrinsic.width, height: intrinsic.height },
    node.viewport,
    preserveAspectRatio,
  );
  const imageTransform = multiplyTransforms(helper.transform, placement);
  const quality = /pixelated|crisp-edges/i.test(node.imageRendering)
    ? "none"
    : /optimizequality|high-quality/i.test(node.imageRendering)
      ? "high"
      : "default";
  const body: string[] = [
    `private struct ${helper.name}: View {`,
    `${indentation}var body: some View {`,
    `${i2}Canvas { context, size in`,
    `${i3}context.clip(to: Path(CGRect(x: ${formatNumber(node.viewport.x)}, y: ${formatNumber(node.viewport.y)}, width: ${formatNumber(node.viewport.width)}, height: ${formatNumber(node.viewport.height)})).applying(${runtimeTransform(helper.transform, coordinateSpace)}))`,
    `${i3}context.transform = ${runtimeTransform(imageTransform, coordinateSpace)}`,
  ];
  if (quality !== "default") body.push(`${i3}context.withCGContext { $0.interpolationQuality = .${quality} }`);
  if (resource.type === "svg") {
    body.push(
      `${i3}if let image = context.resolveSymbol(id: 0) {`,
      `${i4}context.draw(image, in: CGRect(x: 0, y: 0, width: ${formatNumber(intrinsic.width)}, height: ${formatNumber(intrinsic.height)}))`,
      `${i3}}`,
      `${i2}} symbols: {`,
      `${i3}${helper.subdocumentName!}()`,
      `${i3}.frame(width: ${formatNumber(intrinsic.width)}, height: ${formatNumber(intrinsic.height)})`,
      `${i3}.tag(0)`,
      `${i2}}`,
    );
  } else if (resource.assetName) {
    body.push(
      `${i3}let image = context.resolve(Image(${swiftString(resource.assetName)}))`,
      `${i3}context.draw(image, in: CGRect(x: 0, y: 0, width: ${formatNumber(intrinsic.width)}, height: ${formatNumber(intrinsic.height)}))`,
      `${i2}}`,
    );
  } else {
    body.push(
      `${i3}if let source = Self.embeddedImage {`,
      `${i4}let image = context.resolve(source)`,
      `${i4}context.draw(image, in: CGRect(x: 0, y: 0, width: ${formatNumber(intrinsic.width)}, height: ${formatNumber(intrinsic.height)}))`,
      `${i3}}`,
      `${i2}}`,
    );
  }
  body.push(`${indentation}}`);
  if (resource.type === "raster" && resource.bytes) {
    body.push(
      "",
      `${indentation}private static let embeddedImage: Image? = {`,
      `${i2}guard let data = Data(base64Encoded: ${swiftString(base64(resource.bytes!))}),`,
      `${i2}${indentation}let source = CGImageSourceCreateWithData(data as CFData, nil),`,
      `${i2}${indentation}let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }`,
      `${i2}return Image(decorative: image, scale: 1, orientation: .up)`,
      `${indentation}}()`,
    );
  }
  body.push(`}`);
  return body;
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
  textHelpers: ViewBuildContext["textHelpers"],
  imageHelpers: ViewBuildContext["imageHelpers"],
  coordinateSpace: ViewBoxData,
  document: RenderDocument,
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
  for (const helper of textHelpers)
    body.push("", ...createTextHelper(helper, coordinateSpace, document, indentationSize));
  for (const helper of imageHelpers) body.push("", ...createImageHelper(helper, coordinateSpace, indentationSize));
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
    textHelpers: [],
    imageHelpers: [],
    subdocuments: [],
    rootName: config.structName ?? "SVGView",
    config,
  };
  const nodes = buildViewNodes(document.children, context);
  const imports = new Set<string>();
  if (context.textHelpers.length > 0) imports.add("CoreText");
  if (context.imageHelpers.some((helper) => helper.node.resource?.type === "raster" && helper.node.resource.bytes)) {
    imports.add("Foundation");
    imports.add("ImageIO");
  }
  if (context.textHelpers.length > 0 || context.imageHelpers.length > 0) imports.add("SwiftUI");
  return {
    lines: [
      ...[...imports].flatMap((name) => [`import ${name}`]),
      ...(imports.size > 0 ? [""] : []),
      ...createView(
        config.structName ?? "SVGView",
        nodes,
        context.helpers,
        context.textHelpers,
        context.imageHelpers,
        document.viewport.coordinateSpace,
        document,
        indentationSize,
      ),
      ...context.subdocuments.flatMap((lines) => ["", ...lines]),
    ],
    preservesColors: true,
  };
}
