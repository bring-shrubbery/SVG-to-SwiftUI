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
  AccessibilityMetadata,
  ClipPathInstance,
  ComputedStyle,
  FilterInput,
  FilterInstance,
  FilterPrimitive,
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
      filter?: GeneratedFilter;
      tileContained?: boolean;
      accessibility?: AccessibilityMetadata;
    };

interface GeneratedMask {
  children: GeneratedViewNode[];
  clip: string;
  luminance: boolean;
}

interface GeneratedFilter {
  instance: FilterInstance;
  canvas: ViewBoxData;
  imageHelpers: Array<{ key: string; name: string }>;
  maxOutputPixels: number;
}

interface FilterImageHelper {
  key: string;
  name: string;
  primitive: Extract<FilterPrimitive, { type: "image" }>;
  canvas: ViewBoxData;
  subdocumentName?: string;
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
    node: Extract<RenderNode, { type: "image" | "foreignObject" }>;
    transform: RenderNode["transform"];
    subdocumentName?: string;
  }>;
  filterImageHelpers: FilterImageHelper[];
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

  const buildFilter = (
    filter: FilterInstance | undefined,
    targetTransforms: RenderNode["transform"][],
  ): GeneratedFilter | undefined => {
    if (!filter || filter.invalid) return undefined;
    const transform = targetTransforms.reduce(multiplyTransforms);
    const transformRegion = (region: FilterInstance["region"]): FilterInstance["region"] => {
      const points = [
        [region.x, region.y],
        [region.x + region.width, region.y],
        [region.x, region.y + region.height],
        [region.x + region.width, region.y + region.height],
      ].map(([x, y]) => ({
        x: transform.a * x! + transform.c * y! + transform.e,
        y: transform.b * x! + transform.d * y! + transform.f,
      }));
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    };
    const transformPrimitive = (primitive: FilterPrimitive): FilterPrimitive => {
      const subregion = transformRegion(primitive.subregion);
      if (primitive.type === "offset")
        return {
          ...primitive,
          subregion,
          dx: transform.a * primitive.dx + transform.c * primitive.dy,
          dy: transform.b * primitive.dx + transform.d * primitive.dy,
        };
      if (primitive.type === "gaussianBlur" || primitive.type === "dropShadow") {
        const stdDeviationX = Math.hypot(transform.a * primitive.stdDeviationX, transform.c * primitive.stdDeviationY);
        const stdDeviationY = Math.hypot(transform.b * primitive.stdDeviationX, transform.d * primitive.stdDeviationY);
        return primitive.type === "gaussianBlur"
          ? { ...primitive, subregion, stdDeviationX, stdDeviationY }
          : {
              ...primitive,
              subregion,
              stdDeviationX,
              stdDeviationY,
              dx: transform.a * primitive.dx + transform.c * primitive.dy,
              dy: transform.b * primitive.dx + transform.d * primitive.dy,
            };
      }
      if (primitive.type === "morphology")
        return {
          ...primitive,
          subregion,
          radiusX: Math.hypot(transform.a * primitive.radiusX, transform.b * primitive.radiusX),
          radiusY: Math.hypot(transform.c * primitive.radiusY, transform.d * primitive.radiusY),
        };
      if (primitive.type === "convolveMatrix" && primitive.kernelUnitLengthX !== undefined)
        return {
          ...primitive,
          subregion,
          kernelUnitLengthX: Math.hypot(
            transform.a * primitive.kernelUnitLengthX,
            transform.b * primitive.kernelUnitLengthX,
          ),
          kernelUnitLengthY: Math.hypot(
            transform.c * primitive.kernelUnitLengthY!,
            transform.d * primitive.kernelUnitLengthY!,
          ),
        };
      if (primitive.type === "displacementMap")
        return {
          ...primitive,
          subregion,
          displacement: {
            a: transform.a * primitive.displacement.a + transform.c * primitive.displacement.b,
            b: transform.b * primitive.displacement.a + transform.d * primitive.displacement.b,
            c: transform.a * primitive.displacement.c + transform.c * primitive.displacement.d,
            d: transform.b * primitive.displacement.c + transform.d * primitive.displacement.d,
          },
        };
      if (primitive.type === "tile")
        return { ...primitive, subregion, tileRegion: transformRegion(primitive.tileRegion) };
      if (primitive.type === "image" && primitive.image.contentTransform)
        return {
          ...primitive,
          subregion,
          image: {
            ...primitive.image,
            contentTransform: multiplyTransforms(transform, primitive.image.contentTransform),
          },
        };
      return { ...primitive, subregion };
    };
    const instance: FilterInstance = {
      ...filter,
      region: transformRegion(filter.region),
      primitives: filter.primitives.map(transformPrimitive),
    };
    const imageHelpers: Array<{ key: string; name: string }> = [];
    for (const [index, primitive] of instance.primitives.entries()) {
      if (primitive.type !== "image" || !primitive.image.resource) continue;
      const key = `filter-image-${index}`;
      const name = `FilterImageLayer${context.filterImageHelpers.length}`;
      let subdocumentName: string | undefined;
      if (primitive.image.resource.type === "svg") {
        subdocumentName = `${context.rootName}FilterImageDocument${context.subdocuments.length}`;
        const child = primitive.image.resource.document;
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
      context.filterImageHelpers.push({
        key,
        name,
        primitive,
        canvas: context.coordinateSpace,
        ...(subdocumentName ? { subdocumentName } : {}),
      });
      imageHelpers.push({ key, name });
    }
    const configuredMaxPixels = context.config.filters?.maxOutputPixels ?? 16_000_000;
    return {
      instance,
      canvas: context.coordinateSpace,
      imageHelpers,
      maxOutputPixels:
        Number.isFinite(configuredMaxPixels) && configuredMaxPixels > 0
          ? Math.max(1, Math.trunc(configuredMaxPixels))
          : 16_000_000,
    };
  };

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
        const filter = buildFilter(node.filter, targetTransforms);
        generated.push({
          type: "group",
          children,
          opacity: node.style.opacity,
          isolated:
            node.style.opacity !== 1 ||
            node.style.isolation === "isolate" ||
            node.style.blendMode !== "normal" ||
            !!clipPath ||
            !!mask ||
            !!filter,
          blendMode: node.style.blendMode,
          ...(viewportClip ? { viewportClip } : {}),
          ...(clipPath ? { clipPath } : {}),
          ...(mask ? { mask } : {}),
          ...(filter ? { filter } : {}),
          ...(node.accessibility ? { accessibility: node.accessibility } : {}),
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
      const filter = buildFilter(node.filter, targetTransforms);
      generated.push({
        type: "group",
        children: [{ type: "text", helper: name }],
        opacity: node.style.opacity,
        isolated:
          node.style.opacity !== 1 ||
          node.style.isolation === "isolate" ||
          node.style.blendMode !== "normal" ||
          !!clipPath ||
          !!mask ||
          !!filter,
        blendMode: node.style.blendMode,
        ...(clipPath ? { clipPath } : {}),
        ...(mask ? { mask } : {}),
        ...(filter ? { filter } : {}),
        ...(node.accessibility ? { accessibility: node.accessibility } : {}),
      });
      continue;
    }
    if (node.type === "image" || node.type === "foreignObject") {
      if (
        node.style.visibility === "hidden" ||
        node.style.visibility === "collapse" ||
        node.viewport.width <= 0 ||
        node.viewport.height <= 0 ||
        !node.resource
      )
        continue;
      const completeTransform = [...ancestorTransforms, node.transform].reduce(multiplyTransforms);
      const name = `${node.type === "foreignObject" ? "ForeignObject" : "Image"}Layer${context.imageHelpers.length}`;
      let subdocumentName: string | undefined;
      if (node.type === "image" && node.resource.type === "svg") {
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
      const filter = buildFilter(node.filter, targetTransforms);
      generated.push({
        type: "group",
        children: [{ type: "image", helper: name }],
        opacity: node.style.opacity,
        isolated:
          node.style.opacity !== 1 ||
          node.style.isolation === "isolate" ||
          node.style.blendMode !== "normal" ||
          !!clipPath ||
          !!mask ||
          !!filter,
        blendMode: node.style.blendMode,
        ...(clipPath ? { clipPath } : {}),
        ...(mask ? { mask } : {}),
        ...(filter ? { filter } : {}),
        ...(node.accessibility ? { accessibility: node.accessibility } : {}),
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
      const filter = buildFilter(node.filter, targetTransforms);
      generated.push({
        type: "group",
        children: paints,
        opacity: node.style.opacity,
        isolated:
          node.style.opacity !== 1 ||
          node.style.isolation === "isolate" ||
          node.style.blendMode !== "normal" ||
          !!clipPath ||
          !!mask ||
          !!filter,
        blendMode: node.style.blendMode,
        ...(clipPath ? { clipPath } : {}),
        ...(mask ? { mask } : {}),
        ...(filter ? { filter } : {}),
        ...(node.accessibility ? { accessibility: node.accessibility } : {}),
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

function filterInputLiteral(input: FilterInput): string {
  return input.type === "result" ? `.result(${input.index})` : `.${input.type}`;
}

function filterColorLiteral(color: RGBAColor): string {
  return `SVGFilterColor(red: ${formatNumber(color.red)}, green: ${formatNumber(color.green)}, blue: ${formatNumber(color.blue)}, alpha: ${formatNumber(color.alpha)})`;
}

function filterRegionLiteral(region: FilterInstance["region"]): string {
  return `SVGFilterRegion(x: ${formatNumber(region.x)}, y: ${formatNumber(region.y)}, width: ${formatNumber(region.width)}, height: ${formatNumber(region.height)})`;
}

function filterBlendModeLiteral(mode: Extract<FilterPrimitive, { type: "blend" }>["mode"]): string {
  return `.${mode.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`;
}

function filterComponentFunctionLiteral(
  fn: Extract<FilterPrimitive, { type: "componentTransfer" }>["functions"][number],
): string {
  switch (fn.type) {
    case "identity":
      return ".identity";
    case "table":
    case "discrete":
      return `.${fn.type}([${fn.values.map((value) => formatNumber(value)).join(", ")}])`;
    case "linear":
      return `.linear(slope: ${formatNumber(fn.slope)}, intercept: ${formatNumber(fn.intercept)})`;
    case "gamma":
      return `.gamma(amplitude: ${formatNumber(fn.amplitude)}, exponent: ${formatNumber(fn.exponent)}, offset: ${formatNumber(fn.offset)})`;
  }
}

function filterCompositeOperatorLiteral(operator: Extract<FilterPrimitive, { type: "composite" }>["operator"]): string {
  return `.${operator === "in" ? "inside" : operator === "out" ? "outside" : operator}`;
}

function filterPrimitiveLiteral(primitive: FilterPrimitive, index: number): string {
  const region = filterRegionLiteral(primitive.subregion);
  const linear = primitive.colorInterpolation === "linearRGB" ? "true" : "false";
  const result = primitive.result ? swiftString(primitive.result) : "nil";
  switch (primitive.type) {
    case "blend":
      return `.blend(input: ${filterInputLiteral(primitive.input)}, input2: ${filterInputLiteral(primitive.input2)}, mode: ${filterBlendModeLiteral(primitive.mode)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "colorMatrix":
      return `.colorMatrix(input: ${filterInputLiteral(primitive.input)}, matrix: [${primitive.matrix.map((value) => formatNumber(value)).join(", ")}], region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "componentTransfer":
      return `.componentTransfer(input: ${filterInputLiteral(primitive.input)}, functions: [${primitive.functions.map(filterComponentFunctionLiteral).join(", ")}], region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "composite":
      return `.composite(input: ${filterInputLiteral(primitive.input)}, input2: ${filterInputLiteral(primitive.input2)}, operation: ${filterCompositeOperatorLiteral(primitive.operator)}, k1: ${formatNumber(primitive.k1)}, k2: ${formatNumber(primitive.k2)}, k3: ${formatNumber(primitive.k3)}, k4: ${formatNumber(primitive.k4)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "convolveMatrix":
      return `.convolveMatrix(input: ${filterInputLiteral(primitive.input)}, orderX: ${primitive.orderX}, orderY: ${primitive.orderY}, kernel: [${primitive.kernelMatrix.map((value) => formatNumber(value)).join(", ")}], divisor: ${formatNumber(primitive.divisor)}, bias: ${formatNumber(primitive.bias)}, targetX: ${primitive.targetX}, targetY: ${primitive.targetY}, edge: .${primitive.edgeMode}, unitX: ${primitive.kernelUnitLengthX === undefined ? "nil" : formatNumber(primitive.kernelUnitLengthX)}, unitY: ${primitive.kernelUnitLengthY === undefined ? "nil" : formatNumber(primitive.kernelUnitLengthY)}, preserveAlpha: ${primitive.preserveAlpha}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "morphology":
      return `.morphology(input: ${filterInputLiteral(primitive.input)}, operation: .${primitive.operator}, radiusX: ${formatNumber(primitive.radiusX)}, radiusY: ${formatNumber(primitive.radiusY)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "displacementMap":
      return `.displacementMap(input: ${filterInputLiteral(primitive.input)}, input2: ${filterInputLiteral(primitive.input2)}, a: ${formatNumber(primitive.displacement.a)}, b: ${formatNumber(primitive.displacement.b)}, c: ${formatNumber(primitive.displacement.c)}, d: ${formatNumber(primitive.displacement.d)}, xChannel: .${primitive.xChannel.toLowerCase()}, yChannel: .${primitive.yChannel.toLowerCase()}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "tile":
      return `.tile(input: ${filterInputLiteral(primitive.input)}, tileRegion: ${filterRegionLiteral(primitive.tileRegion)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "turbulence":
      return `.turbulence(baseFrequencyX: ${formatNumber(primitive.baseFrequencyX)}, baseFrequencyY: ${formatNumber(primitive.baseFrequencyY)}, octaves: ${primitive.numOctaves}, seed: ${primitive.seed}, stitch: ${primitive.stitchTiles}, fractalNoise: ${primitive.noiseType === "fractalNoise"}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "image":
      return `.image(key: ${swiftString(`filter-image-${index}`)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "gaussianBlur":
      return `.gaussianBlur(input: ${filterInputLiteral(primitive.input)}, sigmaX: ${formatNumber(primitive.stdDeviationX)}, sigmaY: ${formatNumber(primitive.stdDeviationY)}, edge: .${primitive.edgeMode}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "offset":
      return `.offset(input: ${filterInputLiteral(primitive.input)}, dx: ${formatNumber(primitive.dx)}, dy: ${formatNumber(primitive.dy)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "flood":
      return `.flood(color: ${filterColorLiteral(primitive.color)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "merge":
      return `.merge(inputs: [${primitive.inputs.map(filterInputLiteral).join(", ")}], region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "dropShadow":
      return `.dropShadow(input: ${filterInputLiteral(primitive.input)}, sigmaX: ${formatNumber(primitive.stdDeviationX)}, sigmaY: ${formatNumber(primitive.stdDeviationY)}, dx: ${formatNumber(primitive.dx)}, dy: ${formatNumber(primitive.dy)}, color: ${filterColorLiteral(primitive.color)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "passthrough":
      return `.passthrough(input: ${filterInputLiteral(primitive.input)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
  }
}

function filterDefinitionLiteral(filter: GeneratedFilter): string {
  const instance = filter.instance;
  return `SVGFilterDefinition(region: ${filterRegionLiteral(instance.region)}, primitives: [${instance.primitives.map((primitive, index) => filterPrimitiveLiteral(primitive, index)).join(", ")}], fillPaint: ${filterColorLiteral(instance.fillPaint)}, strokePaint: ${filterColorLiteral(instance.strokePaint)}, maxOutputPixels: ${filter.maxOutputPixels})`;
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

function accessibilityTrait(role: string | undefined): string | undefined {
  if (!role) return undefined;
  if (["img", "graphics-document", "graphics-object", "graphics-symbol"].includes(role)) return "isImage";
  if (role === "button") return "isButton";
  if (role === "link") return "isLink";
  if (role === "heading") return "isHeader";
  if (role === "text") return "isStaticText";
  return undefined;
}

function appendAccessibilityModifiers(
  lines: string[],
  accessibility: AccessibilityMetadata | undefined,
  prefix: string,
): void {
  if (!accessibility) return;
  if (accessibility.hidden) {
    lines.push(`${prefix}.accessibilityHidden(true)`);
    return;
  }
  const presentation = accessibility.role === "none" || accessibility.role === "presentation";
  const semanticContainer = accessibility.role === "graphics-document" || accessibility.role === "graphics-object";
  if ((accessibility.label || accessibility.description) && !semanticContainer)
    lines.push(`${prefix}.accessibilityElement(children: .ignore)`);
  else if (accessibility.role && !presentation) lines.push(`${prefix}.accessibilityElement(children: .contain)`);
  if (accessibility.label) lines.push(`${prefix}.accessibilityLabel(${swiftString(accessibility.label)})`);
  if (accessibility.description) lines.push(`${prefix}.accessibilityHint(${swiftString(accessibility.description)})`);
  const trait = presentation ? undefined : accessibilityTrait(accessibility.role);
  if (trait) lines.push(`${prefix}.accessibilityAddTraits(.${trait})`);
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
  const lines = node.filter
    ? [
        `${prefix}SVGFilteredCanvas(definition: ${filterDefinitionLiteral(node.filter)}, canvas: CGSize(width: ${formatNumber(node.filter.canvas.width)}, height: ${formatNumber(node.filter.canvas.height)}), drawSource: { graphics, size in`,
        ...renderGeneratedCommands(node.children, "graphics", level + 1, indentation),
        `${prefix}}, renderFilterImages: { size, scale in`,
        `${prefix}${indentation}var images: [String: CGImage] = [:]`,
        ...node.filter.imageHelpers.flatMap(({ key, name }) => [
          `${prefix}${indentation}let ${name}Renderer = ImageRenderer(content: ${name}().frame(width: size.width, height: size.height))`,
          `${prefix}${indentation}${name}Renderer.scale = scale`,
          `${prefix}${indentation}if let image = ${name}Renderer.cgImage { images[${swiftString(key)}] = image }`,
        ]),
        `${prefix}${indentation}return images`,
        `${prefix}})`,
      ]
    : [`${prefix}ZStack {`];
  if (!node.filter) {
    for (const child of node.children) lines.push(...renderViewNode(child, level + 1, indentation));
    lines.push(`${prefix}}`);
  }
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
  appendAccessibilityModifiers(lines, node.accessibility, prefix);
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

function containsFilterNode(nodes: GeneratedViewNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.type === "group" &&
        (node.filter !== undefined ||
          containsFilterNode(node.children) ||
          (node.clipPath ? containsFilterNode(node.clipPath.children) : false) ||
          (node.mask ? containsFilterNode(node.mask.children) : false))) ||
      (node.type === "pattern" && containsFilterNode(node.contentNodes)),
  );
}

function filterSupport(indentationSize: number): string[] {
  const source = `private struct SVGFilterColor {
    let red: CGFloat
    let green: CGFloat
    let blue: CGFloat
    let alpha: CGFloat

}

private struct SVGFilterRegion {
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat

}

private enum SVGFilterInput {
    case sourceGraphic
    case sourceAlpha
    case backgroundImage
    case backgroundAlpha
    case fillPaint
    case strokePaint
    case result(Int)
}

private enum SVGFilterEdgeMode {
    case none
    case duplicate
    case wrap
}

private enum SVGFilterBlendMode {
    case normal, multiply, screen, overlay, darken, lighten
    case colorDodge, colorBurn, hardLight, softLight, difference, exclusion
    case hue, saturation, color, luminosity
}

private enum SVGFilterCompositeOperator: Equatable {
    case over, inside, outside, atop, xor, lighter, arithmetic
}

private enum SVGFilterMorphologyOperator {
    case erode, dilate
}

private enum SVGFilterChannel {
    case r, g, b, a

    var index: Int {
        switch self { case .r: 0; case .g: 1; case .b: 2; case .a: 3 }
    }
}

private enum SVGFilterComponentFunction {
    case identity
    case table([Float])
    case discrete([Float])
    case linear(slope: Float, intercept: Float)
    case gamma(amplitude: Float, exponent: Float, offset: Float)
}

private enum SVGFilterPrimitive {
    case blend(input: SVGFilterInput, input2: SVGFilterInput, mode: SVGFilterBlendMode, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case colorMatrix(input: SVGFilterInput, matrix: [Float], region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case componentTransfer(input: SVGFilterInput, functions: [SVGFilterComponentFunction], region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case composite(input: SVGFilterInput, input2: SVGFilterInput, operation: SVGFilterCompositeOperator, k1: Float, k2: Float, k3: Float, k4: Float, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case convolveMatrix(input: SVGFilterInput, orderX: Int, orderY: Int, kernel: [Float], divisor: Float, bias: Float, targetX: Int, targetY: Int, edge: SVGFilterEdgeMode, unitX: CGFloat?, unitY: CGFloat?, preserveAlpha: Bool, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case morphology(input: SVGFilterInput, operation: SVGFilterMorphologyOperator, radiusX: CGFloat, radiusY: CGFloat, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case displacementMap(input: SVGFilterInput, input2: SVGFilterInput, a: CGFloat, b: CGFloat, c: CGFloat, d: CGFloat, xChannel: SVGFilterChannel, yChannel: SVGFilterChannel, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case tile(input: SVGFilterInput, tileRegion: SVGFilterRegion, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case turbulence(baseFrequencyX: CGFloat, baseFrequencyY: CGFloat, octaves: Int, seed: Int, stitch: Bool, fractalNoise: Bool, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case image(key: String, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case gaussianBlur(input: SVGFilterInput, sigmaX: CGFloat, sigmaY: CGFloat, edge: SVGFilterEdgeMode, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case offset(input: SVGFilterInput, dx: CGFloat, dy: CGFloat, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case flood(color: SVGFilterColor, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case merge(inputs: [SVGFilterInput], region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case dropShadow(input: SVGFilterInput, sigmaX: CGFloat, sigmaY: CGFloat, dx: CGFloat, dy: CGFloat, color: SVGFilterColor, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case passthrough(input: SVGFilterInput, region: SVGFilterRegion, linearRGB: Bool, result: String?)

    var region: SVGFilterRegion {
        switch self {
        case let .blend(_, _, _, region, _, _),
             let .colorMatrix(_, _, region, _, _),
             let .componentTransfer(_, _, region, _, _),
             let .composite(_, _, _, _, _, _, _, region, _, _),
             let .convolveMatrix(_, _, _, _, _, _, _, _, _, _, _, _, region, _, _),
             let .morphology(_, _, _, _, region, _, _),
             let .displacementMap(_, _, _, _, _, _, _, _, region, _, _),
             let .tile(_, _, region, _, _),
             let .turbulence(_, _, _, _, _, _, region, _, _),
             let .image(_, region, _, _),
             let .gaussianBlur(_, _, _, _, region, _, _),
             let .offset(_, _, _, region, _, _),
             let .flood(_, region, _, _),
             let .merge(_, region, _, _),
             let .dropShadow(_, _, _, _, _, _, region, _, _),
             let .passthrough(_, region, _, _):
            return region
        }
    }

    var linearRGB: Bool {
        switch self {
        case let .blend(_, _, _, _, value, _),
             let .colorMatrix(_, _, _, value, _),
             let .componentTransfer(_, _, _, value, _),
             let .composite(_, _, _, _, _, _, _, _, value, _),
             let .convolveMatrix(_, _, _, _, _, _, _, _, _, _, _, _, _, value, _),
             let .morphology(_, _, _, _, _, value, _),
             let .displacementMap(_, _, _, _, _, _, _, _, _, value, _),
             let .tile(_, _, _, value, _),
             let .turbulence(_, _, _, _, _, _, _, value, _),
             let .image(_, _, value, _),
             let .gaussianBlur(_, _, _, _, _, value, _),
             let .offset(_, _, _, _, value, _),
             let .flood(_, _, value, _),
             let .merge(_, _, value, _),
             let .dropShadow(_, _, _, _, _, _, _, value, _),
             let .passthrough(_, _, value, _):
            return value
        }
    }
}

private struct SVGFilterDefinition {
    let region: SVGFilterRegion
    let primitives: [SVGFilterPrimitive]
    let fillPaint: SVGFilterColor
    let strokePaint: SVGFilterColor
    let maxOutputPixels: Int
}

private struct SVGFilteredCanvas: View {
    let definition: SVGFilterDefinition
    let canvas: CGSize
    let drawSource: (CGContext, CGSize) -> Void
    let renderFilterImages: @MainActor (CGSize, CGFloat) -> [String: CGImage]
    @Environment(\\.displayScale) private var displayScale

    var body: some View {
        Canvas { context, size in
            if let image = render(size: size) {
                context.draw(Image(decorative: image, scale: displayScale), in: CGRect(origin: .zero, size: size))
            }
        }
    }

    @MainActor
    private func render(size: CGSize) -> CGImage? {
        guard size.width > 0, size.height > 0, canvas.width > 0, canvas.height > 0 else { return nil }
        let pixelWidth = max(1, Int((size.width * displayScale).rounded()))
        let pixelHeight = max(1, Int((size.height * displayScale).rounded()))
        guard pixelWidth <= definition.maxOutputPixels / pixelHeight else { return nil }
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
        guard let graphics = CGContext(
            data: nil,
            width: pixelWidth,
            height: pixelHeight,
            bitsPerComponent: 8,
            bytesPerRow: pixelWidth * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        graphics.translateBy(x: 0, y: CGFloat(pixelHeight))
        graphics.scaleBy(x: displayScale, y: -displayScale)
        drawSource(graphics, size)
        guard let sourceImage = graphics.makeImage() else { return nil }
        return SVGFilterBitmapRuntime.render(
            definition,
            sourceImage: sourceImage,
            canvas: canvas,
            filterImages: renderFilterImages(size, displayScale)
        )
    }
}

private struct SVGFilterBitmap {
    let width: Int
    let height: Int
    var values: [Float]

    init(width: Int, height: Int, values: [Float]? = nil) {
        self.width = width
        self.height = height
        self.values = values ?? Array(repeating: 0, count: width * height * 4)
    }

    func component(_ x: Int, _ y: Int, _ channel: Int) -> Float {
        guard x >= 0, y >= 0, x < width, y < height else { return 0 }
        return values[(y * width + x) * 4 + channel]
    }
}

private struct SVGFilterPixelRect {
    let minX: Int
    let minY: Int
    let maxX: Int
    let maxY: Int

    func contains(_ x: Int, _ y: Int) -> Bool {
        x >= minX && x < maxX && y >= minY && y < maxY
    }
}

private struct SVGFilterPixelRegion {
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat
}

private struct SVGFilterStitchInfo {
    var width: Int
    var height: Int
    var wrapX: Int
    var wrapY: Int
}

private enum SVGFilterBitmapRuntime {
    static func render(_ definition: SVGFilterDefinition, sourceImage: CGImage, canvas: CGSize, filterImages: [String: CGImage]) -> CGImage? {
        let width = sourceImage.width
        let height = sourceImage.height
        guard width > 0, height > 0, width <= definition.maxOutputPixels / height,
              let source = bitmap(sourceImage) else { return nil }
        let scaleX = CGFloat(width) / canvas.width
        let scaleY = CGFloat(height) / canvas.height
        let images = filterImages.compactMapValues(bitmap)
        let output = apply(definition, source: source, scaleX: scaleX, scaleY: scaleY, filterImages: images)
        let outputBytes = output.values.map { UInt8((min(1, max(0, $0)) * 255).rounded()) }
        let outputData = Data(outputBytes)
        guard let provider = CGDataProvider(data: outputData as CFData) else { return nil }
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
        return CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider,
            decode: nil,
            shouldInterpolate: true,
            intent: .defaultIntent
        )
    }

    private static func bitmap(_ image: CGImage) -> SVGFilterBitmap? {
        let width = image.width
        let height = image.height
        guard width > 0, height > 0 else { return nil }
        var bytes = Array<UInt8>(repeating: 0, count: width * height * 4)
        guard let context = CGContext(
            data: &bytes,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return SVGFilterBitmap(width: width, height: height, values: bytes.map { Float($0) / 255 })
    }

    private static func pixelRect(_ region: SVGFilterRegion, scaleX: CGFloat, scaleY: CGFloat, width: Int, height: Int) -> SVGFilterPixelRect {
        SVGFilterPixelRect(
            minX: max(0, Int(floor(region.x * scaleX))),
            minY: max(0, Int(floor(region.y * scaleY))),
            maxX: min(Int(ceil((region.x + region.width) * scaleX)), width),
            maxY: min(Int(ceil((region.y + region.height) * scaleY)), height)
        )
    }

    private static func cropped(_ image: SVGFilterBitmap, to rect: SVGFilterPixelRect) -> SVGFilterBitmap {
        var result = image
        for y in 0..<image.height {
            for x in 0..<image.width where !rect.contains(x, y) {
                let index = (y * image.width + x) * 4
                result.values[index] = 0
                result.values[index + 1] = 0
                result.values[index + 2] = 0
                result.values[index + 3] = 0
            }
        }
        return result
    }

    private static func constant(_ color: SVGFilterColor, width: Int, height: Int) -> SVGFilterBitmap {
        let alpha = Float(color.alpha)
        let pixel: [Float] = [Float(color.red) * alpha, Float(color.green) * alpha, Float(color.blue) * alpha, alpha]
        return SVGFilterBitmap(width: width, height: height, values: Array(repeating: pixel, count: width * height).flatMap { $0 })
    }

    private static func alpha(_ image: SVGFilterBitmap) -> SVGFilterBitmap {
        var result = image
        for index in stride(from: 0, to: result.values.count, by: 4) {
            result.values[index] = 0
            result.values[index + 1] = 0
            result.values[index + 2] = 0
        }
        return result
    }

    private static func converted(_ image: SVGFilterBitmap, linear: Bool, encode: Bool) -> SVGFilterBitmap {
        guard linear else { return image }
        var result = image
        for index in stride(from: 0, to: result.values.count, by: 4) {
            let alpha = result.values[index + 3]
            guard alpha > 0 else { continue }
            for channel in 0..<3 {
                let value = min(1, max(0, result.values[index + channel] / alpha))
                let converted: Float
                if encode {
                    converted = value <= 0.0031308 ? value * 12.92 : 1.055 * pow(value, 1 / 2.4) - 0.055
                } else {
                    converted = value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
                }
                result.values[index + channel] = converted * alpha
            }
        }
        return result
    }

    private static func clamped(_ value: Float) -> Float {
        if value.isNaN || value == -.infinity { return 0 }
        if value == .infinity { return 1 }
        return min(1, max(0, value))
    }

    private static func unpremultiplied(_ image: SVGFilterBitmap, _ index: Int) -> (Float, Float, Float, Float) {
        let alpha = clamped(image.values[index + 3])
        guard alpha > 0 else { return (0, 0, 0, 0) }
        return (
            clamped(image.values[index] / alpha),
            clamped(image.values[index + 1] / alpha),
            clamped(image.values[index + 2] / alpha),
            alpha
        )
    }

    private static func separableBlend(_ mode: SVGFilterBlendMode, backdrop: Float, source: Float) -> Float {
        switch mode {
        case .normal: return source
        case .multiply: return backdrop * source
        case .screen: return backdrop + source - backdrop * source
        case .overlay: return backdrop <= 0.5 ? 2 * backdrop * source : 1 - 2 * (1 - backdrop) * (1 - source)
        case .darken: return min(backdrop, source)
        case .lighten: return max(backdrop, source)
        case .colorDodge: return backdrop == 0 ? 0 : source == 1 ? 1 : min(1, backdrop / (1 - source))
        case .colorBurn: return backdrop == 1 ? 1 : source == 0 ? 0 : 1 - min(1, (1 - backdrop) / source)
        case .hardLight: return source <= 0.5 ? 2 * source * backdrop : 1 - 2 * (1 - source) * (1 - backdrop)
        case .softLight:
            if source <= 0.5 { return backdrop - (1 - 2 * source) * backdrop * (1 - backdrop) }
            let d = backdrop <= 0.25 ? ((16 * backdrop - 12) * backdrop + 4) * backdrop : sqrt(backdrop)
            return backdrop + (2 * source - 1) * (d - backdrop)
        case .difference: return abs(backdrop - source)
        case .exclusion: return backdrop + source - 2 * backdrop * source
        case .hue, .saturation, .color, .luminosity: return source
        }
    }

    private static func luminosity(_ color: [Float]) -> Float {
        0.3 * color[0] + 0.59 * color[1] + 0.11 * color[2]
    }

    private static func saturation(_ color: [Float]) -> Float {
        (color.max() ?? 0) - (color.min() ?? 0)
    }

    private static func clipColor(_ color: [Float]) -> [Float] {
        var result = color
        let lum = luminosity(result)
        let minimum = result.min() ?? 0
        let maximum = result.max() ?? 0
        if minimum < 0 {
            for channel in 0..<3 { result[channel] = lum + (result[channel] - lum) * lum / (lum - minimum) }
        }
        if maximum > 1 {
            for channel in 0..<3 { result[channel] = lum + (result[channel] - lum) * (1 - lum) / (maximum - lum) }
        }
        return result
    }

    private static func setLuminosity(_ color: [Float], _ value: Float) -> [Float] {
        let delta = value - luminosity(color)
        return clipColor(color.map { $0 + delta })
    }

    private static func setSaturation(_ color: [Float], _ value: Float) -> [Float] {
        var result: [Float] = [0, 0, 0]
        let order = [0, 1, 2].sorted { color[$0] < color[$1] }
        let minimum = order[0]
        let middle = order[1]
        let maximum = order[2]
        if color[maximum] > color[minimum] {
            result[middle] = (color[middle] - color[minimum]) * value / (color[maximum] - color[minimum])
            result[maximum] = value
        }
        return result
    }

    private static func blendedColor(_ mode: SVGFilterBlendMode, backdrop: [Float], source: [Float]) -> [Float] {
        switch mode {
        case .hue: return setLuminosity(setSaturation(source, saturation(backdrop)), luminosity(backdrop))
        case .saturation: return setLuminosity(setSaturation(backdrop, saturation(source)), luminosity(backdrop))
        case .color: return setLuminosity(source, luminosity(backdrop))
        case .luminosity: return setLuminosity(backdrop, luminosity(source))
        default: return (0..<3).map { separableBlend(mode, backdrop: backdrop[$0], source: source[$0]) }
        }
    }

    private static func blend(_ source: SVGFilterBitmap, _ backdrop: SVGFilterBitmap, mode: SVGFilterBlendMode) -> SVGFilterBitmap {
        var result = source
        for index in stride(from: 0, to: result.values.count, by: 4) {
            let cs = unpremultiplied(source, index)
            let cb = unpremultiplied(backdrop, index)
            let mixed = blendedColor(mode, backdrop: [cb.0, cb.1, cb.2], source: [cs.0, cs.1, cs.2])
            let alpha = clamped(cs.3 + cb.3 * (1 - cs.3))
            for channel in 0..<3 {
                let sourceValue = min(cs.3, clamped(source.values[index + channel]))
                let backdropValue = min(cb.3, clamped(backdrop.values[index + channel]))
                let value = (1 - cs.3) * backdropValue
                    + (1 - cb.3) * sourceValue
                    + cs.3 * cb.3 * mixed[channel]
                result.values[index + channel] = min(alpha, clamped(value))
            }
            result.values[index + 3] = alpha
        }
        return result
    }

    private static func colorMatrix(_ image: SVGFilterBitmap, matrix: [Float]) -> SVGFilterBitmap {
        guard matrix.count == 20 else { return image }
        var result = image
        for index in stride(from: 0, to: result.values.count, by: 4) {
            let input = unpremultiplied(image, index)
            let channels = [input.0, input.1, input.2, input.3]
            var output: [Float] = [0, 0, 0, 0]
            for row in 0..<4 {
                let offset = row * 5
                output[row] = clamped(
                    matrix[offset] * channels[0] + matrix[offset + 1] * channels[1]
                        + matrix[offset + 2] * channels[2] + matrix[offset + 3] * channels[3]
                        + matrix[offset + 4]
                )
            }
            let alpha = output[3]
            result.values[index] = output[0] * alpha
            result.values[index + 1] = output[1] * alpha
            result.values[index + 2] = output[2] * alpha
            result.values[index + 3] = alpha
        }
        return result
    }

    private static func transfer(_ input: Float, function: SVGFilterComponentFunction) -> Float {
        let value = clamped(input)
        switch function {
        case .identity: return value
        case let .table(values):
            guard !values.isEmpty else { return value }
            guard values.count > 1 else { return clamped(values[0]) }
            if value == 1 { return clamped(values[values.count - 1]) }
            let scaled = value * Float(values.count - 1)
            let index = Int(floor(scaled))
            return clamped(values[index] + (scaled - Float(index)) * (values[index + 1] - values[index]))
        case let .discrete(values):
            guard !values.isEmpty else { return value }
            let index = min(values.count - 1, Int(floor(value * Float(values.count))))
            return clamped(values[index])
        case let .linear(slope, intercept): return clamped(slope * value + intercept)
        case let .gamma(amplitude, exponent, offset): return clamped(amplitude * pow(value, exponent) + offset)
        }
    }

    private static func componentTransfer(_ image: SVGFilterBitmap, functions: [SVGFilterComponentFunction]) -> SVGFilterBitmap {
        guard functions.count == 4 else { return image }
        var result = image
        for index in stride(from: 0, to: result.values.count, by: 4) {
            let input = unpremultiplied(image, index)
            let alpha = transfer(input.3, function: functions[3])
            result.values[index] = transfer(input.0, function: functions[0]) * alpha
            result.values[index + 1] = transfer(input.1, function: functions[1]) * alpha
            result.values[index + 2] = transfer(input.2, function: functions[2]) * alpha
            result.values[index + 3] = alpha
        }
        return result
    }

    private static func composite(_ source: SVGFilterBitmap, _ destination: SVGFilterBitmap, operation: SVGFilterCompositeOperator, k1: Float, k2: Float, k3: Float, k4: Float) -> SVGFilterBitmap {
        var result = source
        for index in stride(from: 0, to: result.values.count, by: 4) {
            let sourceAlpha = clamped(source.values[index + 3])
            let destinationAlpha = clamped(destination.values[index + 3])
            func sourceValue(_ channel: Int) -> Float {
                channel == 3 ? sourceAlpha : min(sourceAlpha, clamped(source.values[index + channel]))
            }
            func destinationValue(_ channel: Int) -> Float {
                channel == 3 ? destinationAlpha : min(destinationAlpha, clamped(destination.values[index + channel]))
            }
            if operation == .arithmetic {
                for channel in 0..<4 {
                    result.values[index + channel] = clamped(
                        k1 * sourceValue(channel) * destinationValue(channel)
                            + k2 * sourceValue(channel) + k3 * destinationValue(channel) + k4
                    )
                }
            } else {
                let factors: (Float, Float)
                switch operation {
                case .over: factors = (1, 1 - sourceAlpha)
                case .inside: factors = (destinationAlpha, 0)
                case .outside: factors = (1 - destinationAlpha, 0)
                case .atop: factors = (destinationAlpha, 1 - sourceAlpha)
                case .xor: factors = (1 - destinationAlpha, 1 - sourceAlpha)
                case .lighter: factors = (1, 1)
                case .arithmetic: factors = (0, 0)
                }
                for channel in 0..<4 {
                    result.values[index + channel] = clamped(
                        sourceValue(channel) * factors.0 + destinationValue(channel) * factors.1
                    )
                }
            }
            let alpha = result.values[index + 3]
            result.values[index] = min(alpha, result.values[index])
            result.values[index + 1] = min(alpha, result.values[index + 1])
            result.values[index + 2] = min(alpha, result.values[index + 2])
        }
        return result
    }

    private static func sampleBilinear(_ image: SVGFilterBitmap, x: CGFloat, y: CGFloat, edge: SVGFilterEdgeMode, bounds: SVGFilterPixelRect) -> [Float] {
        let minX = Int(floor(x))
        let minY = Int(floor(y))
        let fractionX = Float(x - CGFloat(minX))
        let fractionY = Float(y - CGFloat(minY))
        return (0..<4).map { channel in
            let top = sample(image, x: minX, y: minY, channel: channel, edge: edge, bounds: bounds) * (1 - fractionX)
                + sample(image, x: minX + 1, y: minY, channel: channel, edge: edge, bounds: bounds) * fractionX
            let bottom = sample(image, x: minX, y: minY + 1, channel: channel, edge: edge, bounds: bounds) * (1 - fractionX)
                + sample(image, x: minX + 1, y: minY + 1, channel: channel, edge: edge, bounds: bounds) * fractionX
            return clamped(top * (1 - fractionY) + bottom * fractionY)
        }
    }

    private static func write(_ pixel: [Float], to image: inout SVGFilterBitmap, x: Int, y: Int) {
        let index = (y * image.width + x) * 4
        for channel in 0..<4 { image.values[index + channel] = pixel[channel] }
    }

    private static func convolve(_ image: SVGFilterBitmap, orderX: Int, orderY: Int, kernel: [Float], divisor: Float, bias: Float, targetX: Int, targetY: Int, edge: SVGFilterEdgeMode, unitX: CGFloat, unitY: CGFloat, preserveAlpha: Bool, bounds: SVGFilterPixelRect) -> SVGFilterBitmap {
        guard orderX > 0, orderY > 0, kernel.count == orderX * orderY, divisor != 0 else { return image }
        var result = SVGFilterBitmap(width: image.width, height: image.height)
        for y in 0..<image.height {
            for x in 0..<image.width {
                var sums: [Float] = [0, 0, 0, 0]
                for row in 0..<orderY {
                    for column in 0..<orderX {
                        var pixel = sampleBilinear(
                            image,
                            x: CGFloat(x) + CGFloat(column - targetX) * unitX,
                            y: CGFloat(y) + CGFloat(row - targetY) * unitY,
                            edge: edge,
                            bounds: bounds
                        )
                        let weight = kernel[(orderY - row - 1) * orderX + orderX - column - 1]
                        if preserveAlpha {
                            let alpha = clamped(pixel[3])
                            if alpha > 0 {
                                pixel[0] = clamped(pixel[0] / alpha)
                                pixel[1] = clamped(pixel[1] / alpha)
                                pixel[2] = clamped(pixel[2] / alpha)
                            } else {
                                pixel[0] = 0; pixel[1] = 0; pixel[2] = 0
                            }
                        }
                        for channel in 0..<4 { sums[channel] += pixel[channel] * weight }
                    }
                }
                let index = (y * image.width + x) * 4
                if preserveAlpha {
                    let alpha = clamped(image.values[index + 3])
                    write([
                        clamped(sums[0] / divisor + bias) * alpha,
                        clamped(sums[1] / divisor + bias) * alpha,
                        clamped(sums[2] / divisor + bias) * alpha,
                        alpha,
                    ], to: &result, x: x, y: y)
                } else {
                    var channels = sums.map { clamped($0 / divisor + bias) }
                    let alpha = channels[3]
                    channels[0] = min(alpha, channels[0])
                    channels[1] = min(alpha, channels[1])
                    channels[2] = min(alpha, channels[2])
                    write(channels, to: &result, x: x, y: y)
                }
            }
        }
        return result
    }

    private static func morphology(_ image: SVGFilterBitmap, operation: SVGFilterMorphologyOperator, radiusX: CGFloat, radiusY: CGFloat) -> SVGFilterBitmap {
        guard radiusX > 0, radiusY > 0 else { return image }
        var result = SVGFilterBitmap(width: image.width, height: image.height)
        let minX = Int(ceil(-radiusX)); let maxX = Int(floor(radiusX))
        let minY = Int(ceil(-radiusY)); let maxY = Int(floor(radiusY))
        for y in 0..<image.height {
            for x in 0..<image.width {
                var channels: [Float] = Array(repeating: operation == .erode ? 1 : 0, count: 4)
                for offsetY in minY...maxY {
                    for offsetX in minX...maxX {
                        for channel in 0..<4 {
                            let value = image.component(x + offsetX, y + offsetY, channel)
                            channels[channel] = operation == .erode ? min(channels[channel], value) : max(channels[channel], value)
                        }
                    }
                }
                let alpha = channels[3]
                channels[0] = min(alpha, channels[0]); channels[1] = min(alpha, channels[1]); channels[2] = min(alpha, channels[2])
                write(channels, to: &result, x: x, y: y)
            }
        }
        return result
    }

    private static func displacement(_ source: SVGFilterBitmap, map: SVGFilterBitmap, a: CGFloat, b: CGFloat, c: CGFloat, d: CGFloat, xChannel: SVGFilterChannel, yChannel: SVGFilterChannel) -> SVGFilterBitmap {
        var result = SVGFilterBitmap(width: source.width, height: source.height)
        let bounds = SVGFilterPixelRect(minX: 0, minY: 0, maxX: source.width, maxY: source.height)
        for y in 0..<source.height {
            for x in 0..<source.width {
                let index = (y * map.width + x) * 4
                let alpha = clamped(map.values[index + 3])
                let xValue = alpha > 0 ? clamped(map.values[index + xChannel.index] / alpha) : 0
                let yValue = alpha > 0 ? clamped(map.values[index + yChannel.index] / alpha) : 0
                write(sampleBilinear(
                    source,
                    x: CGFloat(x) + a * CGFloat(xValue - 0.5) + c * CGFloat(yValue - 0.5),
                    y: CGFloat(y) + b * CGFloat(xValue - 0.5) + d * CGFloat(yValue - 0.5),
                    edge: .none,
                    bounds: bounds
                ), to: &result, x: x, y: y)
            }
        }
        return result
    }

    private static func positiveModulo(_ value: CGFloat, _ modulus: CGFloat) -> CGFloat {
        let remainder = value.truncatingRemainder(dividingBy: modulus)
        return remainder < 0 ? remainder + modulus : remainder
    }

    private static func tile(_ image: SVGFilterBitmap, input: SVGFilterPixelRegion, output: SVGFilterPixelRegion) -> SVGFilterBitmap {
        var result = SVGFilterBitmap(width: image.width, height: image.height)
        guard input.width > 0, input.height > 0 else { return result }
        let bounds = SVGFilterPixelRect(minX: 0, minY: 0, maxX: image.width, maxY: image.height)
        let startX = max(0, Int(floor(output.x))); let endX = min(image.width, Int(ceil(output.x + output.width)))
        let startY = max(0, Int(floor(output.y))); let endY = min(image.height, Int(ceil(output.y + output.height)))
        guard startX < endX, startY < endY else { return result }
        for y in startY..<endY {
            for x in startX..<endX {
                let sourceX = input.x + positiveModulo(CGFloat(x) + 0.5 - input.x, input.width) - 0.5
                let sourceY = input.y + positiveModulo(CGFloat(y) + 0.5 - input.y, input.height) - 0.5
                write(sampleBilinear(image, x: sourceX, y: sourceY, edge: .none, bounds: bounds), to: &result, x: x, y: y)
            }
        }
        return result
    }

    private final class TurbulenceGenerator {
        private static let latticeSize = 256
        private static let mask = 255
        private static let perlinN = 4096
        private var lattice = Array(repeating: 0, count: 514)
        private var gradients = Array(repeating: Array(repeating: (CGFloat(0), CGFloat(0)), count: 514), count: 4)

        init(seed: Int) {
            var random = Self.setupSeed(seed)
            var index = 0
            for channel in 0..<4 {
                for item in 0..<Self.latticeSize {
                    index = item
                    lattice[item] = item
                    var x: CGFloat = 0; var y: CGFloat = 0; var length: CGFloat = 0
                    repeat {
                        random = Self.nextRandom(random)
                        x = CGFloat(random % 512 - 256) / 256
                        random = Self.nextRandom(random)
                        y = CGFloat(random % 512 - 256) / 256
                        length = hypot(x, y)
                    } while length == 0
                    gradients[channel][item] = (x / length, y / length)
                }
            }
            index = Self.latticeSize
            while index > 1 {
                index -= 1
                random = Self.nextRandom(random)
                lattice.swapAt(index, random % Self.latticeSize)
            }
            for item in 0..<(Self.latticeSize + 2) {
                lattice[Self.latticeSize + item] = lattice[item]
                for channel in 0..<4 { gradients[channel][Self.latticeSize + item] = gradients[channel][item] }
            }
        }

        private static func setupSeed(_ value: Int) -> Int {
            if value <= 0 { return -(value % 2_147_483_646) + 1 }
            return min(value, 2_147_483_646)
        }

        private static func nextRandom(_ value: Int) -> Int {
            var result = 16_807 * (value % 127_773) - 2_836 * (value / 127_773)
            if result <= 0 { result += 2_147_483_647 }
            return result
        }

        private func noise(_ channel: Int, _ x: CGFloat, _ y: CGFloat, _ stitch: SVGFilterStitchInfo?) -> CGFloat {
            var bx0 = Int(x + CGFloat(Self.perlinN)); var bx1 = bx0 + 1
            let rx0 = x + CGFloat(Self.perlinN - bx0); let rx1 = rx0 - 1
            var by0 = Int(y + CGFloat(Self.perlinN)); var by1 = by0 + 1
            let ry0 = y + CGFloat(Self.perlinN - by0); let ry1 = ry0 - 1
            if let stitch {
                if bx0 >= stitch.wrapX { bx0 -= stitch.width }; if bx1 >= stitch.wrapX { bx1 -= stitch.width }
                if by0 >= stitch.wrapY { by0 -= stitch.height }; if by1 >= stitch.wrapY { by1 -= stitch.height }
            }
            bx0 &= Self.mask; bx1 &= Self.mask; by0 &= Self.mask; by1 &= Self.mask
            let i = lattice[bx0]; let j = lattice[bx1]
            let b00 = lattice[i + by0]; let b10 = lattice[j + by0]
            let b01 = lattice[i + by1]; let b11 = lattice[j + by1]
            func curve(_ value: CGFloat) -> CGFloat { value * value * (3 - 2 * value) }
            func dot(_ gradient: (CGFloat, CGFloat), _ dx: CGFloat, _ dy: CGFloat) -> CGFloat { dx * gradient.0 + dy * gradient.1 }
            let sx = curve(rx0); let sy = curve(ry0)
            let top = dot(gradients[channel][b00], rx0, ry0) + sx * (dot(gradients[channel][b10], rx1, ry0) - dot(gradients[channel][b00], rx0, ry0))
            let bottom = dot(gradients[channel][b01], rx0, ry1) + sx * (dot(gradients[channel][b11], rx1, ry1) - dot(gradients[channel][b01], rx0, ry1))
            return top + sy * (bottom - top)
        }

        func sample(channel: Int, x pointX: CGFloat, y pointY: CGFloat, frequencyX inputFrequencyX: CGFloat, frequencyY inputFrequencyY: CGFloat, octaves: Int, fractalNoise: Bool, stitchTiles: Bool, tile: SVGFilterRegion) -> Float {
            var frequencyX = inputFrequencyX; var frequencyY = inputFrequencyY
            var stitch: SVGFilterStitchInfo?
            if stitchTiles && tile.width > 0 && tile.height > 0 {
                func adjusted(_ frequency: CGFloat, _ size: CGFloat) -> CGFloat {
                    guard frequency != 0 else { return 0 }
                    let low = floor(size * frequency) / size; let high = ceil(size * frequency) / size
                    return low > 0 && frequency / low < high / frequency ? low : high
                }
                frequencyX = adjusted(frequencyX, tile.width); frequencyY = adjusted(frequencyY, tile.height)
                let width = Int(tile.width * frequencyX + 0.5); let height = Int(tile.height * frequencyY + 0.5)
                stitch = SVGFilterStitchInfo(
                    width: width,
                    height: height,
                    wrapX: Int(tile.x * frequencyX) + Self.perlinN + width,
                    wrapY: Int(tile.y * frequencyY) + Self.perlinN + height
                )
            }
            var x = pointX * frequencyX; var y = pointY * frequencyY
            var ratio: CGFloat = 1; var sum: CGFloat = 0
            for _ in 0..<octaves {
                let value = noise(channel, x, y, stitch)
                sum += (fractalNoise ? value : abs(value)) / ratio
                x *= 2; y *= 2; ratio *= 2
                if stitch != nil {
                    stitch!.width *= 2; stitch!.wrapX = 2 * stitch!.wrapX - Self.perlinN
                    stitch!.height *= 2; stitch!.wrapY = 2 * stitch!.wrapY - Self.perlinN
                }
            }
            return clamped(Float(fractalNoise ? (sum + 1) / 2 : sum))
        }
    }

    private static func turbulence(width: Int, height: Int, baseFrequencyX: CGFloat, baseFrequencyY: CGFloat, octaves: Int, seed: Int, stitch: Bool, fractalNoise: Bool, region: SVGFilterRegion, scaleX: CGFloat, scaleY: CGFloat) -> SVGFilterBitmap {
        var result = SVGFilterBitmap(width: width, height: height)
        let generator = TurbulenceGenerator(seed: seed)
        for y in 0..<height {
            for x in 0..<width {
                let channels = (0..<4).map { channel in generator.sample(
                    channel: channel,
                    x: CGFloat(x) / scaleX,
                    y: CGFloat(y) / scaleY,
                    frequencyX: baseFrequencyX,
                    frequencyY: baseFrequencyY,
                    octaves: octaves,
                    fractalNoise: fractalNoise,
                    stitchTiles: stitch,
                    tile: region
                ) }
                let alpha = channels[3]
                write([channels[0] * alpha, channels[1] * alpha, channels[2] * alpha, alpha], to: &result, x: x, y: y)
            }
        }
        return result
    }

    private static func gaussianKernel(_ sigma: CGFloat) -> [Float] {
        guard sigma > 0 else { return [1] }
        let radius = max(1, Int(ceil(sigma * 3)))
        var kernel = (-radius...radius).map { offset in Float(exp(-CGFloat(offset * offset) / (2 * sigma * sigma))) }
        let total = kernel.reduce(0, +)
        for index in kernel.indices { kernel[index] /= total }
        return kernel
    }

    private static func sample(_ image: SVGFilterBitmap, x: Int, y: Int, channel: Int, edge: SVGFilterEdgeMode, bounds: SVGFilterPixelRect) -> Float {
        if bounds.contains(x, y) { return image.component(x, y, channel) }
        switch edge {
        case .none: return 0
        case .duplicate:
            return image.component(min(bounds.maxX - 1, max(bounds.minX, x)), min(bounds.maxY - 1, max(bounds.minY, y)), channel)
        case .wrap:
            let width = max(1, bounds.maxX - bounds.minX)
            let height = max(1, bounds.maxY - bounds.minY)
            let wrappedX = bounds.minX + ((x - bounds.minX) % width + width) % width
            let wrappedY = bounds.minY + ((y - bounds.minY) % height + height) % height
            return image.component(wrappedX, wrappedY, channel)
        }
    }

    private static func blur(_ image: SVGFilterBitmap, sigmaX: CGFloat, sigmaY: CGFloat, edge: SVGFilterEdgeMode, bounds: SVGFilterPixelRect) -> SVGFilterBitmap {
        var horizontal = image
        let kernelX = gaussianKernel(sigmaX)
        let radiusX = kernelX.count / 2
        if radiusX > 0 {
            for y in 0..<image.height {
                for x in 0..<image.width {
                    for channel in 0..<4 {
                        var value: Float = 0
                        for offset in -radiusX...radiusX {
                            value += sample(image, x: x + offset, y: y, channel: channel, edge: edge, bounds: bounds) * kernelX[offset + radiusX]
                        }
                        horizontal.values[(y * image.width + x) * 4 + channel] = value
                    }
                }
            }
        }
        var vertical = horizontal
        let kernelY = gaussianKernel(sigmaY)
        let radiusY = kernelY.count / 2
        if radiusY > 0 {
            for y in 0..<image.height {
                for x in 0..<image.width {
                    for channel in 0..<4 {
                        var value: Float = 0
                        for offset in -radiusY...radiusY {
                            value += sample(horizontal, x: x, y: y + offset, channel: channel, edge: edge, bounds: bounds) * kernelY[offset + radiusY]
                        }
                        vertical.values[(y * image.width + x) * 4 + channel] = value
                    }
                }
            }
        }
        return vertical
    }

    private static func offset(_ image: SVGFilterBitmap, dx: CGFloat, dy: CGFloat) -> SVGFilterBitmap {
        var result = SVGFilterBitmap(width: image.width, height: image.height)
        for y in 0..<image.height {
            for x in 0..<image.width {
                let sourceX = CGFloat(x) - dx
                let sourceY = CGFloat(y) - dy
                let x0 = Int(floor(sourceX))
                let y0 = Int(floor(sourceY))
                let fractionX = Float(sourceX - CGFloat(x0))
                let fractionY = Float(sourceY - CGFloat(y0))
                for channel in 0..<4 {
                    let top = image.component(x0, y0, channel) * (1 - fractionX) + image.component(x0 + 1, y0, channel) * fractionX
                    let bottom = image.component(x0, y0 + 1, channel) * (1 - fractionX) + image.component(x0 + 1, y0 + 1, channel) * fractionX
                    result.values[(y * image.width + x) * 4 + channel] = top * (1 - fractionY) + bottom * fractionY
                }
            }
        }
        return result
    }

    private static func over(_ source: SVGFilterBitmap, _ destination: SVGFilterBitmap) -> SVGFilterBitmap {
        var result = source
        for index in stride(from: 0, to: result.values.count, by: 4) {
            let inverseAlpha = 1 - source.values[index + 3]
            result.values[index] = source.values[index] + destination.values[index] * inverseAlpha
            result.values[index + 1] = source.values[index + 1] + destination.values[index + 1] * inverseAlpha
            result.values[index + 2] = source.values[index + 2] + destination.values[index + 2] * inverseAlpha
            result.values[index + 3] = source.values[index + 3] + destination.values[index + 3] * inverseAlpha
        }
        return result
    }

    private static func apply(_ definition: SVGFilterDefinition, source unboundedSource: SVGFilterBitmap, scaleX: CGFloat, scaleY: CGFloat, filterImages: [String: SVGFilterBitmap]) -> SVGFilterBitmap {
        let filterRect = pixelRect(definition.region, scaleX: scaleX, scaleY: scaleY, width: unboundedSource.width, height: unboundedSource.height)
        let source = cropped(unboundedSource, to: filterRect)
        let sourceAlpha = alpha(source)
        let transparent = SVGFilterBitmap(width: source.width, height: source.height)
        let fillPaint = cropped(constant(definition.fillPaint, width: source.width, height: source.height), to: filterRect)
        let strokePaint = cropped(constant(definition.strokePaint, width: source.width, height: source.height), to: filterRect)
        var results: [SVGFilterBitmap] = []
        var resultRegions: [SVGFilterPixelRect] = []

        func input(_ value: SVGFilterInput) -> SVGFilterBitmap {
            switch value {
            case .sourceGraphic: return source
            case .sourceAlpha: return sourceAlpha
            case .backgroundImage, .backgroundAlpha: return transparent
            case .fillPaint: return fillPaint
            case .strokePaint: return strokePaint
            case let .result(index): return results.indices.contains(index) ? results[index] : source
            }
        }

        func inputRegion(_ value: SVGFilterInput) -> SVGFilterPixelRect {
            if case let .result(index) = value, resultRegions.indices.contains(index) {
                return resultRegions[index]
            }
            return filterRect
        }

        for primitive in definition.primitives {
            let linear = primitive.linearRGB
            let region = pixelRect(primitive.region, scaleX: scaleX, scaleY: scaleY, width: source.width, height: source.height)
            let output: SVGFilterBitmap
            switch primitive {
            case let .blend(value, value2, mode, _, _, _):
                let sourceValue = converted(input(value), linear: linear, encode: false)
                let backdropValue = converted(input(value2), linear: linear, encode: false)
                output = converted(blend(sourceValue, backdropValue, mode: mode), linear: linear, encode: true)
            case let .colorMatrix(value, matrix, _, _, _):
                let working = converted(input(value), linear: linear, encode: false)
                output = converted(colorMatrix(working, matrix: matrix), linear: linear, encode: true)
            case let .componentTransfer(value, functions, _, _, _):
                let working = converted(input(value), linear: linear, encode: false)
                output = converted(componentTransfer(working, functions: functions), linear: linear, encode: true)
            case let .composite(value, value2, operation, k1, k2, k3, k4, _, _, _):
                let sourceValue = converted(input(value), linear: linear, encode: false)
                let destinationValue = converted(input(value2), linear: linear, encode: false)
                output = converted(
                    composite(sourceValue, destinationValue, operation: operation, k1: k1, k2: k2, k3: k3, k4: k4),
                    linear: linear,
                    encode: true
                )
            case let .convolveMatrix(value, orderX, orderY, kernel, divisor, bias, targetX, targetY, edge, unitX, unitY, preserveAlpha, _, _, _):
                let working = converted(input(value), linear: linear, encode: false)
                output = converted(convolve(
                    working,
                    orderX: orderX,
                    orderY: orderY,
                    kernel: kernel,
                    divisor: divisor,
                    bias: bias,
                    targetX: targetX,
                    targetY: targetY,
                    edge: edge,
                    unitX: unitX.map { $0 * scaleX } ?? 1,
                    unitY: unitY.map { $0 * scaleY } ?? 1,
                    preserveAlpha: preserveAlpha,
                    bounds: inputRegion(value)
                ), linear: linear, encode: true)
            case let .morphology(value, operation, radiusX, radiusY, _, _, _):
                let working = converted(input(value), linear: linear, encode: false)
                output = converted(morphology(working, operation: operation, radiusX: radiusX * scaleX, radiusY: radiusY * scaleY), linear: linear, encode: true)
            case let .displacementMap(value, value2, a, b, c, d, xChannel, yChannel, _, _, _):
                let map = converted(input(value2), linear: linear, encode: false)
                output = displacement(
                    input(value),
                    map: map,
                    a: a * scaleX,
                    b: b * scaleY,
                    c: c * scaleX,
                    d: d * scaleY,
                    xChannel: xChannel,
                    yChannel: yChannel
                )
            case let .tile(value, tileRegion, _, _, _):
                output = tile(
                    input(value),
                    input: SVGFilterPixelRegion(x: tileRegion.x * scaleX, y: tileRegion.y * scaleY, width: tileRegion.width * scaleX, height: tileRegion.height * scaleY),
                    output: SVGFilterPixelRegion(x: primitive.region.x * scaleX, y: primitive.region.y * scaleY, width: primitive.region.width * scaleX, height: primitive.region.height * scaleY)
                )
            case let .turbulence(baseFrequencyX, baseFrequencyY, octaves, seed, stitch, fractalNoise, primitiveRegion, _, _):
                let generated = turbulence(
                    width: source.width,
                    height: source.height,
                    baseFrequencyX: baseFrequencyX,
                    baseFrequencyY: baseFrequencyY,
                    octaves: octaves,
                    seed: seed,
                    stitch: stitch,
                    fractalNoise: fractalNoise,
                    region: SVGFilterRegion(
                        x: 0,
                        y: 0,
                        width: primitiveRegion.width * scaleX,
                        height: primitiveRegion.height * scaleY
                    ),
                    scaleX: scaleX,
                    scaleY: scaleY
                )
                output = converted(generated, linear: linear, encode: true)
            case let .image(key, _, _, _):
                output = filterImages[key] ?? transparent
            case let .gaussianBlur(value, sigmaX, sigmaY, edge, _, _, _):
                output = converted(blur(converted(input(value), linear: linear, encode: false), sigmaX: sigmaX * scaleX, sigmaY: sigmaY * scaleY, edge: edge, bounds: inputRegion(value)), linear: linear, encode: true)
            case let .offset(value, dx, dy, _, _, _):
                output = offset(input(value), dx: dx * scaleX, dy: dy * scaleY)
            case let .flood(color, _, _, _):
                output = constant(color, width: source.width, height: source.height)
            case let .merge(inputs, _, _, _):
                var merged = transparent
                for value in inputs { merged = over(input(value), merged) }
                output = merged
            case let .dropShadow(value, sigmaX, sigmaY, dx, dy, color, _, _, _):
                let shadowAlpha = offset(blur(alpha(input(value)), sigmaX: sigmaX * scaleX, sigmaY: sigmaY * scaleY, edge: .none, bounds: inputRegion(value)), dx: dx * scaleX, dy: dy * scaleY)
                var shadow = constant(color, width: source.width, height: source.height)
                for index in stride(from: 0, to: shadow.values.count, by: 4) {
                    let mask = shadowAlpha.values[index + 3]
                    shadow.values[index] *= mask
                    shadow.values[index + 1] *= mask
                    shadow.values[index + 2] *= mask
                    shadow.values[index + 3] *= mask
                }
                output = over(input(value), shadow)
            case let .passthrough(value, _, _, _):
                output = input(value)
            }
            results.append(cropped(output, to: region))
            resultRegions.append(region)
        }
        return cropped(results.last ?? source, to: filterRect)
    }
}`;
  const indentation = " ".repeat(indentationSize);
  return source.split("\n").map((line) => {
    const leading = /^ */.exec(line)?.[0].length ?? 0;
    return `${indentation.repeat(Math.floor(leading / 4))}${line.slice(leading)}`;
  });
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
    node.type === "foreignObject"
      ? { defer: false, align: "none" as const, meetOrSlice: "meet" as const }
      : resource.type === "svg" && node.preserveAspectRatio.defer && resource.hasReferencedPreserveAspectRatio
        ? resource.referencedPreserveAspectRatio
        : node.preserveAspectRatio;
  const placement = viewBoxTransform(
    { x: 0, y: 0, width: intrinsic.width, height: intrinsic.height },
    node.viewport,
    preserveAspectRatio,
  );
  const imageTransform = multiplyTransforms(helper.transform, placement);
  const imageRendering = node.type === "image" ? node.imageRendering : "auto";
  const quality = /pixelated|crisp-edges/i.test(imageRendering)
    ? "none"
    : /optimizequality|high-quality/i.test(imageRendering)
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

function createFilterImageHelper(helper: FilterImageHelper, indentationSize: number): string[] {
  const indentation = " ".repeat(indentationSize);
  const i2 = indentation.repeat(2);
  const i3 = indentation.repeat(3);
  const i4 = indentation.repeat(4);
  const primitive = helper.primitive;
  const resource = primitive.image.resource!;
  const canvas = helper.canvas;
  const isLocal = primitive.image.localElementId !== undefined;
  const intrinsic =
    resource.type === "raster"
      ? (resource.intrinsicSize ?? { width: primitive.subregion.width, height: primitive.subregion.height })
      : { width: resource.document.viewport.width, height: resource.document.viewport.height };
  const preserveAspectRatio =
    resource.type === "svg" && primitive.image.preserveAspectRatio.defer && resource.hasReferencedPreserveAspectRatio
      ? resource.referencedPreserveAspectRatio
      : primitive.image.preserveAspectRatio;
  const placement = isLocal
    ? (primitive.image.contentTransform ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
    : viewBoxTransform(
        { x: 0, y: 0, width: intrinsic.width, height: intrinsic.height },
        primitive.subregion,
        preserveAspectRatio,
      );
  const drawRect =
    resource.type === "svg" && isLocal
      ? resource.document.viewport.viewBox
      : { x: 0, y: 0, width: intrinsic.width, height: intrinsic.height };
  const body = [
    `private struct ${helper.name}: View {`,
    `${indentation}var body: some View {`,
    `${i2}Canvas { context, size in`,
    `${i3}guard size.width > 0, size.height > 0 else { return }`,
    `${i3}let viewport = CGAffineTransform(a: size.width / ${formatNumber(canvas.width)}, b: 0, c: 0, d: size.height / ${formatNumber(canvas.height)}, tx: ${formatNumber(-canvas.x)} * size.width / ${formatNumber(canvas.width)}, ty: ${formatNumber(-canvas.y)} * size.height / ${formatNumber(canvas.height)})`,
    `${i3}context.transform = viewport`,
    `${i3}context.clip(to: Path(CGRect(x: ${formatNumber(primitive.subregion.x)}, y: ${formatNumber(primitive.subregion.y)}, width: ${formatNumber(primitive.subregion.width)}, height: ${formatNumber(primitive.subregion.height)})))`,
    `${i3}context.transform = context.transform.concatenating(${swiftTransform(placement)})`,
  ];
  if (resource.type === "svg") {
    body.push(
      `${i3}if let image = context.resolveSymbol(id: 0) {`,
      `${i4}context.draw(image, in: CGRect(x: ${formatNumber(drawRect.x)}, y: ${formatNumber(drawRect.y)}, width: ${formatNumber(drawRect.width)}, height: ${formatNumber(drawRect.height)}))`,
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
      `${i4}context.draw(context.resolve(source), in: CGRect(x: 0, y: 0, width: ${formatNumber(intrinsic.width)}, height: ${formatNumber(intrinsic.height)}))`,
      `${i3}}`,
      `${i2}}`,
    );
  }
  body.push(`${indentation}}`);
  if (resource.type === "raster" && resource.bytes) {
    body.push(
      "",
      `${indentation}private static let embeddedImage: Image? = {`,
      `${i2}guard let data = Data(base64Encoded: ${swiftString(base64(resource.bytes))}),`,
      `${i2}${indentation}let source = CGImageSourceCreateWithData(data as CFData, nil),`,
      `${i2}${indentation}let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }`,
      `${i2}return Image(decorative: image, scale: 1, orientation: .up)`,
      `${indentation}}()`,
    );
  }
  body.push("}");
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
  filterImageHelpers: ViewBuildContext["filterImageHelpers"],
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
  for (const helper of filterImageHelpers) body.push("", ...createFilterImageHelper(helper, indentationSize));
  if (containsGradientNode(nodes)) body.push("", ...gradientSupport(indentationSize));
  if (containsFilterNode(nodes)) body.push("", ...filterSupport(indentationSize));
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
    filterImageHelpers: [],
    subdocuments: [],
    rootName: config.structName ?? "SVGView",
    config,
  };
  const nodes = buildViewNodes(document.children, context);
  const imports = new Set<string>();
  if (containsFilterNode(nodes)) {
    imports.add("Foundation");
    imports.add("SwiftUI");
  }
  if (context.textHelpers.length > 0) imports.add("CoreText");
  if (context.imageHelpers.some((helper) => helper.node.resource?.type === "raster" && helper.node.resource.bytes)) {
    imports.add("Foundation");
    imports.add("ImageIO");
  }
  if (
    context.filterImageHelpers.some(
      (helper) => helper.primitive.image.resource?.type === "raster" && helper.primitive.image.resource.bytes,
    )
  ) {
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
        context.filterImageHelpers,
        document.viewport.coordinateSpace,
        document,
        indentationSize,
      ),
      ...context.subdocuments.flatMap((lines) => ["", ...lines]),
    ],
    preservesColors: true,
  };
}
