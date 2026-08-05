import type { ElementNode } from "svg-parser";
import { parseRGBAColor, type RGBAColor, swiftUIColor } from "../colorUtils";
import { handleElement } from "../elementHandlers";
import { lengthContext, type ParsedSVGLength, parseSVGLength, resolveSVGLength } from "../lengths";
import { createFunctionTemplate, createStructTemplate } from "../templates";
import { IDENTITY_TRANSFORM, multiplyTransforms, wrapWithTransform } from "../transformUtils";
import type { SVGElementProperties, SwiftUIGeneratorConfig, TranspilerOptions, ViewBoxData } from "../types";
import { viewBoxTransform } from "../viewports";
import type { AnimationDefinition, AnimationTime } from "./animation";
import {
  addAnimationValues,
  animationAttributeSpec,
  parseAnimationValue,
  resolveAnimationAttributeForTarget,
  swiftAnimationValueLiteral,
  type TypedAnimationValue,
} from "./animationValues";
import { objectBoundingBox, renderNodeBounds } from "./bounds";
import { type ResolvedGradient, resolveGradientForShape } from "./gradients";
import { type ResolvedPattern, resolvePatternForShape } from "./patterns";
import {
  computeSMILActiveDuration,
  computeSMILRepeatingDuration,
  type SMILTimingInterval,
  sampleSMILProgram,
} from "./smilTiming";
import type {
  AccessibilityMetadata,
  ClipPathInstance,
  ComputedStyle,
  FilterInput,
  FilterInstance,
  FilterLightSource,
  FilterPrimitive,
  Geometry,
  GradientStop,
  MaskInstance,
  Paint,
  PaintServer,
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
  animated?: boolean;
}

type GeneratedViewNode =
  | {
      type: "paint";
      helper: string;
      swiftColor: string;
      cgColor: RGBAColor;
      cgColorExpression?: string;
      tileContained?: boolean;
      clipUnions?: string[][];
    }
  | {
      type: "gradient";
      helper: string;
      gradient: ResolvedGradient;
      paintOpacity: number;
      coordinateSpace: ViewBoxData;
      stopsExpression?: string;
      coordinateExpressions?: Readonly<Record<string, string>>;
      matrixExpression?: string;
      spreadExpression?: string;
      linearRGBExpression?: string;
    }
  | {
      type: "pattern";
      helper: string;
      pattern: ResolvedPattern;
      paintOpacity: number;
      coordinateSpace: ViewBoxData;
      patternIndex: number;
      coordinateExpressions?: Readonly<Record<string, string>>;
      rangeFactorX?: number;
      rangeFactorY?: number;
      transformCorrection?: string;
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
      opacity: number | string;
      isolated: boolean;
      blendMode: SVGBlendMode;
      viewportClip?: string;
      clipPath?: GeneratedClipPath;
      mask?: GeneratedMask;
      filter?: GeneratedFilter;
      tileContained?: boolean;
      accessibility?: AccessibilityMetadata;
      animationOffsetX?: string;
      animationOffsetY?: string;
      presentationCondition?: string;
      animationTransform?: string;
      interaction?: { targetId: string; events: readonly string[]; pointerEvents: string };
    };

interface GeneratedMask {
  children: GeneratedViewNode[];
  clip: string;
  luminance: boolean;
}

interface GeneratedFilter {
  instance: FilterInstance;
  regionExpression?: string;
  primitiveOverrides: ReadonlyArray<Readonly<Record<string, string>>>;
  canvas: ViewBoxData;
  imageHelpers: Array<{ key: string; name: string; animated?: boolean }>;
  maxOutputPixels: number;
}

interface FilterImageHelper {
  key: string;
  name: string;
  primitive: Extract<FilterPrimitive, { type: "image" }>;
  canvas: ViewBoxData;
  subdocumentName?: string;
  animated?: boolean;
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
  textHelpers: Array<{
    name: string;
    node: RenderText;
    transform: RenderNode["transform"];
    fillAnimation?: string;
    fillOpacity?: string;
    strokeAnimation?: string;
    strokeOpacity?: string;
    strokeWidth?: string;
    fontSize?: string;
    letterSpacing?: string;
    wordSpacing?: string;
    chunks: Array<{
      x?: string;
      y?: string;
      startOffset?: string;
      adjustmentTargets: Array<string | undefined>;
      runs: Array<{
        fontSize?: string;
        letterSpacing?: string;
        wordSpacing?: string;
        fill?: string;
        fillOpacity?: string;
        stroke?: string;
        strokeOpacity?: string;
        strokeWidth?: string;
        characterDX?: string;
        characterDY?: string;
        characterRotate?: string;
      }>;
    }>;
    animated: boolean;
    eventDriven?: boolean;
  }>;
  imageHelpers: Array<{
    name: string;
    node: Extract<RenderNode, { type: "image" | "foreignObject" }>;
    transform: RenderNode["transform"];
    subdocumentName?: string;
    subdocumentAnimated?: boolean;
    animated?: boolean;
    transformExpression?: string;
    eventDriven?: boolean;
  }>;
  filterImageHelpers: FilterImageHelper[];
  subdocuments: string[][];
  rootName: string;
  config: SwiftUIGeneratorConfig;
  animationIntervals: ReadonlyMap<string, readonly SMILTimingInterval[]>;
  dynamicTimingIds: ReadonlySet<string>;
  eventTargets: ReadonlyMap<string, readonly string[]>;
}

function dynamicTimingIds(document: RenderDocument): ReadonlySet<string> {
  const dynamic = new Set(
    document.animationProgram.animations
      .filter(
        (animation) =>
          animation.runtimeSupport === "typed" &&
          [...animation.timing.begin, ...animation.timing.end].some((time) => time.type === "event"),
      )
      .map((animation) => animation.stableId),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const animation of document.animationProgram.animations) {
      if (dynamic.has(animation.stableId) || !animation.dependencies.some((dependency) => dynamic.has(dependency)))
        continue;
      dynamic.add(animation.stableId);
      changed = true;
    }
  }
  return dynamic;
}

function animationEventTargets(document: RenderDocument): ReadonlyMap<string, readonly string[]> {
  const targets = new Map<string, Set<string>>();
  for (const animation of document.animationProgram.animations) {
    if (animation.runtimeSupport !== "typed") continue;
    for (const time of [...animation.timing.begin, ...animation.timing.end]) {
      if (time.type !== "event") continue;
      const targetId = time.targetId ?? animation.target?.source.id ?? animation.target?.key;
      if (!targetId) continue;
      const events = targets.get(targetId) ?? new Set<string>();
      events.add(time.event.toLowerCase());
      targets.set(targetId, events);
    }
  }
  return new Map([...targets].map(([target, events]) => [target, [...events].sort()]));
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

function swiftDuration(value: number): string {
  return Number.isFinite(value) ? formatNumber(value) : "Double.infinity";
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

function addAnimatedHelper(context: ViewBuildContext, name: string, lines: string[]): string {
  context.helpers.push({ name, lines, animated: true });
  return `${name}(documentTime: documentTime${context.dynamicTimingIds.size > 0 ? ", animationIntervals: animationIntervals" : ""})`;
}

function shapeHelperCall(helper: string): string {
  return helper.includes("(") ? helper : `${helper}()`;
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
  inheritedAnimationOwners: Readonly<Record<string, RenderNode>> = {},
): GeneratedViewNode[] {
  const generated: GeneratedViewNode[] = [];

  const directAnimationsFor = (node: RenderNode, attributeName: string) =>
    node.animationTargetKey
      ? context.document.animationProgram.animations.filter(
          (candidate) =>
            candidate.runtimeSupport === "typed" &&
            candidate.target?.key === node.animationTargetKey &&
            candidate.attributeName === attributeName,
        )
      : [];

  const intervalLiteral = (animation: AnimationDefinition): string => {
    if (context.dynamicTimingIds.has(animation.stableId))
      return `animationIntervals[${swiftString(animation.stableId)}] ?? []`;
    const intervals = context.animationIntervals.get(animation.stableId) ?? [];
    return `[${intervals
      .map((interval) => `(begin: ${swiftDuration(interval.begin)}, end: ${swiftDuration(interval.end)})`)
      .join(", ")}]`;
  };

  const ownedAnimationsFor = (node: RenderNode, attributeName: string) => {
    const direct = directAnimationsFor(node, attributeName);
    if (direct.length > 0) return direct;
    if ((attributeName === "fill" || attributeName === "stroke") && node.style.currentColorProperties[attributeName])
      return directAnimationsFor(node, "color");
    return direct;
  };

  const animationsFor = (node: RenderNode, attributeName: string) => {
    const direct = ownedAnimationsFor(node, attributeName);
    if (direct.length > 0 || !node.style.inheritedProperties[attributeName]) return direct;
    const owner = inheritedAnimationOwners[attributeName];
    return owner ? ownedAnimationsFor(owner, attributeName) : direct;
  };

  const inheritedAnimationAttributes = [
    "color",
    "fill",
    "fill-opacity",
    "font-size",
    "letter-spacing",
    "stroke",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke-width",
    "visibility",
    "word-spacing",
  ] as const;

  const valueContext = (node: RenderNode) => ({
    length: {
      viewport: node.paintContext.viewport,
      rootViewport: node.paintContext.rootViewport,
      fontMetrics: node.paintContext.fontMetrics,
      percentageBasis: "viewport-diagonal" as const,
      axis: "other" as const,
    },
    colorSpace:
      String(node.style.presentation["color-interpolation"] ?? "sRGB").toLowerCase() === "linearrgb"
        ? ("linearRGB" as const)
        : ("sRGB" as const),
  });

  const cssTimingLiteral = (
    timing: NonNullable<AnimationDefinition["cssAnimation"]>["segmentTimingFunctions"][number],
  ) => {
    if (timing.type === "linear") return `${context.rootName}.SVGCSSTimingFunction(kind: .linear)`;
    if (timing.type === "cubic")
      return `${context.rootName}.SVGCSSTimingFunction(kind: .cubic, x1: ${formatNumber(timing.x1)}, y1: ${formatNumber(timing.y1)}, x2: ${formatNumber(timing.x2)}, y2: ${formatNumber(timing.y2)})`;
    const position = {
      "jump-start": "jumpStart",
      "jump-end": "jumpEnd",
      "jump-none": "jumpNone",
      "jump-both": "jumpBoth",
    }[timing.position];
    return `${context.rootName}.SVGCSSTimingFunction(kind: .steps, count: ${timing.count}, position: .${position})`;
  };

  const animatedValueExpressionFromAnimations = (
    animations: ReturnType<typeof directAnimationsFor>,
    base: TypedAnimationValue,
  ): string | undefined => {
    if (animations.length === 0) return undefined;
    let expression = swiftAnimationValueLiteral(base, context.precision, `${context.rootName}.`);
    for (const animation of animations) {
      if (animation.value.family === "unsupported") continue;
      const set = animation.value;
      let authoredValues: readonly TypedAnimationValue[] | undefined;
      let form = set.form;
      if (animation.kind === "set") {
        const target = set.to ?? (set.values ? set.values[set.values.length - 1] : undefined);
        if (!target) continue;
        authoredValues = [target];
        form = "values";
      } else if (set.form === "values") authoredValues = set.values;
      else if (set.form === "from-to" && set.from && set.to) authoredValues = [set.from, set.to];
      else if (set.form === "from-by" && set.from && set.by) {
        const endpoint = addAnimationValues(set.from, set.by);
        if (endpoint) authoredValues = [set.from, endpoint];
      } else if (set.form === "by" && set.by) authoredValues = [set.by];
      else if (set.form === "to" && set.to) authoredValues = [set.to];
      if (!authoredValues || authoredValues.length === 0) continue;
      if (base.family === "paint")
        authoredValues = authoredValues.map((value) =>
          value.family === "color" ? { family: "paint", value: { type: "color", color: value.value } } : value,
        );
      const clampMode =
        set.family === "integer"
          ? "integer"
          : set.attribute.clamp === "unit"
            ? "unit"
            : set.attribute.clamp === "nonnegative"
              ? "nonnegative"
              : "none";
      if (animation.kind === "cssAnimation" && animation.cssAnimation) {
        const css = animation.cssAnimation;
        const keyTimes = animation.composition.keyTimes?.map((value) => formatNumber(value)).join(", ") ?? "";
        const iterationCount = Number.isFinite(css.iterationCount) ? formatNumber(css.iterationCount) : ".infinity";
        expression = `${context.rootName}.svgCSSAnimatedValue(documentTime: documentTime, duration: ${swiftDuration(css.duration)}, delay: ${swiftDuration(css.delay)}, iterationCount: ${iterationCount}, direction: .${css.direction.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}, fillMode: .${css.fillMode}, playState: .${css.playState}, values: [${authoredValues.map((value) => swiftAnimationValueLiteral(value, context.precision, `${context.rootName}.`)).join(", ")}], keyTimes: [${keyTimes}], timingFunctions: [${css.segmentTimingFunctions.map(cssTimingLiteral).join(", ")}], clamp: .${clampMode}, underlying: ${expression})`;
        continue;
      }
      const duration =
        animation.timing.duration.type === "seconds" ? animation.timing.duration.seconds : Number.POSITIVE_INFINITY;
      const repeatingDuration = computeSMILRepeatingDuration(animation.timing);
      const keyTimes = animation.composition.keyTimes?.map((value) => formatNumber(value)).join(", ") ?? "";
      const keySplines =
        animation.composition.keySplines
          ?.map(
            (spline) =>
              `(x1: ${formatNumber(spline.x1)}, y1: ${formatNumber(spline.y1)}, x2: ${formatNumber(spline.x2)}, y2: ${formatNumber(spline.y2)})`,
          )
          .join(", ") ?? "";
      expression = `${context.rootName}.svgAnimatedValue(documentTime: documentTime, intervals: ${intervalLiteral(animation)}, duration: ${swiftDuration(duration)}, repeatingDuration: ${swiftDuration(repeatingDuration)}, values: [${authoredValues.map((value) => swiftAnimationValueLiteral(value, context.precision, `${context.rootName}.`)).join(", ")}], form: .${form.replace(/-/g, "")}, calcMode: .${animation.kind === "set" ? "discrete" : animation.composition.calcMode}, keyTimes: [${keyTimes}], keySplines: [${keySplines}], additive: ${animation.composition.additive === "sum" || set.form === "by" ? "true" : "false"}, accumulate: ${animation.composition.accumulate === "sum" ? "true" : "false"}, clamp: .${clampMode}, underlying: ${expression}, freeze: ${animation.timing.fill === "freeze" ? "true" : "false"})`;
    }
    return expression;
  };

  const animatedValueExpression = (
    node: RenderNode,
    attributeName: string,
    base: TypedAnimationValue,
  ): string | undefined => animatedValueExpressionFromAnimations(animationsFor(node, attributeName), base);

  const animatedMotionExpression = (node: RenderNode): string | undefined => {
    const animations = directAnimationsFor(node, "motion");
    if (animations.length === 0) return undefined;
    let expression = "CGAffineTransform.identity";
    for (const animation of animations) {
      const motion = animation.motion;
      if (!motion) continue;
      const duration =
        animation.timing.duration.type === "seconds" ? animation.timing.duration.seconds : Number.POSITIVE_INFINITY;
      const repeatingDuration = computeSMILRepeatingDuration(animation.timing);
      const points = motion.points
        .map(
          (point) =>
            `${context.rootName}.SVGAnimationMotionPoint(x: ${formatNumber(point.x)}, y: ${formatNumber(point.y)}, distance: ${formatNumber(point.distance)}, move: ${point.move})`,
        )
        .join(", ");
      const keyTimes = animation.composition.keyTimes?.map((value) => formatNumber(value)).join(", ") ?? "";
      const keyPoints = animation.composition.keyPoints?.map((value) => formatNumber(value)).join(", ") ?? "";
      const pathPoints = motion.keyDistances
        .map((distance) => formatNumber(motion.length <= 1e-12 ? 0 : distance / motion.length))
        .join(", ");
      const keySplines =
        animation.composition.keySplines
          ?.map(
            (spline) =>
              `(x1: ${formatNumber(spline.x1)}, y1: ${formatNumber(spline.y1)}, x2: ${formatNumber(spline.x2)}, y2: ${formatNumber(spline.y2)})`,
          )
          .join(", ") ?? "";
      const rotateMode = motion.rotate.type === "auto" ? (motion.rotate.reverse ? "autoReverse" : "auto") : "angle";
      const angle = motion.rotate.type === "angle" ? motion.rotate.degrees : 0;
      expression = `${context.rootName}.svgAnimatedMotion(documentTime: documentTime, intervals: ${intervalLiteral(animation)}, duration: ${swiftDuration(duration)}, repeatingDuration: ${swiftDuration(repeatingDuration)}, points: [${points}], length: ${formatNumber(motion.length)}, pathPoints: [${pathPoints}], rotate: .${rotateMode}, angle: ${formatNumber(angle)}, calcMode: .${animation.composition.calcMode}, keyTimes: [${keyTimes}], keyPoints: [${keyPoints}], keySplines: [${keySplines}], additive: ${animation.composition.additive === "sum" ? "true" : "false"}, accumulate: ${animation.composition.accumulate === "sum" ? "true" : "false"}, underlying: ${expression}, freeze: ${animation.timing.fill === "freeze" ? "true" : "false"})`;
    }
    return expression === "CGAffineTransform.identity" ? undefined : expression;
  };

  const transformCorrectionExpression = (
    node: RenderNode,
    transforms: RenderNode["transform"][],
    animatedSuffix?: string,
    animatedBaseOverride?: string,
  ): string | undefined => {
    const metadata = node.transformAnimation ?? { base: node.transform, suffix: IDENTITY_TRANSFORM };
    const baseValue: TypedAnimationValue = {
      family: "transform",
      components: [
        {
          kind: "matrix",
          values: [
            metadata.base.a,
            metadata.base.b,
            metadata.base.c,
            metadata.base.d,
            metadata.base.e,
            metadata.base.f,
          ],
        },
      ],
    };
    const animatedBase = animatedValueExpression(node, "transform", baseValue);
    const animatedMotion = animatedMotionExpression(node);
    if (!animatedBase && !animatedSuffix && !animatedMotion && !animatedBaseOverride) return undefined;
    const ancestors = transforms.reduce(multiplyTransforms, IDENTITY_TRANSFORM);
    const staticTransform = multiplyTransforms(ancestors, node.transform);
    const origin = (() => {
      const raw = String(node.style.presentation["transform-origin"] ?? "0 0").trim();
      let tokens = raw.split(/\s+/).filter(Boolean).slice(0, 2);
      if (tokens.length === 1)
        tokens = ["top", "bottom"].includes(tokens[0]!.toLowerCase()) ? ["center", tokens[0]!] : [tokens[0]!, "center"];
      if (["top", "bottom"].includes(tokens[0]?.toLowerCase() ?? "")) tokens = [tokens[1] ?? "center", tokens[0]!];
      const box = context.options.viewBox;
      const resolve = (token: string | undefined, axis: "horizontal" | "vertical") => {
        const lower = (token ?? "0").toLowerCase();
        if (lower === "center") return axis === "horizontal" ? box.x + box.width / 2 : box.y + box.height / 2;
        if (lower === "left") return box.x;
        if (lower === "right") return box.x + box.width;
        if (lower === "top") return box.y;
        if (lower === "bottom") return box.y + box.height;
        try {
          const value = resolveSVGLength(parseSVGLength(lower), {
            viewport: { width: box.width, height: box.height },
            rootViewport: node.paintContext.rootViewport,
            fontMetrics: node.paintContext.fontMetrics,
            axis,
            percentageBasis: axis === "horizontal" ? "viewport-width" : "viewport-height",
          });
          return (axis === "horizontal" ? box.x : box.y) + (typeof value === "number" ? value : 0);
        } catch {
          return 0;
        }
      };
      return { x: resolve(tokens[0], "horizontal"), y: resolve(tokens[1], "vertical") };
    })();
    return `${context.rootName}.svgAnimatedTransformCorrection(animatedBase: ${animatedBaseOverride ?? (animatedBase ? `${context.rootName}.svgAnimationTransform(${animatedBase})` : swiftTransform(metadata.base))}, animatedMotion: ${animatedMotion ?? "CGAffineTransform.identity"}, animatedSuffix: ${animatedSuffix ?? swiftTransform(metadata.suffix)}, originX: ${formatNumber(origin.x)}, originY: ${formatNumber(origin.y)}, ancestors: ${swiftTransform(ancestors)}, staticTransform: ${swiftTransform(staticTransform)}, outputSize: proxy.size, coordinateSpace: CGRect(x: ${formatNumber(context.options.viewBox.x)}, y: ${formatNumber(context.options.viewBox.y)}, width: ${formatNumber(context.options.viewBox.width)}, height: ${formatNumber(context.options.viewBox.height)}))`;
  };

  const numericBase = (
    node: RenderNode,
    attributeName: string,
    source: string | number,
  ): TypedAnimationValue | undefined => {
    const spec = animationAttributeSpec(attributeName);
    return spec ? parseAnimationValue(spec, String(source), valueContext(node)) : undefined;
  };

  const animatedNumber = (node: RenderNode, attributeName: string, source: string | number): string | undefined => {
    const base = numericBase(node, attributeName, source);
    if (!base || !("value" in base) || typeof base.value !== "number") return undefined;
    const expression = animatedValueExpression(node, attributeName, base);
    return expression ? `${context.rootName}.svgAnimationNumber(${expression})` : undefined;
  };

  const animatedPaint = (node: RenderNode, attributeName: "fill" | "stroke", paint: Paint): string | undefined => {
    const spec = animationAttributeSpec(attributeName)!;
    const base = parseAnimationValue(spec, paintValue(paint), valueContext(node));
    if (!base) return undefined;
    return animatedValueExpression(node, attributeName, base);
  };

  const animatedDiscrete = (node: RenderNode, attributeName: string, source: string): string | undefined => {
    const spec = animationAttributeSpec(attributeName);
    const base = spec ? parseAnimationValue(spec, source, valueContext(node)) : undefined;
    if (!base) return undefined;
    const expression = animatedValueExpression(node, attributeName, base);
    return expression ? `${context.rootName}.svgAnimationSource(${expression})` : undefined;
  };

  const animatedGradientStopValues = (stop: GradientStop, node: RenderNode) => {
    const key = stop.animationTargetKey;
    const animations = (attributeName: string) =>
      key
        ? context.document.animationProgram.animations.filter(
            (candidate) =>
              candidate.runtimeSupport === "typed" &&
              candidate.target?.key === key &&
              candidate.attributeName === attributeName,
          )
        : [];
    const base = stop.animationBaseValues ?? {};
    const parsedOffset = parseAnimationValue(
      animationAttributeSpec("offset")!,
      base.offset ?? String(stop.offset),
      valueContext(node),
    );
    const parsedColor = parseAnimationValue(
      animationAttributeSpec("stop-color")!,
      base["stop-color"] ?? `rgba(${stop.color.red * 255} ${stop.color.green * 255} ${stop.color.blue * 255} / 1)`,
      valueContext(node),
    );
    const parsedOpacity = parseAnimationValue(
      animationAttributeSpec("stop-opacity")!,
      base["stop-opacity"] ?? String(stop.color.alpha),
      valueContext(node),
    );
    if (!parsedOffset || !parsedColor || !parsedOpacity) return undefined;
    const offsetAnimations = animations("offset");
    const colorAnimations = animations("stop-color");
    const opacityAnimations = animations("stop-opacity");
    return {
      animated: offsetAnimations.length + colorAnimations.length + opacityAnimations.length > 0,
      offset:
        animatedValueExpressionFromAnimations(offsetAnimations, parsedOffset) ??
        swiftAnimationValueLiteral(parsedOffset, context.precision, `${context.rootName}.`),
      color:
        animatedValueExpressionFromAnimations(colorAnimations, parsedColor) ??
        swiftAnimationValueLiteral(parsedColor, context.precision, `${context.rootName}.`),
      opacity:
        animatedValueExpressionFromAnimations(opacityAnimations, parsedOpacity) ??
        swiftAnimationValueLiteral(parsedOpacity, context.precision, `${context.rootName}.`),
    };
  };

  const animatedGradientStopsExpression = (stops: readonly GradientStop[], node: RenderNode, opacity: number) => {
    const values = stops.map((stop) => animatedGradientStopValues(stop, node));
    if (!values.some((value) => value?.animated)) return undefined;
    return `${context.rootName}.svgNormalizedGradientStops([${values
      .map((value, index) =>
        value
          ? `${context.rootName}.svgAnimatedGradientStop(offset: ${value.offset}, color: ${value.color}, opacity: ${value.opacity}, paintOpacity: ${formatNumber(opacity)})`
          : gradientStopLiteral(stops[index]!, opacity),
      )
      .join(", ")}])`;
  };

  const animationsForResource = (key: string | undefined, attributeName: string) =>
    key
      ? context.document.animationProgram.animations.filter(
          (candidate) =>
            candidate.runtimeSupport === "typed" &&
            candidate.target?.key === key &&
            candidate.attributeName === attributeName,
        )
      : [];

  const animatedGradientExpressions = (
    server: Extract<PaintServer, { type: "linearGradient" | "radialGradient" }>,
    gradient: ResolvedGradient,
    node: RenderNode,
  ) => {
    const valueContextForGradient = {
      ...valueContext(node),
      length: {
        ...valueContext(node).length,
        ...(server.units === "objectBoundingBox"
          ? { viewport: { width: 1, height: 1 }, rootViewport: { width: 1, height: 1 } }
          : {}),
      },
    };
    const coordinateExpressions: Record<string, string> = {};
    for (const name of server.type === "linearGradient"
      ? (["x1", "y1", "x2", "y2"] as const)
      : (["cx", "cy", "r", "fx", "fy", "fr"] as const)) {
      const animations = animationsForResource(server.animationTargetKeys[name], name);
      if (animations.length === 0) continue;
      const spec = animationAttributeSpec(name);
      const base = spec
        ? parseAnimationValue(spec, server.animationBaseValues[name] ?? String(gradient[name]), valueContextForGradient)
        : undefined;
      const expression = base ? animatedValueExpressionFromAnimations(animations, base) : undefined;
      if (expression) coordinateExpressions[name] = `${context.rootName}.svgAnimationNumber(${expression})`;
    }
    const spreadAnimations = animationsForResource(server.animationTargetKeys.spreadMethod, "spreadMethod");
    const spreadBase = parseAnimationValue(
      animationAttributeSpec("spreadMethod")!,
      server.animationBaseValues.spreadMethod ?? server.spreadMethod,
      valueContextForGradient,
    );
    const spreadValue = animatedValueExpressionFromAnimations(spreadAnimations, spreadBase!);
    const spreadExpression = spreadValue
      ? `(${context.rootName}.svgAnimationSource(${spreadValue}) == "repeat" ? .repeating : (${context.rootName}.svgAnimationSource(${spreadValue}) == "reflect" ? .reflect : .pad))`
      : undefined;
    const interpolationAnimations = animationsForResource(
      server.animationTargetKeys["color-interpolation"],
      "color-interpolation",
    );
    const interpolationBase = parseAnimationValue(
      animationAttributeSpec("color-interpolation")!,
      server.animationBaseValues["color-interpolation"] ?? server.colorInterpolation,
      valueContextForGradient,
    );
    const interpolationValue = animatedValueExpressionFromAnimations(interpolationAnimations, interpolationBase!);
    const linearRGBExpression = interpolationValue
      ? `${context.rootName}.svgAnimationSource(${interpolationValue}).lowercased() == "linearrgb"`
      : undefined;
    const transformAnimations = animationsForResource(
      server.animationTargetKeys.gradientTransform,
      "gradientTransform",
    );
    const transformBase = parseAnimationValue(
      animationAttributeSpec("gradientTransform")!,
      server.animationBaseValues.gradientTransform ?? "matrix(1 0 0 1 0 0)",
      valueContextForGradient,
    );
    const transformValue = animatedValueExpressionFromAnimations(transformAnimations, transformBase!);
    let matrixExpression: string | undefined;
    if (transformValue) {
      const transform = server.transform;
      const determinant = transform.a * transform.d - transform.b * transform.c;
      if (Math.abs(determinant) > 1e-12) {
        const inverse = {
          a: transform.d / determinant,
          b: -transform.b / determinant,
          c: -transform.c / determinant,
          d: transform.a / determinant,
          e: (transform.c * transform.f - transform.d * transform.e) / determinant,
          f: (transform.b * transform.e - transform.a * transform.f) / determinant,
        };
        const prefix = multiplyTransforms(gradient.matrix, inverse);
        matrixExpression = `${context.rootName}.svgOutputTransform(${context.rootName}.svgMultiplyTransform(${swiftTransform(prefix)}, ${context.rootName}.svgAnimationTransform(${transformValue})), size: size, coordinateSpace: CGRect(x: ${formatNumber(context.coordinateSpace.x)}, y: ${formatNumber(context.coordinateSpace.y)}, width: ${formatNumber(context.coordinateSpace.width)}, height: ${formatNumber(context.coordinateSpace.height)}))`;
      }
    }
    return {
      ...(Object.keys(coordinateExpressions).length > 0 ? { coordinateExpressions } : {}),
      ...(matrixExpression ? { matrixExpression } : {}),
      ...(spreadExpression ? { spreadExpression } : {}),
      ...(linearRGBExpression ? { linearRGBExpression } : {}),
    };
  };

  const animatedPatternExpressions = (pattern: ResolvedPattern, node: RenderNode) => {
    const server = pattern.server;
    const patternContext = {
      ...valueContext(node),
      length: {
        ...valueContext(node).length,
        ...(server.units === "objectBoundingBox"
          ? { viewport: { width: 1, height: 1 }, rootViewport: { width: 1, height: 1 } }
          : {}),
      },
    };
    const coordinateExpressions: Record<string, string> = {};
    let rangeFactorX = 1;
    let rangeFactorY = 1;
    for (const name of ["x", "y", "width", "height"] as const) {
      const animations = animationsForResource(server.animationTargetKeys[name], name);
      if (animations.length === 0) continue;
      const baseSource = server.animationBaseValues[name] ?? String(pattern.tile[name]);
      const base = parseAnimationValue(animationAttributeSpec(name)!, baseSource, patternContext);
      const expression = base ? animatedValueExpressionFromAnimations(animations, base) : undefined;
      if (expression) coordinateExpressions[name] = `${context.rootName}.svgAnimationNumber(${expression})`;
      if (name === "width" || name === "height") {
        const staticExtent = pattern.tile[name];
        const candidates = animations.flatMap((animation) => {
          if (animation.value.family === "unsupported") return [];
          return [
            animation.value.base,
            animation.value.from,
            animation.value.to,
            animation.value.by,
            ...(animation.value.values ?? []),
          ].flatMap((value) =>
            value && "value" in value && typeof value.value === "number" && value.value > 1e-9 ? [value.value] : [],
          );
        });
        const minimum = Math.min(staticExtent, ...candidates);
        if (minimum > 1e-9) {
          const factor = Math.ceil(staticExtent / minimum);
          if (name === "width") rangeFactorX = Math.max(rangeFactorX, factor);
          else rangeFactorY = Math.max(rangeFactorY, factor);
        }
      }
    }
    const transformAnimations = animationsForResource(server.animationTargetKeys.patternTransform, "patternTransform");
    const transformBase = parseAnimationValue(
      animationAttributeSpec("patternTransform")!,
      server.animationBaseValues.patternTransform ?? "matrix(1 0 0 1 0 0)",
      patternContext,
    );
    const transformValue = transformBase
      ? animatedValueExpressionFromAnimations(transformAnimations, transformBase)
      : undefined;
    let transformCorrection: string | undefined;
    if (transformValue) {
      const transform = server.transform;
      const determinant = transform.a * transform.d - transform.b * transform.c;
      if (Math.abs(determinant) > 1e-12) {
        const inverse = {
          a: transform.d / determinant,
          b: -transform.b / determinant,
          c: -transform.c / determinant,
          d: transform.a / determinant,
          e: (transform.c * transform.f - transform.d * transform.e) / determinant,
          f: (transform.b * transform.e - transform.a * transform.f) / determinant,
        };
        const prefix = multiplyTransforms(pattern.matrix, inverse);
        const coordinateSpace = `CGRect(x: ${formatNumber(context.coordinateSpace.x)}, y: ${formatNumber(context.coordinateSpace.y)}, width: ${formatNumber(context.coordinateSpace.width)}, height: ${formatNumber(context.coordinateSpace.height)})`;
        const animatedOutput = `${context.rootName}.svgOutputTransform(${context.rootName}.svgMultiplyTransform(${swiftTransform(prefix)}, ${context.rootName}.svgAnimationTransform(${transformValue})), size: size, coordinateSpace: ${coordinateSpace})`;
        const staticOutput = `${context.rootName}.svgOutputTransform(${swiftTransform(pattern.matrix)}, size: size, coordinateSpace: ${coordinateSpace})`;
        transformCorrection = `${context.rootName}.svgMultiplyTransform(${animatedOutput}, ${staticOutput}.inverted())`;
      }
    }
    return {
      ...(Object.keys(coordinateExpressions).length > 0 ? { coordinateExpressions } : {}),
      ...(rangeFactorX > 1 ? { rangeFactorX } : {}),
      ...(rangeFactorY > 1 ? { rangeFactorY } : {}),
      ...(transformCorrection ? { transformCorrection } : {}),
    };
  };

  const animatedMarkerBase = (node: RenderNode): string | undefined => {
    if (node.type !== "group" || !node.markerPlacement?.resource) return undefined;
    const placement = node.markerPlacement;
    const resource = placement.resource!;
    const value = (name: "orient" | "markerUnits") => {
      const animations = animationsForResource(resource.animationTargetKeys[name], name);
      if (animations.length === 0) return undefined;
      const spec = resolveAnimationAttributeForTarget(name, "auto", "marker");
      const base = spec
        ? parseAnimationValue(spec, resource.animationBaseValues[name]!, valueContext(node))
        : undefined;
      return base ? animatedValueExpressionFromAnimations(animations, base) : undefined;
    };
    const orient = value("orient");
    const units = value("markerUnits");
    if (!orient && !units) return undefined;
    const hostAngle = placement.hostAngle ?? placement.angle;
    const orientSource = orient ? `${context.rootName}.svgAnimationSource(${orient})` : swiftString("");
    const angle = orient
      ? `(${orientSource} == "auto" ? ${formatNumber(hostAngle)} : (${orientSource} == "auto-start-reverse" ? ${formatNumber(hostAngle + (placement.kind === "start" ? 180 : 0))} : ${context.rootName}.svgAnimationNumber(${orient})))`
      : formatNumber(placement.angle);
    const unitsSource = units ? `${context.rootName}.svgAnimationSource(${units})` : swiftString(resource.units);
    const unitScale = `(${unitsSource} == "strokeWidth" ? ${formatNumber(placement.strokeWidth ?? placement.unitScale)} : 1)`;
    const translation = `CGAffineTransform(translationX: ${formatNumber(placement.x)}, y: ${formatNumber(placement.y)})`;
    const rotation = `CGAffineTransform(rotationAngle: (${angle}) * .pi / 180)`;
    const scaling = `CGAffineTransform(scaleX: ${unitScale}, y: ${unitScale})`;
    const reference = `CGAffineTransform(translationX: ${formatNumber(-placement.refX)}, y: ${formatNumber(-placement.refY)})`;
    return `${context.rootName}.svgMultiplyTransform(${translation}, ${context.rootName}.svgMultiplyTransform(${rotation}, ${context.rootName}.svgMultiplyTransform(${scaling}, ${context.rootName}.svgMultiplyTransform(${reference}, ${swiftTransform(placement.viewBoxTransform)}))))`;
  };

  const presentationCondition = (node: RenderNode): string | undefined => {
    const display = animatedDiscrete(node, "display", node.style.display);
    const visibility = animatedDiscrete(node, "visibility", node.style.visibility);
    const conditions = [
      ...(display ? [`${display} != "none"`] : []),
      ...(visibility ? [`${visibility} != "hidden" && ${visibility} != "collapse"`] : []),
      ...context.document.animationProgram.animations
        .filter(
          (animation) =>
            animation.kind === "discard" &&
            animation.runtimeSupport === "typed" &&
            animation.target?.key === node.animationTargetKey,
        )
        .map(
          (animation) =>
            `!${context.rootName}.svgIsDiscarded(documentTime: documentTime, intervals: ${intervalLiteral(animation)})`,
        ),
    ];
    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  };

  const interaction = (
    node: RenderNode,
  ): { targetId: string; events: readonly string[]; pointerEvents: string } | undefined => {
    const identifiers = [node.source.id, node.animationTargetKey].filter((value): value is string => !!value);
    for (const targetId of identifiers) {
      const events = context.eventTargets.get(targetId);
      if (events?.length)
        return {
          targetId,
          events,
          pointerEvents: String(node.style.presentation["pointer-events"] ?? "visiblePainted"),
        };
    }
    return undefined;
  };

  const opacityExpression = (node: RenderNode): number | string =>
    animatedNumber(node, "opacity", node.style.opacity) ?? node.style.opacity;

  const animationOffset = (
    node: RenderNode,
    attributeNames: readonly string[],
    sources: readonly (string | number | undefined)[],
  ): string | undefined => {
    const offsets = attributeNames.flatMap((attributeName, index) => {
      const source = sources[index];
      if (source === undefined) return [];
      const expression = animatedNumber(node, attributeName, source);
      const base = numericBase(node, attributeName, source);
      return expression && base && "value" in base && typeof base.value === "number"
        ? [`(${expression} - ${formatNumber(base.value)})`]
        : [];
    });
    return offsets.length === 0 ? undefined : offsets.join(" + ");
  };

  const normalizedX = (expression: string) =>
    `(((${expression}) - ${formatNumber(context.options.viewBox.x)}) / ${formatNumber(context.options.viewBox.width)} * width)`;
  const normalizedY = (expression: string) =>
    `(((${expression}) - ${formatNumber(context.options.viewBox.y)}) / ${formatNumber(context.options.viewBox.height)} * height)`;
  const normalizedWidth = (expression: string) =>
    `((${expression}) / ${formatNumber(context.options.viewBox.width)} * width)`;
  const normalizedHeight = (expression: string) =>
    `((${expression}) / ${formatNumber(context.options.viewBox.height)} * height)`;

  const pathValueCandidates = (node: RenderNode, attributeName: string, base: TypedAnimationValue) => {
    const candidates: TypedAnimationValue[] = [base];
    for (const animation of animationsFor(node, attributeName)) {
      if (animation.value.family === "unsupported") continue;
      for (const value of [
        animation.value.base,
        animation.value.from,
        animation.value.to,
        animation.value.by,
        ...(animation.value.values ?? []),
      ])
        if (value) candidates.push(value);
    }
    return candidates.filter(
      (value, index) =>
        candidates.findIndex(
          (candidate) =>
            candidate.family === value.family &&
            swiftAnimationValueLiteral(candidate) === swiftAnimationValueLiteral(value),
        ) === index,
    );
  };

  const dynamicGeometryLines = (node: RenderShape): string[] | undefined => {
    const declarations: string[] = [];
    const scalars = new Map<string, string>();
    const scalar = (name: string, base: number) => {
      const cached = scalars.get(name);
      if (cached) return cached;
      const animatedValue = animatedNumber(node, name, base);
      if (!animatedValue) return formatNumber(base);
      const variable = `svg${name.replace(/(^|-)([a-z])/g, (_match, _prefix, letter: string) => letter.toUpperCase())}`;
      declarations.push(`let ${variable} = ${animatedValue}`);
      scalars.set(name, variable);
      return variable;
    };
    const animated = (names: readonly string[]) => names.some((name) => animationsFor(node, name).length > 0);
    switch (node.geometry.type) {
      case "circle": {
        if (!animated(["cx", "cy", "r"])) return undefined;
        const cx = scalar("cx", node.geometry.cx);
        const cy = scalar("cy", node.geometry.cy);
        const radius = scalar("r", node.geometry.r);
        return [
          ...declarations,
          `path.addEllipse(in: CGRect(x: ${normalizedX(`(${cx}) - (${radius})`)}, y: ${normalizedY(`(${cy}) - (${radius})`)}, width: ${normalizedWidth(`2 * (${radius})`)}, height: ${normalizedHeight(`2 * (${radius})`)}))`,
        ];
      }
      case "ellipse": {
        if (!animated(["cx", "cy", "rx", "ry"])) return undefined;
        const cx = scalar("cx", node.geometry.cx);
        const cy = scalar("cy", node.geometry.cy);
        const authoredRx = node.geometryAuthored?.rx;
        const authoredRy = node.geometryAuthored?.ry;
        let rx = scalar("rx", node.geometry.rx);
        let ry = scalar("ry", node.geometry.ry);
        if (
          (authoredRy === undefined || String(authoredRy).toLowerCase() === "auto") &&
          animationsFor(node, "rx").length
        )
          ry = rx;
        if (
          (authoredRx === undefined || String(authoredRx).toLowerCase() === "auto") &&
          animationsFor(node, "ry").length
        )
          rx = ry;
        return [
          ...declarations,
          `path.addEllipse(in: CGRect(x: ${normalizedX(`(${cx}) - (${rx})`)}, y: ${normalizedY(`(${cy}) - (${ry})`)}, width: ${normalizedWidth(`2 * (${rx})`)}, height: ${normalizedHeight(`2 * (${ry})`)}))`,
        ];
      }
      case "rect": {
        if (!animated(["x", "y", "width", "height", "rx", "ry"])) return undefined;
        const x = scalar("x", node.geometry.x);
        const y = scalar("y", node.geometry.y);
        const widthValue = scalar("width", node.geometry.width);
        const heightValue = scalar("height", node.geometry.height);
        const rxBase = node.geometry.rx ?? node.geometry.ry ?? 0;
        const ryBase = node.geometry.ry ?? node.geometry.rx ?? 0;
        const authoredRx = node.geometryAuthored?.rx;
        const authoredRy = node.geometryAuthored?.ry;
        let rx = scalar("rx", rxBase);
        let ry = scalar("ry", ryBase);
        if (
          (authoredRy === undefined || String(authoredRy).toLowerCase() === "auto") &&
          animationsFor(node, "rx").length
        )
          ry = rx;
        if (
          (authoredRx === undefined || String(authoredRx).toLowerCase() === "auto") &&
          animationsFor(node, "ry").length
        )
          rx = ry;
        const rect = `CGRect(x: ${normalizedX(x)}, y: ${normalizedY(y)}, width: ${normalizedWidth(widthValue)}, height: ${normalizedHeight(heightValue)})`;
        return node.geometry.rx !== undefined || node.geometry.ry !== undefined || animated(["rx", "ry"])
          ? [
              ...declarations,
              `path.addRoundedRect(in: ${rect}, cornerSize: CGSize(width: ${normalizedWidth(`min(abs(${rx}), (${widthValue}) / 2)`)}, height: ${normalizedHeight(`min(abs(${ry}), (${heightValue}) / 2)`)}))`,
            ]
          : [...declarations, `path.addRect(${rect})`];
      }
      case "line": {
        if (!animated(["x1", "y1", "x2", "y2"])) return undefined;
        const x1 = scalar("x1", node.geometry.x1);
        const y1 = scalar("y1", node.geometry.y1);
        const x2 = scalar("x2", node.geometry.x2);
        const y2 = scalar("y2", node.geometry.y2);
        return [
          ...declarations,
          `path.move(to: CGPoint(x: ${normalizedX(x1)}, y: ${normalizedY(y1)}))`,
          `path.addLine(to: CGPoint(x: ${normalizedX(x2)}, y: ${normalizedY(y2)}))`,
        ];
      }
      case "polyline":
      case "polygon": {
        if (!animated(["points"])) return undefined;
        const spec = animationAttributeSpec("points")!;
        const base = parseAnimationValue(spec, node.geometry.points, valueContext(node));
        if (!base || base.family !== "points") return undefined;
        const expression = animatedValueExpression(node, "points", base);
        if (!expression) return undefined;
        const candidates = pathValueCandidates(node, "points", base).filter(
          (candidate): candidate is Extract<TypedAnimationValue, { family: "points" }> => candidate.family === "points",
        );
        const counts = [...new Set(candidates.map((candidate) => candidate.points.length))];
        const lines = [
          `let svgGeometry = ${expression}`,
          "var animatedPath = Path()",
          "switch svgGeometry.components.count / 2 {",
        ];
        for (const count of counts) {
          lines.push(`case ${count}:`);
          for (let index = 0; index < count; index++) {
            const command = index === 0 ? "move" : "addLine";
            lines.push(
              `animatedPath.${command}(to: CGPoint(x: ${normalizedX(`svgGeometry.components[${index * 2}]`)}, y: ${normalizedY(`svgGeometry.components[${index * 2 + 1}]`)}))`,
            );
          }
          if (node.geometry.type === "polygon") lines.push("animatedPath.closeSubpath()");
        }
        lines.push("default: break", "}", "path.addPath(animatedPath)");
        return lines;
      }
      case "path": {
        if (!animated(["d"])) return undefined;
        const spec = animationAttributeSpec("d")!;
        const base = parseAnimationValue(spec, node.geometry.d, valueContext(node));
        if (!base || base.family !== "path") return undefined;
        const expression = animatedValueExpression(node, "d", base);
        if (!expression) return undefined;
        const candidates = pathValueCandidates(node, "d", base).filter(
          (candidate): candidate is Extract<TypedAnimationValue, { family: "path" }> => candidate.family === "path",
        );
        const signatures = new Map<string, Extract<TypedAnimationValue, { family: "path" }>>();
        for (const candidate of candidates) {
          const signature = candidate.commands.map((command) => `${command.kind}${command.values.length}`).join(";");
          signatures.set(signature, candidate);
        }
        const lines = [
          `let svgGeometry = ${expression}`,
          "var animatedPath = Path()",
          "switch svgGeometry.signature {",
        ];
        for (const [signature, candidate] of signatures) {
          lines.push(`case ${swiftString(signature)}:`);
          let component = 0;
          for (const command of candidate.commands) {
            const value = (offset: number) => `svgGeometry.components[${component + offset}]`;
            if (command.kind === "M")
              lines.push(`animatedPath.move(to: CGPoint(x: ${normalizedX(value(0))}, y: ${normalizedY(value(1))}))`);
            else if (command.kind === "L")
              lines.push(`animatedPath.addLine(to: CGPoint(x: ${normalizedX(value(0))}, y: ${normalizedY(value(1))}))`);
            else if (command.kind === "Q")
              lines.push(
                `animatedPath.addQuadCurve(to: CGPoint(x: ${normalizedX(value(2))}, y: ${normalizedY(value(3))}), control: CGPoint(x: ${normalizedX(value(0))}, y: ${normalizedY(value(1))}))`,
              );
            else if (command.kind === "C")
              lines.push(
                `animatedPath.addCurve(to: CGPoint(x: ${normalizedX(value(4))}, y: ${normalizedY(value(5))}), control1: CGPoint(x: ${normalizedX(value(0))}, y: ${normalizedY(value(1))}), control2: CGPoint(x: ${normalizedX(value(2))}, y: ${normalizedY(value(3))}))`,
              );
            else lines.push("animatedPath.closeSubpath()");
            component += command.values.length;
          }
        }
        lines.push("default: break", "}", "path.addPath(animatedPath)");
        return lines;
      }
    }
  };

  const dynamicStrokeLines = (node: RenderShape, centerline: string[]): string[] => {
    const style = node.style.strokeStyle;
    const number = (name: string, base: number) => animatedNumber(node, name, base) ?? formatNumber(base);
    const discrete = (name: string, base: string) => animatedDiscrete(node, name, base);
    const width = normalizedWidth(number("stroke-width", style.width));
    const lineCap = discrete("stroke-linecap", style.lineCap);
    const lineJoin = discrete("stroke-linejoin", style.lineJoin);
    const dashSpec = animationAttributeSpec("stroke-dasharray")!;
    const dashBase = style.dashArray
      ? parseAnimationValue(dashSpec, style.dashArray.join(" "), valueContext(node))
      : undefined;
    const dashValue = dashBase ? animatedValueExpression(node, "stroke-dasharray", dashBase) : undefined;
    const dash = dashValue
      ? `${context.rootName}.svgAnimationLengths(${dashValue}, scale: width / ${formatNumber(context.options.viewBox.width)})`
      : style.dashArray
        ? `[${style.dashArray.map((value) => normalizedWidth(formatNumber(value))).join(", ")}]`
        : "[]";
    const phase = normalizedWidth(number("stroke-dashoffset", style.dashOffset));
    const cap = lineCap ? `${context.rootName}.svgStrokeLineCap(${lineCap})` : `.${style.lineCap}`;
    const join = lineJoin ? `${context.rootName}.svgStrokeLineJoin(${lineJoin})` : `.${style.lineJoin}`;
    return [
      "var animatedStroke = Path()",
      ...centerline.map((line) => line.replace(/^path\./, "animatedStroke.")),
      `path.addPath(animatedStroke.strokedPath(StrokeStyle(lineWidth: ${width}, lineCap: ${cap}, lineJoin: ${join}, miterLimit: ${number("stroke-miterlimit", style.miterLimit)}, dash: ${dash}, dashPhase: ${phase})))`,
    ];
  };

  const dynamicShapeLines = (
    node: RenderShape,
    kind: "fill" | "stroke",
    ancestorTransforms: RenderNode["transform"][],
  ): string[] | undefined => {
    const geometry = dynamicGeometryLines(node);
    const strokeAnimated =
      kind === "stroke" &&
      [
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-miterlimit",
        "stroke-dasharray",
        "stroke-dashoffset",
      ].some((name) => animationsFor(node, name).length > 0);
    if (!geometry && !strokeAnimated) return undefined;
    let lines =
      geometry ??
      renderShape({ ...node, transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, context.options, {
        fill: "black",
        stroke: "none",
      });
    const nonScaling = kind === "stroke" && node.style.strokeStyle.vectorEffect === "non-scaling-stroke";
    if (kind === "stroke" && nonScaling) {
      lines = wrapWithTransform(
        lines,
        [...ancestorTransforms, node.transform].reduce(multiplyTransforms),
        context.options,
      );
      return dynamicStrokeLines(node, lines);
    }
    if (kind === "stroke") lines = dynamicStrokeLines(node, lines);
    lines = wrapWithTransform(lines, node.transform, context.options);
    for (let index = ancestorTransforms.length - 1; index >= 0; index--)
      lines = wrapWithTransform(lines, ancestorTransforms[index]!, context.options);
    return lines;
  };

  const buildFilter = (
    filter: FilterInstance | undefined,
    targetTransforms: RenderNode["transform"][],
    targetNode: RenderNode,
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
    const zScale = Math.sqrt(Math.abs(transform.a * transform.d - transform.b * transform.c));
    const transformLight = (light: FilterLightSource | undefined): FilterLightSource | undefined => {
      if (!light) return undefined;
      if (light.type === "distant")
        return {
          type: "distant",
          ...(light.animationTargetKey ? { animationTargetKey: light.animationTargetKey } : {}),
          ...(light.animationTargetTag ? { animationTargetTag: light.animationTargetTag } : {}),
          ...(light.animationBaseValues ? { animationBaseValues: light.animationBaseValues } : {}),
          x: transform.a * light.x + transform.c * light.y,
          y: transform.b * light.x + transform.d * light.y,
          z: light.z * zScale,
        };
      const position = {
        ...(light.animationTargetKey ? { animationTargetKey: light.animationTargetKey } : {}),
        ...(light.animationTargetTag ? { animationTargetTag: light.animationTargetTag } : {}),
        ...(light.animationBaseValues ? { animationBaseValues: light.animationBaseValues } : {}),
        x: transform.a * light.x + transform.c * light.y + transform.e,
        y: transform.b * light.x + transform.d * light.y + transform.f,
        z: light.z * zScale,
      };
      if (light.type === "point") return { type: "point", ...position };
      return {
        type: "spot",
        ...position,
        pointsAtX: transform.a * light.pointsAtX + transform.c * light.pointsAtY + transform.e,
        pointsAtY: transform.b * light.pointsAtX + transform.d * light.pointsAtY + transform.f,
        pointsAtZ: light.pointsAtZ * zScale,
        specularExponent: light.specularExponent,
        ...(light.limitingConeAngle === undefined ? {} : { limitingConeAngle: light.limitingConeAngle }),
      };
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
      if (primitive.type === "diffuseLighting" || primitive.type === "specularLighting")
        return {
          ...primitive,
          subregion,
          surfaceScale: primitive.surfaceScale * zScale,
          ...(primitive.kernelUnitLengthX === undefined
            ? {}
            : {
                kernelUnitLengthX: Math.hypot(
                  transform.a * primitive.kernelUnitLengthX,
                  transform.b * primitive.kernelUnitLengthX,
                ),
                kernelUnitLengthY: Math.hypot(
                  transform.c * primitive.kernelUnitLengthY!,
                  transform.d * primitive.kernelUnitLengthY!,
                ),
              }),
          light: transformLight(primitive.light),
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
    let regionExpression: string | undefined;
    const resource = filter.resource;
    if (resource) {
      const bounds = objectBoundingBox(targetNode);
      const filterContext = {
        ...valueContext(targetNode),
        length: {
          ...valueContext(targetNode).length,
          ...(resource.units === "objectBoundingBox"
            ? { viewport: { width: 1, height: 1 }, rootViewport: { width: 1, height: 1 } }
            : {}),
        },
      };
      const animatedCoordinate = (name: "x" | "y" | "width" | "height") => {
        const key = resource.animationTargetKeys[name];
        const animations = animationsForResource(key, name);
        if (animations.length === 0) return undefined;
        const spec = animationAttributeSpec(name)!;
        const base = parseAnimationValue(spec, resource.animationBaseValues[name]!, filterContext);
        const value = base ? animatedValueExpressionFromAnimations(animations, base) : undefined;
        if (!value) return undefined;
        const number = `${context.rootName}.svgAnimationNumber(${value})`;
        if (resource.units !== "objectBoundingBox" || !bounds) return number;
        const extent = name === "x" || name === "width" ? bounds.width : bounds.height;
        if (name === "width" || name === "height") return `(${number} * ${formatNumber(extent)})`;
        const origin = name === "x" ? bounds.x : bounds.y;
        return `(${formatNumber(origin)} + ${number} * ${formatNumber(extent)})`;
      };
      const x = animatedCoordinate("x");
      const y = animatedCoordinate("y");
      const width = animatedCoordinate("width");
      const height = animatedCoordinate("height");
      if (x || y || width || height)
        regionExpression = `${context.rootName}.svgTransformedFilterRegion(x: ${x ?? formatNumber(filter.region.x)}, y: ${y ?? formatNumber(filter.region.y)}, width: ${width ?? formatNumber(filter.region.width)}, height: ${height ?? formatNumber(filter.region.height)}, transform: ${swiftTransform(transform)})`;
    }
    const animatedFilterTargetValue = (
      key: string | undefined,
      attributeName: string,
      baseValue: string,
      targetTagName?: string,
    ): string | undefined => {
      const animations = animationsForResource(key, attributeName);
      const spec = targetTagName
        ? resolveAnimationAttributeForTarget(attributeName, "auto", targetTagName)
        : animationAttributeSpec(attributeName);
      const base = spec ? parseAnimationValue(spec, baseValue, valueContext(targetNode)) : undefined;
      return base ? animatedValueExpressionFromAnimations(animations, base) : undefined;
    };
    const animatedFilterValue = (primitive: FilterPrimitive, attributeName: string, baseValue: string) =>
      animatedFilterTargetValue(primitive.animationTargetKey, attributeName, baseValue, primitive.source.element);
    const component = (expression: string, index: number) =>
      `${context.rootName}.svgAnimationComponent(${expression}, index: ${index})`;
    const primitiveOverrides = filter.primitives.map((source, index): Readonly<Record<string, string>> => {
      const output = instance.primitives[index]!;
      const overrides: Record<string, string> = {};
      const scaleX = source.animationScaleX || 1;
      const scaleY = source.animationScaleY || 1;
      const pair = (attributeName: string, x: number, y: number) =>
        animatedFilterValue(source, attributeName, `${formatNumber(x)} ${formatNumber(y)}`);
      const discrete = (attributeName: string, baseValue: string) => {
        const expression = animatedFilterValue(source, attributeName, baseValue);
        return expression ? `${context.rootName}.svgAnimationSource(${expression})` : undefined;
      };
      const enumExpression = (value: string, cases: Readonly<Record<string, string>>, fallback: string) =>
        Object.entries(cases).reduceRight(
          (result, [sourceValue, swiftValue]) =>
            `(${value} == ${swiftString(sourceValue)} ? ${swiftValue} : ${result})`,
          fallback,
        );
      const inputExpression = (attributeName: "in" | "in2", fallback: FilterInput) => {
        const baseValue =
          source.animationBaseValues?.[attributeName] ??
          (fallback.type === "result"
            ? (filter.primitives[fallback.index]?.result ?? "SourceGraphic")
            : {
                sourceGraphic: "SourceGraphic",
                sourceAlpha: "SourceAlpha",
                backgroundImage: "BackgroundImage",
                backgroundAlpha: "BackgroundAlpha",
                fillPaint: "FillPaint",
                strokePaint: "StrokePaint",
              }[fallback.type]);
        const animated = discrete(attributeName, baseValue);
        if (!animated) return undefined;
        const cases: Record<string, string> = {
          SourceGraphic: ".sourceGraphic",
          SourceAlpha: ".sourceAlpha",
          BackgroundImage: ".backgroundImage",
          BackgroundAlpha: ".backgroundAlpha",
          FillPaint: ".fillPaint",
          StrokePaint: ".strokePaint",
        };
        for (let previous = 0; previous < index; previous++) {
          const name = filter.primitives[previous]?.result;
          if (name) cases[name] = `.result(${previous})`;
        }
        return enumExpression(animated, cases, filterInputLiteral(fallback));
      };
      if ("input" in source) {
        const input = inputExpression("in", source.input);
        if (input) overrides.input = input;
      }
      if (source.input2) {
        const input2 = inputExpression("in2", source.input2);
        if (input2) overrides.input2 = input2;
      }
      const primitiveUnits = filter.resource?.primitiveUnits ?? "userSpaceOnUse";
      const targetBounds = objectBoundingBox(targetNode);
      const regionContext = {
        ...valueContext(targetNode),
        length: {
          ...valueContext(targetNode).length,
          ...(primitiveUnits === "objectBoundingBox"
            ? { viewport: { width: 1, height: 1 }, rootViewport: { width: 1, height: 1 } }
            : {}),
        },
      };
      const regionCoordinate = (name: "x" | "y" | "width" | "height") => {
        const animations = animationsForResource(source.animationTargetKey, name);
        if (animations.length === 0) return undefined;
        const axisScale = name === "x" || name === "width" ? scaleX : scaleY;
        const origin = name === "x" ? (targetBounds?.x ?? 0) : name === "y" ? (targetBounds?.y ?? 0) : 0;
        const resolved =
          name === "x"
            ? source.subregion.x
            : name === "y"
              ? source.subregion.y
              : name === "width"
                ? source.subregion.width
                : source.subregion.height;
        const computedBase =
          primitiveUnits === "objectBoundingBox" && axisScale !== 0 ? (resolved - origin) / axisScale : resolved;
        const baseSource = source.animationBaseValues?.[name] ?? formatNumber(computedBase);
        const spec = animationAttributeSpec(name)!;
        const base = parseAnimationValue(spec, baseSource, regionContext);
        const expression = base ? animatedValueExpressionFromAnimations(animations, base) : undefined;
        if (!expression) return undefined;
        const number = `${context.rootName}.svgAnimationNumber(${expression})`;
        if (primitiveUnits !== "objectBoundingBox") return number;
        if (name === "width" || name === "height") return `(${number} * ${formatNumber(axisScale)})`;
        return `(${formatNumber(origin)} + ${number} * ${formatNumber(axisScale)})`;
      };
      const regionX = regionCoordinate("x");
      const regionY = regionCoordinate("y");
      const regionWidth = regionCoordinate("width");
      const regionHeight = regionCoordinate("height");
      if (regionX || regionY || regionWidth || regionHeight)
        overrides.region = `${context.rootName}.svgTransformedFilterRegion(x: ${regionX ?? formatNumber(source.subregion.x)}, y: ${regionY ?? formatNumber(source.subregion.y)}, width: ${regionWidth ?? formatNumber(source.subregion.width)}, height: ${regionHeight ?? formatNumber(source.subregion.height)}, transform: ${swiftTransform(transform)})`;
      const interpolation = discrete("color-interpolation-filters", source.colorInterpolation);
      if (interpolation) overrides.linearRGB = `${interpolation}.lowercased() == "linearrgb"`;
      if (source.type === "blend") {
        const mode = discrete("mode", source.mode);
        if (mode)
          overrides.mode = enumExpression(
            mode,
            Object.fromEntries(
              [
                "normal",
                "multiply",
                "screen",
                "overlay",
                "darken",
                "lighten",
                "color-dodge",
                "color-burn",
                "hard-light",
                "soft-light",
                "difference",
                "exclusion",
                "hue",
                "saturation",
                "color",
                "luminosity",
              ].map((name) => [name, `.${name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`]),
            ),
            ".normal",
          );
      }
      if (source.type === "gaussianBlur" || source.type === "dropShadow") {
        const expression = pair("stdDeviation", source.stdDeviationX / scaleX, source.stdDeviationY / scaleY);
        if (expression) {
          const x = `(${component(expression, 0)} * ${formatNumber(scaleX)})`;
          const y = `(${component(expression, 1)} * ${formatNumber(scaleY)})`;
          overrides.stdDeviationX = `hypot(${formatNumber(transform.a)} * ${x}, ${formatNumber(transform.c)} * ${y})`;
          overrides.stdDeviationY = `hypot(${formatNumber(transform.b)} * ${x}, ${formatNumber(transform.d)} * ${y})`;
        }
      }
      if (source.type === "offset" || source.type === "dropShadow") {
        const dxExpression = animatedFilterValue(source, "dx", formatNumber(source.dx / scaleX));
        const dyExpression = animatedFilterValue(source, "dy", formatNumber(source.dy / scaleY));
        if (dxExpression || dyExpression) {
          const x = dxExpression
            ? `(${context.rootName}.svgAnimationNumber(${dxExpression}) * ${formatNumber(scaleX)})`
            : formatNumber(source.dx);
          const y = dyExpression
            ? `(${context.rootName}.svgAnimationNumber(${dyExpression}) * ${formatNumber(scaleY)})`
            : formatNumber(source.dy);
          overrides.dx = `${formatNumber(transform.a)} * ${x} + ${formatNumber(transform.c)} * ${y}`;
          overrides.dy = `${formatNumber(transform.b)} * ${x} + ${formatNumber(transform.d)} * ${y}`;
        }
      }
      if (source.type === "morphology") {
        const expression = pair("radius", source.radiusX / scaleX, source.radiusY / scaleY);
        if (expression) {
          const x = `(${component(expression, 0)} * ${formatNumber(scaleX)})`;
          const y = `(${component(expression, 1)} * ${formatNumber(scaleY)})`;
          overrides.radiusX = `hypot(${formatNumber(transform.a)} * ${x}, ${formatNumber(transform.b)} * ${x})`;
          overrides.radiusY = `hypot(${formatNumber(transform.c)} * ${y}, ${formatNumber(transform.d)} * ${y})`;
        }
      }
      if (source.type === "displacementMap") {
        const authoredScale = scaleX === 0 ? 0 : source.displacement.a / scaleX;
        const expression = animatedFilterValue(source, "scale", formatNumber(authoredScale));
        if (expression) {
          const scale = `${context.rootName}.svgAnimationNumber(${expression})`;
          overrides.a = `${formatNumber(transform.a * scaleX)} * ${scale}`;
          overrides.b = `${formatNumber(transform.b * scaleX)} * ${scale}`;
          overrides.c = `${formatNumber(transform.c * scaleY)} * ${scale}`;
          overrides.d = `${formatNumber(transform.d * scaleY)} * ${scale}`;
        }
      }
      if (source.type === "composite") {
        const operator = discrete("operator", source.operator);
        if (operator)
          overrides.operator = enumExpression(
            operator,
            {
              over: ".over",
              in: ".inside",
              out: ".outside",
              atop: ".atop",
              xor: ".xor",
              lighter: ".lighter",
              arithmetic: ".arithmetic",
            },
            ".over",
          );
        for (const name of ["k1", "k2", "k3", "k4"] as const) {
          const expression = animatedFilterValue(source, name, formatNumber(source[name]));
          if (expression) overrides[name] = `${context.rootName}.svgAnimationNumber(${expression})`;
        }
      }
      if (source.type === "colorMatrix" && source.matrix.length === 20) {
        const expression = animatedFilterValue(
          source,
          "values",
          source.matrix.map((value) => formatNumber(value)).join(" "),
        );
        if (expression) overrides.values = `${expression}.components`;
      }
      if (source.type === "componentTransfer") {
        const functions = source.functions.map((fn) => {
          const functionOverrides: Record<string, string> = {};
          if (fn.type === "table" || fn.type === "discrete") {
            const expression = animatedFilterTargetValue(
              fn.animationTargetKey,
              "tableValues",
              fn.values.map((value) => formatNumber(value)).join(" "),
              fn.animationTargetTag,
            );
            if (expression) functionOverrides.tableValues = `${expression}.components`;
          } else if (fn.type === "linear") {
            for (const name of ["slope", "intercept"] as const) {
              const expression = animatedFilterTargetValue(
                fn.animationTargetKey,
                name,
                formatNumber(fn[name]),
                fn.animationTargetTag,
              );
              if (expression) functionOverrides[name] = `${context.rootName}.svgAnimationNumber(${expression})`;
            }
          } else if (fn.type === "gamma") {
            for (const name of ["amplitude", "exponent", "offset"] as const) {
              const expression = animatedFilterTargetValue(
                fn.animationTargetKey,
                name,
                formatNumber(fn[name]),
                fn.animationTargetTag,
              );
              if (expression) functionOverrides[name] = `${context.rootName}.svgAnimationNumber(${expression})`;
            }
          }
          return filterComponentFunctionLiteral(fn, functionOverrides);
        });
        if (
          functions.some(
            (literal, functionIndex) => literal !== filterComponentFunctionLiteral(source.functions[functionIndex]!),
          )
        )
          overrides.functions = `[${functions.join(", ")}]`;
      }
      if (source.type === "convolveMatrix") {
        const order = pair("order", source.orderX, source.orderY);
        if (order) {
          overrides.orderX = `Int(${component(order, 0)})`;
          overrides.orderY = `Int(${component(order, 1)})`;
        }
        const kernel = animatedFilterValue(
          source,
          "kernelMatrix",
          source.kernelMatrix.map((value) => formatNumber(value)).join(" "),
        );
        if (kernel) overrides.kernelMatrix = `${kernel}.components`;
        for (const name of ["divisor", "bias"] as const) {
          const expression = animatedFilterValue(source, name, formatNumber(source[name]));
          if (expression) overrides[name] = `${context.rootName}.svgAnimationNumber(${expression})`;
        }
        for (const name of ["targetX", "targetY"] as const) {
          const expression = animatedFilterValue(source, name, formatNumber(source[name]));
          if (expression) overrides[name] = `Int(${context.rootName}.svgAnimationNumber(${expression}))`;
        }
        if (source.kernelUnitLengthX !== undefined) {
          const expression = pair(
            "kernelUnitLength",
            source.kernelUnitLengthX / scaleX,
            source.kernelUnitLengthY! / scaleY,
          );
          if (expression) {
            const x = `(${component(expression, 0)} * ${formatNumber(scaleX)})`;
            const y = `(${component(expression, 1)} * ${formatNumber(scaleY)})`;
            overrides.kernelUnitLengthX = `hypot(${formatNumber(transform.a)} * ${x}, ${formatNumber(transform.b)} * ${x})`;
            overrides.kernelUnitLengthY = `hypot(${formatNumber(transform.c)} * ${y}, ${formatNumber(transform.d)} * ${y})`;
          }
        }
        const edge = discrete("edgeMode", source.edgeMode);
        if (edge)
          overrides.edgeMode = enumExpression(edge, { none: ".none", duplicate: ".duplicate", wrap: ".wrap" }, ".none");
        const preserve = discrete("preserveAlpha", source.preserveAlpha ? "true" : "false");
        if (preserve) overrides.preserveAlpha = `${preserve}.lowercased() == "true"`;
      }
      if (source.type === "gaussianBlur") {
        const edge = discrete("edgeMode", source.edgeMode);
        if (edge)
          overrides.edgeMode = enumExpression(edge, { none: ".none", duplicate: ".duplicate", wrap: ".wrap" }, ".none");
      }
      if (source.type === "morphology") {
        const operation = discrete("operator", source.operator);
        if (operation) overrides.operator = `(${operation} == "dilate" ? .dilate : .erode)`;
      }
      if (source.type === "displacementMap") {
        for (const [attributeName, baseValue] of [
          ["xChannelSelector", source.xChannel],
          ["yChannelSelector", source.yChannel],
        ] as const) {
          const channel = discrete(attributeName, baseValue);
          if (channel)
            overrides[attributeName] = enumExpression(
              `${channel}.uppercased()`,
              { R: ".r", G: ".g", B: ".b", A: ".a" },
              ".a",
            );
        }
      }
      if (source.type === "diffuseLighting" || source.type === "specularLighting") {
        const zScale = Math.sqrt(Math.abs(scaleX * scaleY));
        const surfaceScale = animatedFilterValue(source, "surfaceScale", formatNumber(source.surfaceScale / zScale));
        if (surfaceScale)
          overrides.surfaceScale = `${formatNumber(zScale * Math.sqrt(Math.abs(transform.a * transform.d - transform.b * transform.c)))} * ${context.rootName}.svgAnimationNumber(${surfaceScale})`;
        const constantName = source.type === "diffuseLighting" ? "diffuseConstant" : "specularConstant";
        const constant = animatedFilterValue(source, constantName, formatNumber(source[constantName]));
        if (constant) overrides[constantName] = `${context.rootName}.svgAnimationNumber(${constant})`;
        if (source.type === "specularLighting") {
          const exponent = animatedFilterValue(source, "specularExponent", formatNumber(source.specularExponent));
          if (exponent) overrides.specularExponent = `${context.rootName}.svgAnimationNumber(${exponent})`;
        }
        const light = source.light;
        if (light?.animationTargetKey && light.animationBaseValues) {
          let animated = false;
          const number = (name: string) => {
            const base = light.animationBaseValues?.[name] ?? 0;
            const expression = animatedFilterTargetValue(
              light.animationTargetKey,
              name,
              formatNumber(base),
              light.animationTargetTag,
            );
            if (expression) animated = true;
            return expression ? `${context.rootName}.svgAnimationNumber(${expression})` : formatNumber(base);
          };
          const determinantScale = Math.sqrt(Math.abs(transform.a * transform.d - transform.b * transform.c));
          if (light.type === "distant") {
            const azimuth = `(${number("azimuth")} * .pi / 180)`;
            const elevation = `(${number("elevation")} * .pi / 180)`;
            const x = `(cos(${azimuth}) * cos(${elevation}) * ${formatNumber(scaleX)})`;
            const y = `(sin(${azimuth}) * cos(${elevation}) * ${formatNumber(scaleY)})`;
            const z = `(sin(${elevation}) * ${formatNumber(determinantScale)})`;
            if (animated)
              overrides.light = `.distant(x: ${formatNumber(transform.a)} * ${x} + ${formatNumber(transform.c)} * ${y}, y: ${formatNumber(transform.b)} * ${x} + ${formatNumber(transform.d)} * ${y}, z: ${z})`;
          } else {
            const adjusted = (name: "x" | "y" | "z" | "pointsAtX" | "pointsAtY" | "pointsAtZ") => {
              const staticValue = light[name];
              const base = light.animationBaseValues?.[name] ?? 0;
              const axisScale =
                name === "x" || name === "pointsAtX" ? scaleX : name === "y" || name === "pointsAtY" ? scaleY : 1;
              return `(${formatNumber(staticValue)} + (${number(name)} - ${formatNumber(base)}) * ${formatNumber(axisScale)})`;
            };
            const x = adjusted("x");
            const y = adjusted("y");
            const z = adjusted("z");
            const outputX = `${formatNumber(transform.a)} * ${x} + ${formatNumber(transform.c)} * ${y} + ${formatNumber(transform.e)}`;
            const outputY = `${formatNumber(transform.b)} * ${x} + ${formatNumber(transform.d)} * ${y} + ${formatNumber(transform.f)}`;
            const outputZ = `${formatNumber(determinantScale)} * ${z}`;
            if (light.type === "point") {
              if (animated) overrides.light = `.point(x: ${outputX}, y: ${outputY}, z: ${outputZ})`;
            } else {
              const pointX = adjusted("pointsAtX");
              const pointY = adjusted("pointsAtY");
              const pointZ = adjusted("pointsAtZ");
              const exponent = number("specularExponent");
              const cone = light.limitingConeAngle === undefined ? "nil" : number("limitingConeAngle");
              if (animated)
                overrides.light = `.spot(x: ${outputX}, y: ${outputY}, z: ${outputZ}, pointsAtX: ${formatNumber(transform.a)} * ${pointX} + ${formatNumber(transform.c)} * ${pointY} + ${formatNumber(transform.e)}, pointsAtY: ${formatNumber(transform.b)} * ${pointX} + ${formatNumber(transform.d)} * ${pointY} + ${formatNumber(transform.f)}, pointsAtZ: ${formatNumber(determinantScale)} * ${pointZ}, exponent: ${exponent}, coneAngle: ${cone})`;
            }
          }
        }
      }
      if (
        source.type === "flood" ||
        source.type === "dropShadow" ||
        source.type === "diffuseLighting" ||
        source.type === "specularLighting"
      ) {
        const attributeName =
          source.type === "diffuseLighting" || source.type === "specularLighting" ? "lighting-color" : "flood-color";
        const baseColor = `rgba(${source.color.red * 255} ${source.color.green * 255} ${source.color.blue * 255} / 1)`;
        const parsedColor = parseAnimationValue(
          animationAttributeSpec(attributeName)!,
          baseColor,
          valueContext(targetNode),
        );
        const colorExpression = animatedFilterValue(source, attributeName, baseColor);
        const opacityExpression =
          attributeName === "flood-color"
            ? animatedFilterValue(source, "flood-opacity", formatNumber(source.color.alpha))
            : undefined;
        if (parsedColor && (colorExpression || opacityExpression)) {
          const colorValue =
            colorExpression ?? swiftAnimationValueLiteral(parsedColor, context.precision, `${context.rootName}.`);
          const opacity = opacityExpression
            ? `${context.rootName}.svgAnimationNumber(${opacityExpression})`
            : formatNumber(source.color.alpha);
          overrides.color = `${context.rootName}.svgAnimationFilterColor(${colorValue}, opacity: ${opacity})`;
        }
      }
      if (source.type === "turbulence") {
        const frequency = pair("baseFrequency", source.baseFrequencyX, source.baseFrequencyY);
        if (frequency) {
          overrides.baseFrequencyX = component(frequency, 0);
          overrides.baseFrequencyY = component(frequency, 1);
        }
        const octaves = animatedFilterValue(source, "numOctaves", formatNumber(source.numOctaves));
        if (octaves) overrides.numOctaves = `Int(${context.rootName}.svgAnimationNumber(${octaves}))`;
        const seed = animatedFilterValue(source, "seed", formatNumber(source.seed));
        if (seed) overrides.seed = `Int(${context.rootName}.svgAnimationNumber(${seed}))`;
        const stitch = discrete("stitchTiles", source.stitchTiles ? "stitch" : "noStitch");
        if (stitch) overrides.stitchTiles = `${stitch} == "stitch"`;
        const type = discrete("type", source.noiseType);
        if (type) overrides.type = `${type} == "fractalNoise"`;
      }
      void output;
      return overrides;
    });
    const imageHelpers: Array<{ key: string; name: string; animated?: boolean }> = [];
    for (const [index, primitive] of instance.primitives.entries()) {
      if (primitive.type !== "image" || !primitive.image.resource) continue;
      const key = `filter-image-${index}`;
      const name = `FilterImageLayer${context.filterImageHelpers.length}`;
      let subdocumentName: string | undefined;
      let animatedSubdocument = false;
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
        animatedSubdocument = child.animationProgram.animations.some(
          (animation) => animation.runtimeSupport === "typed",
        );
      }
      context.filterImageHelpers.push({
        key,
        name,
        primitive,
        canvas: context.coordinateSpace,
        ...(subdocumentName ? { subdocumentName } : {}),
        ...(animatedSubdocument ? { animated: true } : {}),
      });
      imageHelpers.push({ key, name, ...(animatedSubdocument ? { animated: true } : {}) });
    }
    const configuredMaxPixels = context.config.filters?.maxOutputPixels ?? 16_000_000;
    return {
      instance,
      ...(regionExpression ? { regionExpression } : {}),
      primitiveOverrides,
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
    targetNode: RenderNode,
  ): GeneratedMask | undefined => {
    if (!mask) return undefined;
    const resource = mask.resource;
    const bounds = objectBoundingBox(targetNode);
    const maskContext = {
      ...valueContext(targetNode),
      length: {
        ...valueContext(targetNode).length,
        ...(resource?.units === "objectBoundingBox"
          ? { viewport: { width: 1, height: 1 }, rootViewport: { width: 1, height: 1 } }
          : {}),
      },
    };
    const coordinate = (name: "x" | "y" | "width" | "height") => {
      if (!resource) return undefined;
      const animations = animationsForResource(resource.animationTargetKeys[name], name);
      if (animations.length === 0) return undefined;
      const base = parseAnimationValue(animationAttributeSpec(name)!, resource.animationBaseValues[name]!, maskContext);
      const expression = base ? animatedValueExpressionFromAnimations(animations, base) : undefined;
      if (!expression) return undefined;
      const number = `${context.rootName}.svgAnimationNumber(${expression})`;
      if (resource.units !== "objectBoundingBox" || !bounds) return number;
      const extent = name === "x" || name === "width" ? bounds.width : bounds.height;
      if (name === "width" || name === "height") return `(${number} * ${formatNumber(extent)})`;
      const origin = name === "x" ? bounds.x : bounds.y;
      return `(${formatNumber(origin)} + ${number} * ${formatNumber(extent)})`;
    };
    const x = coordinate("x");
    const y = coordinate("y");
    const width = coordinate("width");
    const height = coordinate("height");
    const dynamicRegion = x || y || width || height;
    let clipLines = dynamicRegion
      ? [
          `path.addRect(CGRect(x: ${normalizedX(x ?? formatNumber(mask.region.x))}, y: ${normalizedY(y ?? formatNumber(mask.region.y))}, width: ${normalizedWidth(width ?? formatNumber(mask.region.width))}, height: ${normalizedHeight(height ?? formatNumber(mask.region.height))}))`,
        ]
      : handleElement(
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
    const clip = dynamicRegion
      ? addAnimatedHelper(context, `MaskClip${context.nextClip++}`, clipLines)
      : addHelper(context, `MaskClip${context.nextClip++}`, clipLines);
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
        const animationTransform = transformCorrectionExpression(clipNode, coverageTransforms);
        const renderedChildren: GeneratedViewNode[] = animationTransform
          ? [
              {
                type: "group",
                children,
                opacity: 1,
                isolated: false,
                blendMode: "normal",
                animationTransform,
              },
            ]
          : children;
        const nested = buildClipPath(clipNode.clipPath, targetTransforms);
        if (nested) {
          const helpers = simpleClipPathHelpers(nested);
          // Intersection distributes over the clip subtree's logical union.
          // Simple nested regions become GraphicsContext clips on each leaf;
          // SwiftUI otherwise ignores nested view masks inside mask content.
          if (helpers && helpers.length > 0) {
            coverage.push(...renderedChildren.map((child) => addCoverageClip(child, helpers)));
          } else {
            for (const child of renderedChildren)
              coverage.push({
                type: "group",
                children: [child],
                opacity: 1,
                isolated: true,
                blendMode: "normal",
                clipPath: nested,
              });
          }
        } else if (renderedChildren.length > 0) {
          coverage.push({
            type: "group",
            children: renderedChildren,
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
      const dynamicLines = dynamicShapeLines(coverageShape, "fill", coverageTransforms);
      let lines = dynamicLines ?? renderShape(coverageShape, context.options, { fill: "black", stroke: "none" });
      if (!dynamicLines)
        for (let index = coverageTransforms.length - 1; index >= 0; index--)
          lines = wrapWithTransform(lines, coverageTransforms[index]!, context.options);
      if (lines.length === 0) continue;
      const helper = dynamicLines
        ? addAnimatedHelper(context, `ClipCoverage${context.nextClip++}`, lines)
        : addHelper(context, `ClipCoverage${context.nextClip++}`, lines);
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
        ? {
            ...node,
            transform: multiplyTransforms(node.transform, clipPath.contentTransform),
            transformAnimation: { base: node.transform, suffix: clipPath.contentTransform },
          }
        : node,
    );
    // clipPath's transform operates outside the clipPathUnits mapping:
    // target × resource-transform × object-bounding-box.
    const children = clipPath.invalid ? [] : buildClipCoverage(content, targetTransforms);
    return { children };
  };

  for (const node of nodes) {
    if (node.style.display === "none" && animationsFor(node, "display").length === 0) continue;
    if (node.type === "group") {
      const isRootViewport = ancestorTransforms.length === 0 && node.source.element === "svg";
      const viewportViewBox =
        node.viewport?.viewBox ?? (isRootViewport ? context.document.viewport.viewBox : undefined);
      const viewportRect = node.viewport?.rect ?? (isRootViewport ? context.document.viewport.viewBox : undefined);
      const viewportPreserve = node.viewport?.preserveAspectRatio ?? context.document.viewport.preserveAspectRatio;
      const viewBoxBase = viewportViewBox
        ? parseAnimationValue(
            animationAttributeSpec("viewBox")!,
            `${viewportViewBox.x} ${viewportViewBox.y} ${viewportViewBox.width} ${viewportViewBox.height}`,
            valueContext(node),
          )
        : undefined;
      const animatedViewBox = viewBoxBase ? animatedValueExpression(node, "viewBox", viewBoxBase) : undefined;
      const preserveSource = `${viewportPreserve.align} ${viewportPreserve.meetOrSlice}`;
      const animatedPreserve = viewportViewBox
        ? animatedDiscrete(node, "preserveAspectRatio", preserveSource)
        : undefined;
      const animatedViewportSuffix =
        viewBoxBase && viewportRect && (animatedViewBox || animatedPreserve)
          ? `${context.rootName}.svgMultiplyTransform(${swiftTransform(node.transformAnimation?.viewportPrefix ?? IDENTITY_TRANSFORM)}, ${context.rootName}.svgViewBoxMatrix(${animatedViewBox ?? swiftAnimationValueLiteral(viewBoxBase, context.precision, `${context.rootName}.`)}, rect: CGRect(x: ${formatNumber(viewportRect.x)}, y: ${formatNumber(viewportRect.y)}, width: ${formatNumber(viewportRect.width)}, height: ${formatNumber(viewportRect.height)}), preserveAspectRatio: ${animatedPreserve ?? swiftString(preserveSource)}))`
          : undefined;
      const animationTransform = transformCorrectionExpression(
        node,
        ancestorTransforms,
        animatedViewportSuffix,
        animatedMarkerBase(node),
      );
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
      const childAnimationOwners: Record<string, RenderNode> = { ...inheritedAnimationOwners };
      for (const attributeName of inheritedAnimationAttributes) {
        if (ownedAnimationsFor(node, attributeName).length > 0) childAnimationOwners[attributeName] = node;
        else if (!node.style.inheritedProperties[attributeName]) delete childAnimationOwners[attributeName];
      }
      const children = buildViewNodes(node.children, context, targetTransforms, childAnimationOwners);
      if (children.length > 0) {
        const clipPath = buildClipPath(node.clipPath, targetTransforms);
        const mask = buildMask(node.mask, targetTransforms, node);
        const filter = buildFilter(node.filter, targetTransforms, node);
        generated.push({
          type: "group",
          children,
          opacity: opacityExpression(node),
          isolated:
            opacityExpression(node) !== 1 ||
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
          ...(interaction(node) ? { interaction: interaction(node) } : {}),
          ...(presentationCondition(node) ? { presentationCondition: presentationCondition(node) } : {}),
          ...(animationTransform ? { animationTransform } : {}),
        });
      }
      continue;
    }
    if (node.type === "text") {
      if (
        ((node.style.visibility === "hidden" || node.style.visibility === "collapse") &&
          animationsFor(node, "visibility").length === 0) ||
        node.text === ""
      )
        continue;
      const completeTransform = [...ancestorTransforms, node.transform].reduce(multiplyTransforms);
      const name = `TextLayer${context.textHelpers.length}`;
      const fillAnimation = animatedPaint(node, "fill", node.style.fill);
      const fillOpacity = animatedNumber(node, "fill-opacity", node.style.fillOpacity);
      const strokeAnimation = animatedPaint(node, "stroke", node.style.stroke);
      const strokeOpacity = animatedNumber(node, "stroke-opacity", node.style.strokeOpacity);
      const staticPaintValue = (name: "fill" | "stroke", paint: Paint) => {
        const value = parseAnimationValue(animationAttributeSpec(name)!, paintValue(paint), valueContext(node));
        return value ? swiftAnimationValueLiteral(value, context.precision, `${context.rootName}.`) : undefined;
      };
      const effectiveFillAnimation =
        fillAnimation ?? (fillOpacity ? staticPaintValue("fill", node.style.fill) : undefined);
      const effectiveStrokeAnimation =
        strokeAnimation ?? (strokeOpacity ? staticPaintValue("stroke", node.style.stroke) : undefined);
      const strokeWidth = animatedNumber(node, "stroke-width", node.style.strokeStyle.width);
      const fontSize = animatedNumber(
        node,
        "font-size",
        Number(node.style.presentation["font-size"] ?? node.paintContext.fontMetrics.fontSize),
      );
      const letterSpacing = animatedNumber(
        node,
        "letter-spacing",
        Number(node.style.presentation["letter-spacing"] ?? 0),
      );
      const wordSpacing = animatedNumber(node, "word-spacing", Number(node.style.presentation["word-spacing"] ?? 0));
      const textTargetValue = (
        key: string | undefined,
        attributeName: string,
        baseValue: string,
        targetTag = "tspan",
      ) => {
        const animations = animationsForResource(key, attributeName).filter(
          (animation) =>
            animation.target?.binding === "resource" ||
            (animation.target?.binding === "render-node" && attributeName === "textLength"),
        );
        const spec = resolveAnimationAttributeForTarget(attributeName, "auto", targetTag);
        const base = spec ? parseAnimationValue(spec, baseValue, valueContext(node)) : undefined;
        return base ? animatedValueExpressionFromAnimations(animations, base) : undefined;
      };
      const textTargetNumber = (key: string | undefined, attributeName: string, baseValue: number) => {
        const expression = textTargetValue(key, attributeName, formatNumber(baseValue));
        return expression ? `${context.rootName}.svgAnimationNumber(${expression})` : undefined;
      };
      const textChunks = node.chunks.map((chunk) => {
        const x = chunk.x === undefined ? undefined : textTargetNumber(chunk.animationTargetKey, "x", chunk.x);
        const y = chunk.y === undefined ? undefined : textTargetNumber(chunk.animationTargetKey, "y", chunk.y);
        const startOffset = chunk.textPath
          ? textTargetNumber(chunk.textPath.animationTargetKey, "startOffset", chunk.textPath.startOffset)
          : undefined;
        const adjustmentTargets = chunk.lengthAdjustments.map((adjustment) => {
          const expression = textTargetNumber(
            adjustment.animationTargetKey,
            "textLength",
            adjustment.target / adjustment.animationScale,
          );
          return expression ? `(${expression} * ${formatNumber(adjustment.animationScale)})` : undefined;
        });
        const runs = chunk.runs.map((run) => {
          const key = run.animationTargetKey;
          const runFill = textTargetValue(key, "fill", paintValue(run.style.fill));
          const runStroke = textTargetValue(key, "stroke", paintValue(run.style.stroke));
          const characterDX = textTargetValue(
            key,
            "dx",
            run.characters.map((character) => formatNumber(character.dx)).join(" "),
          );
          const characterDY = textTargetValue(
            key,
            "dy",
            run.characters.map((character) => formatNumber(character.dy)).join(" "),
          );
          const characterRotate = textTargetValue(
            key,
            "rotate",
            run.characters.map((character) => formatNumber(character.rotate)).join(" "),
          );
          return {
            ...(textTargetNumber(key, "font-size", run.font.size)
              ? { fontSize: textTargetNumber(key, "font-size", run.font.size) }
              : {}),
            ...(textTargetNumber(key, "letter-spacing", run.letterSpacing)
              ? { letterSpacing: textTargetNumber(key, "letter-spacing", run.letterSpacing) }
              : {}),
            ...(textTargetNumber(key, "word-spacing", run.wordSpacing)
              ? { wordSpacing: textTargetNumber(key, "word-spacing", run.wordSpacing) }
              : {}),
            ...(runFill ? { fill: runFill } : {}),
            ...(textTargetNumber(key, "fill-opacity", run.style.fillOpacity)
              ? { fillOpacity: textTargetNumber(key, "fill-opacity", run.style.fillOpacity) }
              : {}),
            ...(runStroke ? { stroke: runStroke } : {}),
            ...(characterDX ? { characterDX } : {}),
            ...(characterDY ? { characterDY } : {}),
            ...(characterRotate ? { characterRotate } : {}),
            ...(textTargetNumber(key, "stroke-opacity", run.style.strokeOpacity)
              ? { strokeOpacity: textTargetNumber(key, "stroke-opacity", run.style.strokeOpacity) }
              : {}),
            ...(textTargetNumber(key, "stroke-width", run.style.strokeStyle.width)
              ? { strokeWidth: textTargetNumber(key, "stroke-width", run.style.strokeStyle.width) }
              : {}),
          };
        });
        return {
          ...(x ? { x } : {}),
          ...(y ? { y } : {}),
          ...(startOffset ? { startOffset } : {}),
          adjustmentTargets,
          runs,
        };
      });
      const textResourceAnimated = textChunks.some(
        (chunk) =>
          !!chunk.x ||
          !!chunk.y ||
          !!chunk.startOffset ||
          chunk.adjustmentTargets.some(Boolean) ||
          chunk.runs.some((run) => Object.keys(run).length > 0),
      );
      const textAnimated = !!(
        effectiveFillAnimation ||
        fillOpacity ||
        effectiveStrokeAnimation ||
        strokeOpacity ||
        strokeWidth ||
        fontSize ||
        letterSpacing ||
        wordSpacing ||
        textResourceAnimated
      );
      context.textHelpers.push({
        name,
        node,
        transform: completeTransform,
        ...(effectiveFillAnimation ? { fillAnimation: effectiveFillAnimation } : {}),
        ...(fillOpacity ? { fillOpacity } : {}),
        ...(effectiveStrokeAnimation ? { strokeAnimation: effectiveStrokeAnimation } : {}),
        ...(strokeOpacity ? { strokeOpacity } : {}),
        ...(strokeWidth ? { strokeWidth } : {}),
        ...(fontSize ? { fontSize } : {}),
        ...(letterSpacing ? { letterSpacing } : {}),
        ...(wordSpacing ? { wordSpacing } : {}),
        chunks: textChunks,
        animated: textAnimated,
        ...(context.dynamicTimingIds.size > 0 ? { eventDriven: true } : {}),
      });
      const targetTransforms = [...ancestorTransforms, node.transform];
      const animationTransform = transformCorrectionExpression(node, ancestorTransforms);
      const clipPath = buildClipPath(node.clipPath, targetTransforms);
      const mask = buildMask(node.mask, targetTransforms, node);
      const filter = buildFilter(node.filter, targetTransforms, node);
      generated.push({
        type: "group",
        children: [
          {
            type: "text",
            helper: textAnimated
              ? `${name}(documentTime: documentTime${context.dynamicTimingIds.size > 0 ? ", animationIntervals: animationIntervals" : ""})`
              : name,
          },
        ],
        opacity: opacityExpression(node),
        isolated:
          opacityExpression(node) !== 1 ||
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
        ...(interaction(node) ? { interaction: interaction(node) } : {}),
        ...(animationOffset(node, ["x", "dx"], [node.attributes.x ?? 0, node.attributes.dx ?? 0])
          ? { animationOffsetX: animationOffset(node, ["x", "dx"], [node.attributes.x ?? 0, node.attributes.dx ?? 0]) }
          : {}),
        ...(animationOffset(node, ["y", "dy"], [node.attributes.y ?? 0, node.attributes.dy ?? 0])
          ? { animationOffsetY: animationOffset(node, ["y", "dy"], [node.attributes.y ?? 0, node.attributes.dy ?? 0]) }
          : {}),
        ...(presentationCondition(node) ? { presentationCondition: presentationCondition(node) } : {}),
        ...(animationTransform ? { animationTransform } : {}),
      });
      continue;
    }
    if (node.type === "image" || node.type === "foreignObject") {
      if (
        ((node.style.visibility === "hidden" || node.style.visibility === "collapse") &&
          animationsFor(node, "visibility").length === 0) ||
        node.viewport.width <= 0 ||
        node.viewport.height <= 0 ||
        !node.resource
      )
        continue;
      const completeTransform = [...ancestorTransforms, node.transform].reduce(multiplyTransforms);
      const name = `${node.type === "foreignObject" ? "ForeignObject" : "Image"}Layer${context.imageHelpers.length}`;
      let subdocumentName: string | undefined;
      let animatedSubdocument = false;
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
        if (child.animationProgram.animations.some((animation) => animation.runtimeSupport === "typed")) {
          // Referenced SVG images share the parent's canonical document time.
          // This also keeps exact frame rendering independent of traversal order.
          animatedSubdocument = true;
        }
      }
      const preserveSource =
        node.type === "image"
          ? `${node.preserveAspectRatio.defer ? "defer " : ""}${node.preserveAspectRatio.align} ${node.preserveAspectRatio.meetOrSlice}`
          : "none meet";
      const animatedPreserve =
        node.type === "image" ? animatedDiscrete(node, "preserveAspectRatio", preserveSource) : undefined;
      const imageAnimated = animatedSubdocument || !!animatedPreserve;
      let transformExpression: string | undefined;
      if (animatedPreserve && node.type === "image") {
        const intrinsic =
          node.resource.type === "raster"
            ? (node.resource.intrinsicSize ?? { width: node.viewport.width, height: node.viewport.height })
            : { width: node.resource.document.viewport.width, height: node.resource.document.viewport.height };
        const value = `${context.rootName}.SVGAnimationRuntimeValue(kind: .viewBox, components: [0, 0, ${formatNumber(intrinsic.width)}, ${formatNumber(intrinsic.height)}], signature: "", source: "0 0 ${formatNumber(intrinsic.width)} ${formatNumber(intrinsic.height)}")`;
        const rect = `CGRect(x: ${formatNumber(node.viewport.x)}, y: ${formatNumber(node.viewport.y)}, width: ${formatNumber(node.viewport.width)}, height: ${formatNumber(node.viewport.height)})`;
        const coordinateSpace = `CGRect(x: ${formatNumber(context.coordinateSpace.x)}, y: ${formatNumber(context.coordinateSpace.y)}, width: ${formatNumber(context.coordinateSpace.width)}, height: ${formatNumber(context.coordinateSpace.height)})`;
        transformExpression = `${context.rootName}.svgOutputTransform(${context.rootName}.svgMultiplyTransform(${swiftTransform(completeTransform)}, ${context.rootName}.svgViewBoxMatrix(${value}, rect: ${rect}, preserveAspectRatio: ${animatedPreserve})), size: size, coordinateSpace: ${coordinateSpace})`;
      }
      context.imageHelpers.push({
        name,
        node,
        transform: completeTransform,
        ...(subdocumentName ? { subdocumentName } : {}),
        ...(animatedSubdocument ? { subdocumentAnimated: true } : {}),
        ...(imageAnimated ? { animated: true } : {}),
        ...(transformExpression ? { transformExpression } : {}),
        ...(context.dynamicTimingIds.size > 0 ? { eventDriven: true } : {}),
      });
      const targetTransforms = [...ancestorTransforms, node.transform];
      const animationTransform = transformCorrectionExpression(node, ancestorTransforms);
      const clipPath = buildClipPath(node.clipPath, targetTransforms);
      const mask = buildMask(node.mask, targetTransforms, node);
      const filter = buildFilter(node.filter, targetTransforms, node);
      generated.push({
        type: "group",
        children: [
          {
            type: "image",
            helper: imageAnimated
              ? `${name}(documentTime: documentTime${context.dynamicTimingIds.size > 0 ? ", animationIntervals: animationIntervals" : ""})`
              : name,
          },
        ],
        opacity: opacityExpression(node),
        isolated:
          opacityExpression(node) !== 1 ||
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
        ...(interaction(node) ? { interaction: interaction(node) } : {}),
        ...(presentationCondition(node) ? { presentationCondition: presentationCondition(node) } : {}),
        ...(animationTransform ? { animationTransform } : {}),
      });
      continue;
    }
    if (
      node.type !== "shape" ||
      ((node.style.visibility === "hidden" || node.style.visibility === "collapse") &&
        animationsFor(node, "visibility").length === 0)
    )
      continue;

    const paints: GeneratedViewNode[] = [];

    const addLayer = (kind: "fill" | "stroke", paint: Paint, paintOpacity: number) => {
      const nonScalingStroke = kind === "stroke" && node.style.strokeStyle.vectorEffect === "non-scaling-stroke";
      const completeTransform = nonScalingStroke
        ? [...ancestorTransforms, node.transform].reduce(multiplyTransforms)
        : undefined;
      const dynamicLines = dynamicShapeLines(node, kind, ancestorTransforms);
      let lines =
        dynamicLines ??
        renderShape(
          node,
          context.options,
          kind === "fill" ? { fill: "black", stroke: "none" } : { fill: "none", stroke: "black" },
          completeTransform,
        );
      if (!dynamicLines && !nonScalingStroke) {
        for (let index = ancestorTransforms.length - 1; index >= 0; index--) {
          lines = wrapWithTransform(lines, ancestorTransforms[index]!, context.options);
        }
      }
      if (lines.length === 0) return;
      const helperName = `Layer${context.nextLayer++}`;
      const helper = dynamicLines
        ? addAnimatedHelper(context, helperName, lines)
        : addHelper(context, helperName, lines);
      const animatedColor = animatedPaint(node, kind, paint);
      const animatedPaintOpacity = animatedNumber(node, `${kind}-opacity`, paintOpacity);
      if (animatedColor || animatedPaintOpacity) {
        const baseColor = colorForPaint(paint, 1) ?? "Color.clear";
        const baseRGBA = rgbaForPaint(paint, 1) ?? { red: 0, green: 0, blue: 0, alpha: 0 };
        const color = animatedColor ? `${context.rootName}.svgAnimationColor(${animatedColor})` : baseColor;
        const opacity = animatedPaintOpacity ?? formatNumber(paintOpacity);
        paints.push({
          type: "paint",
          helper,
          swiftColor: `${color}.opacity(${opacity})`,
          cgColor: { ...baseRGBA, alpha: baseRGBA.alpha * paintOpacity },
          cgColorExpression: `${context.rootName}.svgAnimationCGColor(${animatedColor ?? `${context.rootName}.SVGAnimationRuntimeValue(kind: .color, components: [${formatNumber(baseRGBA.red)}, ${formatNumber(baseRGBA.green)}, ${formatNumber(baseRGBA.blue)}, ${formatNumber(baseRGBA.alpha)}], signature: "sRGB", source: "")`}, opacity: ${opacity})`,
        });
        return;
      }
      if (paint.type === "reference") {
        const server = context.document.resources.paints.get(paint.id);
        if (server?.type === "linearGradient" || server?.type === "radialGradient") {
          if (server.stops.length === 0) return;
          if (server.stops.length === 1) {
            const animatedStop = animatedGradientStopValues(server.stops[0]!, node);
            if (animatedStop?.animated) {
              const opacity = `${context.rootName}.svgAnimationNumber(${animatedStop.opacity}) * ${formatNumber(paintOpacity)}`;
              paints.push({
                type: "paint",
                helper,
                swiftColor: `${context.rootName}.svgAnimationColor(${animatedStop.color}).opacity(${opacity})`,
                cgColor: rgbaForStop(server.stops[0]!, paintOpacity),
                cgColorExpression: `${context.rootName}.svgAnimationCGColor(${animatedStop.color}, opacity: ${opacity})`,
              });
              return;
            }
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
            const animatedStop = animatedGradientStopValues(gradient.stop, node);
            if (animatedStop?.animated) {
              const opacity = `${context.rootName}.svgAnimationNumber(${animatedStop.opacity}) * ${formatNumber(paintOpacity)}`;
              paints.push({
                type: "paint",
                helper,
                swiftColor: `${context.rootName}.svgAnimationColor(${animatedStop.color}).opacity(${opacity})`,
                cgColor: rgbaForStop(gradient.stop, paintOpacity),
                cgColorExpression: `${context.rootName}.svgAnimationCGColor(${animatedStop.color}, opacity: ${opacity})`,
              });
              return;
            }
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
            ...(animatedGradientStopsExpression(gradient.stops, node, paintOpacity)
              ? { stopsExpression: animatedGradientStopsExpression(gradient.stops, node, paintOpacity) }
              : {}),
            ...animatedGradientExpressions(server, gradient, node),
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
            ...animatedPatternExpressions(pattern, node),
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
      if (kind === "fill" && (node.style.fill.type !== "none" || animationsFor(node, "fill").length > 0)) {
        addLayer("fill", node.style.fill, node.style.fillOpacity);
      }
      if (kind === "stroke" && (node.style.stroke.type !== "none" || animationsFor(node, "stroke").length > 0)) {
        addLayer("stroke", node.style.stroke, node.style.strokeOpacity);
      }
      if (kind === "markers" && node.markers && node.markers.length > 0) {
        paints.push(...buildViewNodes(node.markers, context, [...ancestorTransforms, node.transform]));
      }
    }
    if (paints.length > 0) {
      const targetTransforms = [...ancestorTransforms, node.transform];
      const animationTransform = transformCorrectionExpression(node, ancestorTransforms);
      const clipPath = buildClipPath(node.clipPath, targetTransforms);
      const mask = buildMask(node.mask, targetTransforms, node);
      const filter = buildFilter(node.filter, targetTransforms, node);
      generated.push({
        type: "group",
        children: paints,
        opacity: opacityExpression(node),
        isolated:
          opacityExpression(node) !== 1 ||
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
        ...(interaction(node) ? { interaction: interaction(node) } : {}),
        ...(presentationCondition(node) ? { presentationCondition: presentationCondition(node) } : {}),
        ...(animationTransform ? { animationTransform } : {}),
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

function filterLightLiteral(light: FilterLightSource | undefined): string {
  if (!light) return "nil";
  if (light.type === "distant")
    return `.distant(x: ${formatNumber(light.x)}, y: ${formatNumber(light.y)}, z: ${formatNumber(light.z)})`;
  if (light.type === "point")
    return `.point(x: ${formatNumber(light.x)}, y: ${formatNumber(light.y)}, z: ${formatNumber(light.z)})`;
  return `.spot(x: ${formatNumber(light.x)}, y: ${formatNumber(light.y)}, z: ${formatNumber(light.z)}, pointsAtX: ${formatNumber(light.pointsAtX)}, pointsAtY: ${formatNumber(light.pointsAtY)}, pointsAtZ: ${formatNumber(light.pointsAtZ)}, exponent: ${formatNumber(light.specularExponent)}, coneAngle: ${light.limitingConeAngle === undefined ? "nil" : formatNumber(light.limitingConeAngle)})`;
}

function filterRegionLiteral(region: FilterInstance["region"]): string {
  return `SVGFilterRegion(x: ${formatNumber(region.x)}, y: ${formatNumber(region.y)}, width: ${formatNumber(region.width)}, height: ${formatNumber(region.height)})`;
}

function filterBlendModeLiteral(mode: Extract<FilterPrimitive, { type: "blend" }>["mode"]): string {
  return `.${mode.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`;
}

function filterComponentFunctionLiteral(
  fn: Extract<FilterPrimitive, { type: "componentTransfer" }>["functions"][number],
  overrides: Readonly<Record<string, string>> = {},
): string {
  switch (fn.type) {
    case "identity":
      return ".identity";
    case "table":
    case "discrete":
      return `.${fn.type}(${overrides.tableValues ?? `[${fn.values.map((value) => formatNumber(value)).join(", ")}]`})`;
    case "linear":
      return `.linear(slope: ${overrides.slope ?? formatNumber(fn.slope)}, intercept: ${overrides.intercept ?? formatNumber(fn.intercept)})`;
    case "gamma":
      return `.gamma(amplitude: ${overrides.amplitude ?? formatNumber(fn.amplitude)}, exponent: ${overrides.exponent ?? formatNumber(fn.exponent)}, offset: ${overrides.offset ?? formatNumber(fn.offset)})`;
  }
}

function filterCompositeOperatorLiteral(operator: Extract<FilterPrimitive, { type: "composite" }>["operator"]): string {
  return `.${operator === "in" ? "inside" : operator === "out" ? "outside" : operator}`;
}

function filterPrimitiveLiteral(
  primitive: FilterPrimitive,
  index: number,
  overrides: Readonly<Record<string, string>> = {},
): string {
  const value = (name: string, fallback: number) => overrides[name] ?? formatNumber(fallback);
  const list = (name: string, fallback: number[]) =>
    overrides[name] ?? `[${fallback.map((item) => formatNumber(item)).join(", ")}]`;
  const input = (name: "input" | "input2", fallback: FilterInput) => overrides[name] ?? filterInputLiteral(fallback);
  const region = overrides.region ?? filterRegionLiteral(primitive.subregion);
  const linear = overrides.linearRGB ?? (primitive.colorInterpolation === "linearRGB" ? "true" : "false");
  const result = primitive.result ? swiftString(primitive.result) : "nil";
  switch (primitive.type) {
    case "blend":
      return `.blend(input: ${input("input", primitive.input)}, input2: ${input("input2", primitive.input2)}, mode: ${overrides.mode ?? filterBlendModeLiteral(primitive.mode)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "colorMatrix":
      return `.colorMatrix(input: ${input("input", primitive.input)}, matrix: ${list("values", primitive.matrix)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "componentTransfer":
      return `.componentTransfer(input: ${input("input", primitive.input)}, functions: ${overrides.functions ?? `[${primitive.functions.map((fn) => filterComponentFunctionLiteral(fn)).join(", ")}]`}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "composite":
      return `.composite(input: ${input("input", primitive.input)}, input2: ${input("input2", primitive.input2)}, operation: ${overrides.operator ?? filterCompositeOperatorLiteral(primitive.operator)}, k1: ${value("k1", primitive.k1)}, k2: ${value("k2", primitive.k2)}, k3: ${value("k3", primitive.k3)}, k4: ${value("k4", primitive.k4)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "convolveMatrix":
      return `.convolveMatrix(input: ${input("input", primitive.input)}, orderX: ${overrides.orderX ?? primitive.orderX}, orderY: ${overrides.orderY ?? primitive.orderY}, kernel: ${list("kernelMatrix", primitive.kernelMatrix)}, divisor: ${value("divisor", primitive.divisor)}, bias: ${value("bias", primitive.bias)}, targetX: ${overrides.targetX ?? primitive.targetX}, targetY: ${overrides.targetY ?? primitive.targetY}, edge: ${overrides.edgeMode ?? `.${primitive.edgeMode}`}, unitX: ${overrides.kernelUnitLengthX ?? (primitive.kernelUnitLengthX === undefined ? "nil" : formatNumber(primitive.kernelUnitLengthX))}, unitY: ${overrides.kernelUnitLengthY ?? (primitive.kernelUnitLengthY === undefined ? "nil" : formatNumber(primitive.kernelUnitLengthY))}, preserveAlpha: ${overrides.preserveAlpha ?? primitive.preserveAlpha}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "morphology":
      return `.morphology(input: ${input("input", primitive.input)}, operation: ${overrides.operator ?? `.${primitive.operator}`}, radiusX: ${value("radiusX", primitive.radiusX)}, radiusY: ${value("radiusY", primitive.radiusY)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "displacementMap":
      return `.displacementMap(input: ${input("input", primitive.input)}, input2: ${input("input2", primitive.input2)}, a: ${value("a", primitive.displacement.a)}, b: ${value("b", primitive.displacement.b)}, c: ${value("c", primitive.displacement.c)}, d: ${value("d", primitive.displacement.d)}, xChannel: ${overrides.xChannelSelector ?? `.${primitive.xChannel.toLowerCase()}`}, yChannel: ${overrides.yChannelSelector ?? `.${primitive.yChannel.toLowerCase()}`}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "tile":
      return `.tile(input: ${input("input", primitive.input)}, tileRegion: ${filterRegionLiteral(primitive.tileRegion)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "turbulence":
      return `.turbulence(baseFrequencyX: ${value("baseFrequencyX", primitive.baseFrequencyX)}, baseFrequencyY: ${value("baseFrequencyY", primitive.baseFrequencyY)}, octaves: ${value("numOctaves", primitive.numOctaves)}, seed: ${value("seed", primitive.seed)}, stitch: ${overrides.stitchTiles ?? primitive.stitchTiles}, fractalNoise: ${overrides.type ?? primitive.noiseType === "fractalNoise"}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "image":
      return `.image(key: ${swiftString(`filter-image-${index}`)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "diffuseLighting":
      return `.diffuseLighting(input: ${input("input", primitive.input)}, surfaceScale: ${value("surfaceScale", primitive.surfaceScale)}, diffuseConstant: ${value("diffuseConstant", primitive.diffuseConstant)}, unitX: ${overrides.kernelUnitLengthX ?? (primitive.kernelUnitLengthX === undefined ? "nil" : formatNumber(primitive.kernelUnitLengthX))}, unitY: ${overrides.kernelUnitLengthY ?? (primitive.kernelUnitLengthY === undefined ? "nil" : formatNumber(primitive.kernelUnitLengthY))}, color: ${overrides.color ?? filterColorLiteral(primitive.color)}, light: ${overrides.light ?? filterLightLiteral(primitive.light)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "specularLighting":
      return `.specularLighting(input: ${input("input", primitive.input)}, surfaceScale: ${value("surfaceScale", primitive.surfaceScale)}, specularConstant: ${value("specularConstant", primitive.specularConstant)}, specularExponent: ${value("specularExponent", primitive.specularExponent)}, unitX: ${overrides.kernelUnitLengthX ?? (primitive.kernelUnitLengthX === undefined ? "nil" : formatNumber(primitive.kernelUnitLengthX))}, unitY: ${overrides.kernelUnitLengthY ?? (primitive.kernelUnitLengthY === undefined ? "nil" : formatNumber(primitive.kernelUnitLengthY))}, color: ${overrides.color ?? filterColorLiteral(primitive.color)}, light: ${overrides.light ?? filterLightLiteral(primitive.light)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "gaussianBlur":
      return `.gaussianBlur(input: ${input("input", primitive.input)}, sigmaX: ${value("stdDeviationX", primitive.stdDeviationX)}, sigmaY: ${value("stdDeviationY", primitive.stdDeviationY)}, edge: ${overrides.edgeMode ?? `.${primitive.edgeMode}`}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "offset":
      return `.offset(input: ${input("input", primitive.input)}, dx: ${value("dx", primitive.dx)}, dy: ${value("dy", primitive.dy)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "flood":
      return `.flood(color: ${overrides.color ?? filterColorLiteral(primitive.color)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "merge":
      return `.merge(inputs: [${primitive.inputs.map(filterInputLiteral).join(", ")}], region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "dropShadow":
      return `.dropShadow(input: ${input("input", primitive.input)}, sigmaX: ${value("stdDeviationX", primitive.stdDeviationX)}, sigmaY: ${value("stdDeviationY", primitive.stdDeviationY)}, dx: ${value("dx", primitive.dx)}, dy: ${value("dy", primitive.dy)}, color: ${overrides.color ?? filterColorLiteral(primitive.color)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
    case "passthrough":
      return `.passthrough(input: ${input("input", primitive.input)}, region: ${region}, linearRGB: ${linear}, result: ${result})`;
  }
}

function filterDefinitionLiteral(filter: GeneratedFilter): string {
  const instance = filter.instance;
  return `SVGFilterDefinition(region: ${filter.regionExpression ?? filterRegionLiteral(instance.region)}, primitives: [${instance.primitives.map((primitive, index) => filterPrimitiveLiteral(primitive, index, filter.primitiveOverrides[index])).join(", ")}], fillPaint: ${filterColorLiteral(instance.fillPaint)}, strokePaint: ${filterColorLiteral(instance.strokePaint)}, maxOutputPixels: ${filter.maxOutputPixels})`;
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
  animation?: { value: string; opacity: string },
): string {
  if (animation) return `SVGTextSource.color(svgTextColor(${animation.value}, opacity: ${animation.opacity}))`;
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
  helper: ViewBuildContext["textHelpers"][number],
  coordinateSpace: ViewBoxData,
  document: RenderDocument,
  ownerName: string,
  indentationSize: number,
): string[] {
  const indentation = " ".repeat(indentationSize);
  const i2 = indentation.repeat(2);
  const i3 = indentation.repeat(3);
  const i4 = indentation.repeat(4);
  const i5 = indentation.repeat(5);
  const chunks = helper.node.chunks
    .map((chunk, chunkIndex) => {
      const chunkExpressions = helper.chunks[chunkIndex]!;
      const runs = chunk.runs
        .map((run, runIndex) => {
          const runExpressions = chunkExpressions.runs[runIndex]!;
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
              (character, characterIndex) =>
                `SVGTextCharacter(text: ${swiftString(character.text)}, dx: ${runExpressions.characterDX ? `${ownerName}.svgAnimationComponent(${runExpressions.characterDX}, index: ${characterIndex})` : formatNumber(character.dx)}, dy: ${runExpressions.characterDY ? `${ownerName}.svgAnimationComponent(${runExpressions.characterDY}, index: ${characterIndex})` : formatNumber(character.dy)}, rotation: ${runExpressions.characterRotate ? `${ownerName}.svgAnimationComponent(${runExpressions.characterRotate}, index: ${characterIndex})` : formatNumber(character.rotate)})`,
            )
            .join(", ");
          const bidi = run.unicodeBidi.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
          const fillAnimation = runExpressions.fill ?? helper.fillAnimation;
          const fillOpacity =
            runExpressions.fillOpacity ?? helper.fillOpacity ?? formatNumber(run.style.fillOpacity * localOpacity);
          const strokeAnimation = runExpressions.stroke ?? helper.strokeAnimation;
          const strokeOpacity =
            runExpressions.strokeOpacity ??
            helper.strokeOpacity ??
            formatNumber(run.style.strokeOpacity * localOpacity);
          return `SVGTextRun(text: ${swiftString(run.text)}, characters: [${characters}], dx: ${formatNumber(run.dx)}, dy: ${formatNumber(run.dy)}, family: ${swiftString(run.font.family)}, size: ${runExpressions.fontSize ?? helper.fontSize ?? formatNumber(run.font.size)}, weight: ${formatNumber(run.font.weight)}, width: ${formatNumber(run.font.width)}, italic: ${run.font.italic}, smallCaps: ${run.font.smallCaps}, sizeAdjust: ${run.font.sizeAdjust === undefined ? "nil" : formatNumber(run.font.sizeAdjust)}, letterSpacing: ${runExpressions.letterSpacing ?? helper.letterSpacing ?? formatNumber(run.letterSpacing)}, wordSpacing: ${runExpressions.wordSpacing ?? helper.wordSpacing ?? formatNumber(run.wordSpacing)}, kerning: ${run.kerning}, baseline: .${baseline}, baselineShift: ${formatNumber(run.baselineShift)}, decorations: [${decorations}], direction: .${run.direction}, unicodeBidi: .${bidi}, textOrientation: .${run.textOrientation}, fill: ${textPaintLiteral(run.style.fill, run.style.fillOpacity * localOpacity, helper.node, document, transform, fillAnimation ? { value: fillAnimation, opacity: fillOpacity } : undefined)}, stroke: ${textPaintLiteral(run.style.stroke, run.style.strokeOpacity * localOpacity, helper.node, document, transform, strokeAnimation ? { value: strokeAnimation, opacity: strokeOpacity } : undefined)}, strokeWidth: ${runExpressions.strokeWidth ?? helper.strokeWidth ?? formatNumber(run.style.strokeStyle.width)}, lineCap: .${run.style.strokeStyle.lineCap}, lineJoin: .${run.style.strokeStyle.lineJoin}, miterLimit: ${formatNumber(run.style.strokeStyle.miterLimit)}, paintOrder: [${order}], transform: ${swiftTransform(transform)})`;
        })
        .join(", ");
      const adjustments = chunk.lengthAdjustments
        .map(
          (adjustment, adjustmentIndex) =>
            `SVGTextLengthAdjustment(start: ${adjustment.start}, end: ${adjustment.end}, target: ${chunkExpressions.adjustmentTargets[adjustmentIndex] ?? formatNumber(adjustment.target)}, mode: .${adjustment.mode})`,
        )
        .join(", ");
      const path = chunk.textPath
        ? `SVGTextPath(points: [${chunk.textPath.points.map((point) => `SVGTextPathPoint(x: ${formatNumber(point.x)}, y: ${formatNumber(point.y)}, distance: ${formatNumber(point.distance)}, move: ${point.move})`).join(", ")}], length: ${formatNumber(chunk.textPath.length)}, closed: ${chunk.textPath.closed}, distanceScale: ${formatNumber(chunk.textPath.distanceScale)}, startOffset: ${chunkExpressions.startOffset ?? formatNumber(chunk.textPath.startOffset)}, method: .${chunk.textPath.method}, spacing: .${chunk.textPath.spacing}, side: .${chunk.textPath.side})`
        : "nil";
      const writingMode = chunk.writingMode.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
      return `SVGTextChunk(x: ${chunk.x === undefined ? "nil" : (chunkExpressions.x ?? formatNumber(chunk.x))}, y: ${chunk.y === undefined ? "nil" : (chunkExpressions.y ?? formatNumber(chunk.y))}, anchor: .${chunk.anchor}, direction: .${chunk.direction}, writingMode: .${writingMode}, lengthAdjustments: [${adjustments}], textPath: ${path}, runs: [${runs}])`;
    })
    .join(`,\n${i3}`);

  return [
    "// CoreText glyph paths preserve SVG metrics; accessibility text is retained, but selection is unavailable.",
    `private struct ${helper.name}: View {`,
    ...(helper.animated ? [`${indentation}let documentTime: Double`, ""] : []),
    ...(helper.animated && helper.eventDriven
      ? [`${indentation}let animationIntervals: [String: [(begin: Double, end: Double)]]`, ""]
      : []),
    `${indentation}var body: some View {`,
    `${i2}Canvas { (context: inout GraphicsContext, size: CGSize) in`,
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
    ...(helper.animated
      ? [
          `${indentation}private func svgTextColor(_ value: ${ownerName}.SVGAnimationRuntimeValue, opacity: Double) -> SVGTextColor {`,
          `${i2}func encoded(_ component: Double) -> Double { component <= 0.0031308 ? component * 12.92 : 1.055 * pow(component, 1 / 2.4) - 0.055 }`,
          `${i2}let components = value.components + [0, 0, 0, 0]`,
          `${i2}let linear = value.signature == "linearRGB"`,
          `${i2}return SVGTextColor(red: CGFloat(min(1, max(0, linear ? encoded(components[0]) : components[0]))), green: CGFloat(min(1, max(0, linear ? encoded(components[1]) : components[1]))), blue: CGFloat(min(1, max(0, linear ? encoded(components[2]) : components[2]))), alpha: CGFloat(min(1, max(0, components[3] * opacity))))`,
          `${indentation}}`,
          "",
        ]
      : []),
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
  const coordinate = (name: string, value: number) =>
    node.coordinateExpressions?.[name] ? `CGFloat(${node.coordinateExpressions[name]})` : formatNumber(value);
  const stops =
    node.stopsExpression ??
    `[${gradient.stops.map((stop) => gradientStopLiteral(stop, node.paintOpacity)).join(", ")}]`;
  const transform = node.matrixExpression ?? runtimeTransform(gradient.matrix, node.coordinateSpace);
  const spread =
    node.spreadExpression ?? `.${gradient.spreadMethod === "repeat" ? "repeating" : gradient.spreadMethod}`;
  const linearRGB = node.linearRGBExpression ?? String(gradient.colorInterpolation === "linearRGB");
  const lines = [
    `${prefix}Canvas { (context: inout GraphicsContext, size: CGSize) in`,
    `${inner}let clipPath = ${shapeHelperCall(node.helper)}.path(in: CGRect(origin: .zero, size: size))`,
    `${inner}let stops = ${stops}`,
    `${inner}if let gradient = svgGradient(stops: stops, spread: ${spread}, startT: ${formatNumber(gradient.startT)}, endT: ${formatNumber(gradient.endT)}, linearRGB: ${linearRGB}) {`,
    `${nested}context.withCGContext { graphics in`,
    `${deep}graphics.saveGState()`,
    `${deep}graphics.addPath(clipPath.cgPath)`,
    `${deep}graphics.clip()`,
    `${deep}graphics.concatenate(${transform})`,
  ];
  if (gradient.type === "linearGradient") {
    const x1 = coordinate("x1", gradient.x1);
    const y1 = coordinate("y1", gradient.y1);
    const x2 = coordinate("x2", gradient.x2);
    const y2 = coordinate("y2", gradient.y2);
    lines.push(
      `${deep}let gradientStart = CGPoint(x: ${x1} + (${x2} - ${x1}) * ${formatNumber(gradient.startT)}, y: ${y1} + (${y2} - ${y1}) * ${formatNumber(gradient.startT)})`,
      `${deep}let gradientEnd = CGPoint(x: ${x1} + (${x2} - ${x1}) * ${formatNumber(gradient.endT)}, y: ${y1} + (${y2} - ${y1}) * ${formatNumber(gradient.endT)})`,
      `${deep}graphics.drawLinearGradient(gradient, start: gradientStart, end: gradientEnd, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
    );
  } else {
    const cx = coordinate("cx", gradient.cx);
    const cy = coordinate("cy", gradient.cy);
    const radius = coordinate("r", gradient.r);
    const fx = coordinate("fx", gradient.fx);
    const fy = coordinate("fy", gradient.fy);
    const fr = coordinate("fr", gradient.fr);
    lines.push(
      `${deep}graphics.drawRadialGradient(gradient, startCenter: CGPoint(x: ${fx} + (${cx} - ${fx}) * ${formatNumber(gradient.startT)}, y: ${fy} + (${cy} - ${fy}) * ${formatNumber(gradient.startT)}), startRadius: ${fr} + (${radius} - ${fr}) * ${formatNumber(gradient.startT)}, endCenter: CGPoint(x: ${fx} + (${cx} - ${fx}) * ${formatNumber(gradient.endT)}, y: ${fy} + (${cy} - ${fy}) * ${formatNumber(gradient.endT)}), endRadius: ${fr} + (${radius} - ${fr}) * ${formatNumber(gradient.endT)}, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
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
    `${prefix}Canvas { (context: inout GraphicsContext, size: CGSize) in`,
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
  const coordinate = (name: string, value: number) =>
    node.coordinateExpressions?.[name] ? `CGFloat(${node.coordinateExpressions[name]})` : formatNumber(value);
  const transform = node.matrixExpression ?? runtimeTransform(gradient.matrix, node.coordinateSpace);
  const spread =
    node.spreadExpression ?? `.${gradient.spreadMethod === "repeat" ? "repeating" : gradient.spreadMethod}`;
  const linearRGB = node.linearRGBExpression ?? String(gradient.colorInterpolation === "linearRGB");
  const stops =
    node.stopsExpression ??
    `[${gradient.stops.map((stop) => gradientStopLiteral(stop, node.paintOpacity)).join(", ")}]`;
  const lines = [
    `${prefix}do {`,
    `${inner}let clipPath = ${shapeHelperCall(node.helper)}.path(in: CGRect(origin: .zero, size: size))`,
    `${inner}let stops = ${stops}`,
    `${inner}if let gradient = svgGradient(stops: stops, spread: ${spread}, startT: ${formatNumber(gradient.startT)}, endT: ${formatNumber(gradient.endT)}, linearRGB: ${linearRGB}) {`,
    `${nested}${graphicsName}.saveGState()`,
    `${nested}${graphicsName}.addPath(clipPath.cgPath)`,
    `${nested}${graphicsName}.clip()`,
    `${nested}${graphicsName}.concatenate(${transform})`,
  ];
  if (gradient.type === "linearGradient") {
    const x1 = coordinate("x1", gradient.x1);
    const y1 = coordinate("y1", gradient.y1);
    const x2 = coordinate("x2", gradient.x2);
    const y2 = coordinate("y2", gradient.y2);
    lines.push(
      `${nested}${graphicsName}.drawLinearGradient(gradient, start: CGPoint(x: ${x1} + (${x2} - ${x1}) * ${formatNumber(gradient.startT)}, y: ${y1} + (${y2} - ${y1}) * ${formatNumber(gradient.startT)}), end: CGPoint(x: ${x1} + (${x2} - ${x1}) * ${formatNumber(gradient.endT)}, y: ${y1} + (${y2} - ${y1}) * ${formatNumber(gradient.endT)}), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
    );
  } else {
    const cx = coordinate("cx", gradient.cx);
    const cy = coordinate("cy", gradient.cy);
    const radius = coordinate("r", gradient.r);
    const fx = coordinate("fx", gradient.fx);
    const fy = coordinate("fy", gradient.fy);
    const fr = coordinate("fr", gradient.fr);
    lines.push(
      `${nested}${graphicsName}.drawRadialGradient(gradient, startCenter: CGPoint(x: ${fx} + (${cx} - ${fx}) * ${formatNumber(gradient.startT)}, y: ${fy} + (${cy} - ${fy}) * ${formatNumber(gradient.startT)}), startRadius: ${fr} + (${radius} - ${fr}) * ${formatNumber(gradient.startT)}, endCenter: CGPoint(x: ${fx} + (${cx} - ${fx}) * ${formatNumber(gradient.endT)}, y: ${fy} + (${cy} - ${fy}) * ${formatNumber(gradient.endT)}), endRadius: ${fr} + (${radius} - ${fr}) * ${formatNumber(gradient.endT)}, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])`,
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
        `${inner}${graphicsName}.addPath(${shapeHelperCall(node.helper)}.path(in: CGRect(origin: .zero, size: size)).cgPath)`,
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
        `${inner}${graphicsName}.addPath(${shapeHelperCall(node.viewportClip)}.path(in: CGRect(origin: .zero, size: size)).cgPath)`,
        `${inner}${graphicsName}.clip()`,
      );
    if (commandClipHelpers && commandClipHelpers.length > 0) {
      lines.push(`${inner}let clipUnion = CGMutablePath()`);
      for (const helper of commandClipHelpers)
        lines.push(
          `${inner}clipUnion.addPath(${shapeHelperCall(helper)}.path(in: CGRect(origin: .zero, size: size)).cgPath)`,
        );
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
      if (node.opacity !== 1)
        lines.push(
          `${inner}${graphicsName}.setAlpha(${typeof node.opacity === "number" ? formatNumber(node.opacity) : node.opacity})`,
        );
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
        node.animationTransform ||
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
    `${deep}repeatedPath.addPath(${shapeHelperCall(node.helper)}.path(in: CGRect(origin: .zero, size: size)).cgPath, transform: CGAffineTransform(translationX: offsetX${runtime.suffix}, y: offsetY${runtime.suffix}))`,
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
      `${nested}${graphicsName}.addPath(${shapeHelperCall(runtime.tileClip)}.path(in: CGRect(origin: .zero, size: size)).cgPath)`,
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
  const coordinate = (name: string, fallback: number) =>
    node.coordinateExpressions?.[name] ? `CGFloat(${node.coordinateExpressions[name]})` : formatNumber(fallback);
  const tileX = coordinate("x", pattern.tile.x);
  const tileY = coordinate("y", pattern.tile.y);
  const tileWidth = coordinate("width", pattern.tile.width);
  const tileHeight = coordinate("height", pattern.tile.height);
  const factorX = node.rangeFactorX ?? 1;
  const factorY = node.rangeFactorY ?? 1;
  const runtime: PatternRepeatRuntime = {
    minRow: factorY === 1 ? pattern.minRow : pattern.minRow * factorY - factorY,
    maxRow: factorY === 1 ? pattern.maxRow : (pattern.maxRow + 1) * factorY + factorY,
    minColumn: factorX === 1 ? pattern.minColumn : pattern.minColumn * factorX - factorX,
    maxColumn: factorX === 1 ? pattern.maxColumn : (pattern.maxColumn + 1) * factorX + factorX,
    columnX: `${formatNumber(matrix.a)} * ${tileWidth}`,
    columnY: `${formatNumber(matrix.b)} * ${tileWidth}`,
    rowX: `${formatNumber(matrix.c)} * ${tileHeight}`,
    rowY: `${formatNumber(matrix.d)} * ${tileHeight}`,
    originX: `${formatNumber(matrix.a)} * ${tileX} + ${formatNumber(matrix.c)} * ${tileY}`,
    originY: `${formatNumber(matrix.b)} * ${tileX} + ${formatNumber(matrix.d)} * ${tileY}`,
    scaleX: `size.width / ${formatNumber(node.coordinateSpace.width)}`,
    scaleY: `size.height / ${formatNumber(node.coordinateSpace.height)}`,
    suffix: node.patternIndex,
    ...(node.tileClip ? { tileClip: node.tileClip } : {}),
  };
  const lines = [
    `${prefix}do {`,
    `${inner}${graphicsName}.saveGState()`,
    `${inner}${graphicsName}.addPath(${shapeHelperCall(node.helper)}.path(in: CGRect(origin: .zero, size: size)).cgPath)`,
    `${inner}${graphicsName}.clip()`,
  ];
  if (node.transformCorrection) lines.push(`${inner}${graphicsName}.concatenate(${node.transformCorrection})`);
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
  if (node.type === "group" && node.presentationCondition) {
    const { presentationCondition, ...visibleNode } = node;
    return [
      `${prefix}if ${presentationCondition} {`,
      ...renderViewNode(visibleNode, level + 1, indentation),
      `${prefix}}`,
    ];
  }
  if (node.type === "group" && node.animationTransform) {
    const { animationTransform, ...staticNode } = node;
    return [
      `${prefix}GeometryReader { proxy in`,
      ...renderViewNode(staticNode, level + 1, indentation),
      `${prefix}${indentation}.transformEffect(${animationTransform})`,
      `${prefix}}`,
    ];
  }
  if (node.type === "text" || node.type === "image") return [`${prefix}${shapeHelperCall(node.helper)}`];
  if (node.type === "paint") {
    if (!node.clipUnions) return [`${prefix}${shapeHelperCall(node.helper)}.fill(${node.swiftColor})`];
    const inner = `${prefix}${indentation}`;
    const deep = `${inner}${indentation}`;
    const lines = [
      `${prefix}Canvas { (context: inout GraphicsContext, size: CGSize) in`,
      `${inner}context.withCGContext { graphics in`,
      `${deep}graphics.saveGState()`,
    ];
    for (const [index, helpers] of node.clipUnions.entries()) {
      lines.push(`${deep}let clipUnion${index} = CGMutablePath()`);
      for (const helper of helpers)
        lines.push(
          `${deep}clipUnion${index}.addPath(${shapeHelperCall(helper)}.path(in: CGRect(origin: .zero, size: size)).cgPath)`,
        );
      lines.push(`${deep}graphics.addPath(clipUnion${index})`, `${deep}graphics.clip()`);
    }
    lines.push(
      `${deep}graphics.addPath(${shapeHelperCall(node.helper)}.path(in: CGRect(origin: .zero, size: size)).cgPath)`,
      `${deep}graphics.setFillColor(${node.cgColorExpression ?? `CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [${formatNumber(node.cgColor.red)}, ${formatNumber(node.cgColor.green)}, ${formatNumber(node.cgColor.blue)}, ${formatNumber(node.cgColor.alpha)}])!`})`,
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
        ...node.filter.imageHelpers.flatMap(({ key, name, animated }) => [
          `${prefix}${indentation}let ${name}Renderer = ImageRenderer(content: ${name}${animated ? "(documentTime: documentTime)" : "()"}.frame(width: size.width, height: size.height))`,
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
  if (node.viewportClip) lines.push(`${prefix}.clipShape(${shapeHelperCall(node.viewportClip)})`);
  if (node.clipPath) {
    const simpleHelpers = simpleClipPathHelpers(node.clipPath);
    if (simpleHelpers?.length === 1) {
      lines.push(`${prefix}.clipShape(${shapeHelperCall(simpleHelpers[0]!)})`);
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
        `${prefix}${indentation}${indentation}Canvas { (context: inout GraphicsContext, size: CGSize) in`,
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
        `${prefix}${indentation}${indentation}${indentation}.clipShape(${shapeHelperCall(node.mask.clip)})`,
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
        `${prefix}${indentation}${indentation}${indentation}.clipShape(${shapeHelperCall(node.mask.clip)})`,
        `${prefix}${indentation}${indentation}}`,
        `${prefix}${indentation}}`,
        `${prefix}}`,
      );
    } else {
      lines.push(`${prefix}.mask {`, `${prefix}${indentation}ZStack {`);
      if (node.mask.children.length === 0) lines.push(`${prefix}${indentation}${indentation}Color.clear`);
      else for (const child of node.mask.children) lines.push(...renderViewNode(child, level + 2, indentation));
      lines.push(
        `${prefix}${indentation}}`,
        `${prefix}${indentation}.clipShape(${shapeHelperCall(node.mask.clip)})`,
        `${prefix}}`,
      );
    }
  }
  if (node.opacity !== 1)
    lines.push(`${prefix}.opacity(${typeof node.opacity === "number" ? swiftNumber(node.opacity) : node.opacity})`);
  if (node.blendMode !== "normal") lines.push(`${prefix}.blendMode(.${swiftBlendMode(node.blendMode)})`);
  if (node.animationOffsetX) lines.push(`${prefix}.offset(x: ${node.animationOffsetX})`);
  if (node.animationOffsetY) lines.push(`${prefix}.offset(y: ${node.animationOffsetY})`);
  if (node.animationTransform) lines.push(`${prefix}.transformEffect(${node.animationTransform})`);
  if (node.interaction) {
    const { targetId, events, pointerEvents } = node.interaction;
    const tap = events.filter((event) => event === "click" || event === "activate");
    const hoverIn = events.filter((event) => event === "mouseover" || event === "mouseenter");
    const hoverOut = events.filter((event) => event === "mouseout" || event === "mouseleave");
    const focusIn = events.filter((event) => event === "focus" || event === "focusin");
    const focusOut = events.filter((event) => event === "blur" || event === "focusout");
    const pointerDown = events.filter((event) => event === "mousedown" || event === "pointerdown");
    const pointerUp = events.filter((event) => event === "mouseup" || event === "pointerup");
    const record = (event: string, depth: number) =>
      `${prefix}${indentation.repeat(depth)}recordAnimationEvent(name: ${swiftString(event)}, targetID: ${swiftString(targetId)}, documentTime: documentTime)`;
    if (tap.length > 0) {
      lines.push(`${prefix}.onTapGesture {`);
      for (const event of tap) lines.push(record(event, 1));
      lines.push(`${prefix}}`);
    }
    if (hoverIn.length + hoverOut.length > 0) {
      lines.push(`${prefix}.onHover { hovering in`, `${prefix}${indentation}if hovering {`);
      for (const event of hoverIn) lines.push(record(event, 2));
      lines.push(`${prefix}${indentation}} else {`);
      for (const event of hoverOut) lines.push(record(event, 2));
      lines.push(`${prefix}${indentation}}`, `${prefix}}`);
    }
    if (focusIn.length + focusOut.length > 0) {
      lines.push(`${prefix}.modifier(SVGFocusEventModifier { focused in`, `${prefix}${indentation}if focused {`);
      for (const event of focusIn) lines.push(record(event, 2));
      lines.push(`${prefix}${indentation}} else {`);
      for (const event of focusOut) lines.push(record(event, 2));
      lines.push(`${prefix}${indentation}}`, `${prefix}})`);
    }
    if (pointerDown.length + pointerUp.length > 0) {
      const down = `[${pointerDown.map(swiftString).join(", ")}]`;
      const up = `[${pointerUp.map(swiftString).join(", ")}]`;
      lines.push(
        `${prefix}.simultaneousGesture(`,
        `${prefix}${indentation}DragGesture(minimumDistance: 0)`,
        `${prefix}${indentation}${indentation}.onChanged { _ in recordPointerTransition(targetID: ${swiftString(targetId)}, names: ${down}, active: true, documentTime: documentTime) }`,
        `${prefix}${indentation}${indentation}.onEnded { _ in recordPointerTransition(targetID: ${swiftString(targetId)}, names: ${up}, active: false, documentTime: documentTime) }`,
        `${prefix})`,
      );
    }
    if (events.includes("activate")) {
      lines.push(
        `${prefix}.accessibilityAddTraits(.isButton)`,
        `${prefix}.accessibilityAction(.default) { recordAnimationEvent(name: "activate", targetID: ${swiftString(targetId)}, documentTime: documentTime) }`,
      );
    }
    if (pointerEvents.toLowerCase() === "none") lines.push(`${prefix}.allowsHitTesting(false)`);
  }
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

private struct SVGFilterVector3 {
    let x: CGFloat
    let y: CGFloat
    let z: CGFloat
}

private enum SVGFilterLight {
    case distant(x: CGFloat, y: CGFloat, z: CGFloat)
    case point(x: CGFloat, y: CGFloat, z: CGFloat)
    case spot(x: CGFloat, y: CGFloat, z: CGFloat, pointsAtX: CGFloat, pointsAtY: CGFloat, pointsAtZ: CGFloat, exponent: CGFloat, coneAngle: CGFloat?)
}

private struct SVGFilterRegion {
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat

}

private static func svgTransformedFilterRegion(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat, transform: CGAffineTransform) -> SVGFilterRegion {
    let points = [
        CGPoint(x: x, y: y).applying(transform),
        CGPoint(x: x + width, y: y).applying(transform),
        CGPoint(x: x, y: y + height).applying(transform),
        CGPoint(x: x + width, y: y + height).applying(transform),
    ]
    let xs = points.map(\\.x)
    let ys = points.map(\\.y)
    let minimumX = xs.min() ?? 0
    let minimumY = ys.min() ?? 0
    return SVGFilterRegion(x: minimumX, y: minimumY, width: max(0, (xs.max() ?? minimumX) - minimumX), height: max(0, (ys.max() ?? minimumY) - minimumY))
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
    case diffuseLighting(input: SVGFilterInput, surfaceScale: CGFloat, diffuseConstant: CGFloat, unitX: CGFloat?, unitY: CGFloat?, color: SVGFilterColor, light: SVGFilterLight?, region: SVGFilterRegion, linearRGB: Bool, result: String?)
    case specularLighting(input: SVGFilterInput, surfaceScale: CGFloat, specularConstant: CGFloat, specularExponent: CGFloat, unitX: CGFloat?, unitY: CGFloat?, color: SVGFilterColor, light: SVGFilterLight?, region: SVGFilterRegion, linearRGB: Bool, result: String?)
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
             let .diffuseLighting(_, _, _, _, _, _, _, region, _, _),
             let .specularLighting(_, _, _, _, _, _, _, _, region, _, _),
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
             let .diffuseLighting(_, _, _, _, _, _, _, _, value, _),
             let .specularLighting(_, _, _, _, _, _, _, _, _, value, _),
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
        Canvas { (context: inout GraphicsContext, size: CGSize) in
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

    private static func normalized(_ x: CGFloat, _ y: CGFloat, _ z: CGFloat) -> SVGFilterVector3 {
        let length = sqrt(x * x + y * y + z * z)
        guard length > 0 else { return SVGFilterVector3(x: 0, y: 0, z: 0) }
        return SVGFilterVector3(x: x / length, y: y / length, z: z / length)
    }

    private static func surfaceNormal(_ image: SVGFilterBitmap, x: Int, y: Int, surfaceScale: CGFloat, unitX: CGFloat?, unitY: CGFloat?, scaleX: CGFloat, scaleY: CGFloat, bounds: SVGFilterPixelRect) -> SVGFilterVector3 {
        let dx = unitX ?? 1 / scaleX
        let dy = unitY ?? 1 / scaleY
        let stepX = dx * scaleX
        let stepY = dy * scaleY
        let left = CGFloat(x) - stepX < CGFloat(bounds.minX)
        let right = CGFloat(x) + stepX >= CGFloat(bounds.maxX)
        let top = CGFloat(y) - stepY < CGFloat(bounds.minY)
        let bottom = CGFloat(y) + stepY >= CGFloat(bounds.maxY)
        guard !(left && right), !(top && bottom), dx > 0, dy > 0 else {
            return SVGFilterVector3(x: 0, y: 0, z: 1)
        }
        let differenceX: [Float] = left ? [0, -1, 1] : right ? [-1, 1, 0] : [-1, 0, 1]
        let smoothY: [Float] = top ? [0, 2, 1] : bottom ? [1, 2, 0] : [1, 2, 1]
        let differenceY: [Float] = top ? [0, -1, 1] : bottom ? [-1, 1, 0] : [-1, 0, 1]
        let smoothX: [Float] = left ? [0, 2, 1] : right ? [1, 2, 0] : [1, 2, 1]
        var sumX: Float = 0
        var sumY: Float = 0
        for row in 0..<3 {
            for column in 0..<3 {
                let alpha = sampleBilinear(
                    image,
                    x: CGFloat(x) + CGFloat(column - 1) * stepX,
                    y: CGFloat(y) + CGFloat(row - 1) * stepY,
                    edge: .none,
                    bounds: bounds
                )[3]
                sumX += smoothY[row] * differenceX[column] * alpha
                sumY += differenceY[row] * smoothX[column] * alpha
            }
        }
        let horizontalEdge = left || right
        let verticalEdge = top || bottom
        let factors: (CGFloat, CGFloat)
        switch (horizontalEdge, verticalEdge) {
        case (true, true): factors = (CGFloat(2) / 3, CGFloat(2) / 3)
        case (true, false): factors = (CGFloat(1) / 2, CGFloat(1) / 3)
        case (false, true): factors = (CGFloat(1) / 3, CGFloat(1) / 2)
        case (false, false): factors = (CGFloat(1) / 4, CGFloat(1) / 4)
        }
        return normalized(
            -surfaceScale * factors.0 * CGFloat(sumX) / dx,
            -surfaceScale * factors.1 * CGFloat(sumY) / dy,
            1
        )
    }

    private static func lightAt(_ light: SVGFilterLight, x: CGFloat, y: CGFloat, z: CGFloat) -> (SVGFilterVector3, CGFloat) {
        switch light {
        case let .distant(lightX, lightY, lightZ):
            return (normalized(lightX, lightY, lightZ), 1)
        case let .point(lightX, lightY, lightZ):
            return (normalized(lightX - x, lightY - y, lightZ - z), 1)
        case let .spot(lightX, lightY, lightZ, pointsAtX, pointsAtY, pointsAtZ, exponent, coneAngle):
            let direction = normalized(lightX - x, lightY - y, lightZ - z)
            let spot = normalized(pointsAtX - lightX, pointsAtY - lightY, pointsAtZ - lightZ)
            let cosine = -(direction.x * spot.x + direction.y * spot.y + direction.z * spot.z)
            guard cosine > 0 else { return (direction, 0) }
            if let coneAngle, cosine < cos(coneAngle * .pi / 180) { return (direction, 0) }
            return (direction, pow(cosine, exponent))
        }
    }

    private static func lighting(_ image: SVGFilterBitmap, diffuse: Bool, surfaceScale: CGFloat, constant: CGFloat, specularExponent: CGFloat, unitX: CGFloat?, unitY: CGFloat?, color: SVGFilterColor, light: SVGFilterLight?, scaleX: CGFloat, scaleY: CGFloat, bounds: SVGFilterPixelRect) -> SVGFilterBitmap {
        var result = SVGFilterBitmap(width: image.width, height: image.height)
        guard let light else { return result }
        let lightColor = [color.red, color.green, color.blue].map { Float(min(1, max(0, $0))) }
        let startY = max(0, bounds.minY)
        let endY = min(image.height, bounds.maxY)
        let startX = max(0, bounds.minX)
        let endX = min(image.width, bounds.maxX)
        guard startX < endX, startY < endY else { return result }
        for y in startY..<endY {
            for x in startX..<endX {
                let index = (y * image.width + x) * 4
                let height = surfaceScale * CGFloat(image.values[index + 3])
                let normal = surfaceNormal(image, x: x, y: y, surfaceScale: surfaceScale, unitX: unitX, unitY: unitY, scaleX: scaleX, scaleY: scaleY, bounds: bounds)
                let (direction, lightScale) = lightAt(light, x: CGFloat(x) / scaleX, y: CGFloat(y) / scaleY, z: height)
                let intensity: CGFloat
                if diffuse {
                    intensity = constant * max(0, normal.x * direction.x + normal.y * direction.y + normal.z * direction.z)
                } else {
                    let half = normalized(direction.x, direction.y, direction.z + 1)
                    intensity = constant * pow(max(0, normal.x * half.x + normal.y * half.y + normal.z * half.z), specularExponent)
                }
                let channels = lightColor.map { clamped($0 * Float(lightScale * intensity)) }
                if diffuse {
                    write([channels[0], channels[1], channels[2], 1], to: &result, x: x, y: y)
                } else {
                    let alpha = max(channels[0], channels[1], channels[2])
                    write([channels[0], channels[1], channels[2], alpha], to: &result, x: x, y: y)
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
            case let .diffuseLighting(value, surfaceScale, diffuseConstant, unitX, unitY, color, light, _, _, _):
                output = converted(lighting(
                    input(value),
                    diffuse: true,
                    surfaceScale: surfaceScale,
                    constant: diffuseConstant,
                    specularExponent: 1,
                    unitX: unitX,
                    unitY: unitY,
                    color: color,
                    light: light,
                    scaleX: scaleX,
                    scaleY: scaleY,
                    bounds: inputRegion(value)
                ), linear: linear, encode: true)
            case let .specularLighting(value, surfaceScale, specularConstant, specularExponent, unitX, unitY, color, light, _, _, _):
                output = converted(lighting(
                    input(value),
                    diffuse: false,
                    surfaceScale: surfaceScale,
                    constant: specularConstant,
                    specularExponent: specularExponent,
                    unitX: unitX,
                    unitY: unitY,
                    color: color,
                    light: light,
                    scaleX: scaleX,
                    scaleY: scaleY,
                    bounds: inputRegion(value)
                ), linear: linear, encode: true)
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

function eventTimingSupport(document: RenderDocument, indentationSize: number): string[] {
  const dynamic = dynamicTimingIds(document);
  if (dynamic.size === 0) return [];
  const indentation = " ".repeat(indentationSize);
  const staticIntervals = sampleSMILProgram(document.animationProgram, 0).intervals;
  const definitions = new Map(document.animationProgram.animations.map((animation) => [animation.stableId, animation]));
  const referencedDuration = (id: string): number => {
    const duration = definitions.get(id)?.timing.duration;
    return duration?.type === "seconds" ? duration.seconds : Number.POSITIVE_INFINITY;
  };
  const source = (time: AnimationTime, animation: AnimationDefinition): string => {
    if (time.type === "offset") return `[${swiftDuration(time.seconds)}]`;
    if (time.type === "syncbase")
      return `svgSyncbaseTimes(animationIntervals[${swiftString(time.animationId)}] ?? [], useEnd: ${time.phase === "end"}, offset: ${swiftDuration(time.offsetSeconds)})`;
    if (time.type === "repeat")
      return `svgRepeatTimes(animationIntervals[${swiftString(time.animationId)}] ?? [], duration: ${swiftDuration(referencedDuration(time.animationId))}, iteration: ${time.iteration}, offset: ${swiftDuration(time.offsetSeconds)})`;
    if (time.type === "repeatEvent")
      return `svgRepeatEventTimes(animationIntervals[${swiftString(time.animationId)}] ?? [], duration: ${swiftDuration(referencedDuration(time.animationId))}, offset: ${swiftDuration(time.offsetSeconds)})`;
    if (time.type === "event") {
      const targetId = time.targetId ?? animation.target?.source.id ?? animation.target?.key;
      return `svgEventTimes(events, name: ${swiftString(time.event.toLowerCase())}, targetID: ${targetId ? swiftString(targetId) : "nil"}, allowUntargeted: ${time.targetId === undefined}, offset: ${swiftDuration(time.offsetSeconds)})`;
    }
    return "[]";
  };
  const list = (times: readonly AnimationTime[], animation: AnimationDefinition) =>
    times.length === 0 ? "[]" : times.map((time) => source(time, animation)).join(" + ");
  const initial = document.animationProgram.animations
    .filter((animation) => !dynamic.has(animation.stableId))
    .map((animation) => {
      const intervals = staticIntervals.get(animation.stableId) ?? [];
      return `${indentation}${swiftString(animation.stableId)}: [${intervals
        .map((interval) => `(begin: ${swiftDuration(interval.begin)}, end: ${swiftDuration(interval.end)})`)
        .join(", ")}]`;
    })
    .join(`,\n`);
  const assignments = document.animationProgram.evaluationOrder.flatMap((id) => {
    if (!dynamic.has(id)) return [];
    const animation = definitions.get(id);
    if (!animation) return [];
    return [
      `${indentation}animationIntervals[${swiftString(id)}] = svgResolveIntervals(beginInstances: ${list(animation.timing.begin, animation)}, endInstances: ${list(animation.timing.end, animation)}, activeDuration: ${swiftDuration(computeSMILActiveDuration(animation.timing))}, restart: .${animation.timing.restart})`,
    ];
  });
  return [
    "struct SVGAnimationEvent: Hashable, Codable, Sendable {",
    `${indentation}struct Payload: Hashable, Codable, Sendable {`,
    `${indentation}${indentation}var x: Double?`,
    `${indentation}${indentation}var y: Double?`,
    `${indentation}${indentation}var button: Int?`,
    `${indentation}${indentation}var key: String?`,
    `${indentation}${indentation}init(x: Double? = nil, y: Double? = nil, button: Int? = nil, key: String? = nil) { self.x = x; self.y = y; self.button = button; self.key = key }`,
    `${indentation}}`,
    `${indentation}var time: Double`,
    `${indentation}var name: String`,
    `${indentation}var targetID: String?`,
    `${indentation}var repeatIteration: Int?`,
    `${indentation}var order: Int?`,
    `${indentation}var payload: Payload?`,
    `${indentation}init(time: Double, name: String, targetID: String? = nil, repeatIteration: Int? = nil, order: Int? = nil, payload: Payload? = nil) { self.time = time; self.name = name; self.targetID = targetID; self.repeatIteration = repeatIteration; self.order = order; self.payload = payload }`,
    "}",
    "",
    "private struct SVGFocusEventModifier: ViewModifier {",
    `${indentation}@FocusState private var focused: Bool`,
    `${indentation}let changed: (Bool) -> Void`,
    `${indentation}init(changed: @escaping (Bool) -> Void) { self.changed = changed }`,
    `${indentation}func body(content: Content) -> some View {`,
    `${indentation}${indentation}content.focusable().focused($focused).onChange(of: focused) { changed($0) }`,
    `${indentation}}`,
    "}",
    "",
    "private enum SVGAnimationRestart: Equatable { case always, whenNotActive, never }",
    "",
    "private static func svgAnimationIntervals(events: [SVGAnimationEvent]) -> [String: [(begin: Double, end: Double)]] {",
    `${indentation}var animationIntervals: [String: [(begin: Double, end: Double)]] = ${initial ? `[\n${initial}\n]` : "[:]"}`,
    ...assignments,
    `${indentation}return animationIntervals`,
    "}",
    "",
    "private static func svgEventTimes(_ events: [SVGAnimationEvent], name: String, targetID: String?, allowUntargeted: Bool, offset: Double) -> [Double] {",
    `${indentation}events.enumerated()`,
    `${indentation}${indentation}.filter { $0.element.time.isFinite && $0.element.name.lowercased() == name && ($0.element.targetID == targetID || (allowUntargeted && $0.element.targetID == nil)) }`,
    `${indentation}${indentation}.sorted { left, right in left.element.time != right.element.time ? left.element.time < right.element.time : (left.element.order ?? left.offset) != (right.element.order ?? right.offset) ? (left.element.order ?? left.offset) < (right.element.order ?? right.offset) : left.offset < right.offset }`,
    `${indentation}${indentation}.map { $0.element.time + offset }`,
    "}",
    "",
    "private static func svgSyncbaseTimes(_ intervals: [(begin: Double, end: Double)], useEnd: Bool, offset: Double) -> [Double] {",
    `${indentation}intervals.compactMap { let value = (useEnd ? $0.end : $0.begin) + offset; return value.isFinite ? value : nil }`,
    "}",
    "",
    "private static func svgRepeatTimes(_ intervals: [(begin: Double, end: Double)], duration: Double, iteration: Int, offset: Double) -> [Double] {",
    `${indentation}guard duration.isFinite && duration > 0 && iteration > 0 else { return [] }`,
    `${indentation}return intervals.compactMap { let value = $0.begin + duration * Double(iteration); return value < $0.end - 0.000000000001 ? value + offset : nil }`,
    "}",
    "",
    "private static func svgRepeatEventTimes(_ intervals: [(begin: Double, end: Double)], duration: Double, offset: Double) -> [Double] {",
    `${indentation}guard duration.isFinite && duration > 0 else { return [] }`,
    `${indentation}return intervals.flatMap { interval in`,
    `${indentation}${indentation}var values: [Double] = []`,
    `${indentation}${indentation}var iteration = 1`,
    `${indentation}${indentation}while interval.begin + duration * Double(iteration) < interval.end - 0.000000000001 { values.append(interval.begin + duration * Double(iteration) + offset); iteration += 1 }`,
    `${indentation}${indentation}return values`,
    `${indentation}}`,
    "}",
    "",
    "private static func svgResolveIntervals(beginInstances: [Double], endInstances: [Double], activeDuration: Double, restart: SVGAnimationRestart) -> [(begin: Double, end: Double)] {",
    `${indentation}let begins = Array(Set(beginInstances.filter { $0.isFinite })).sorted()`,
    `${indentation}let ends = Array(Set(endInstances.filter { $0.isFinite })).sorted()`,
    `${indentation}var intervals: [(begin: Double, end: Double)] = []`,
    `${indentation}for begin in begins {`,
    `${indentation}${indentation}if let previous = intervals.last {`,
    `${indentation}${indentation}${indentation}if restart == .never { continue }`,
    `${indentation}${indentation}${indentation}let active = begin < previous.end - 0.000000000001`,
    `${indentation}${indentation}${indentation}if active && restart == .whenNotActive { continue }`,
    `${indentation}${indentation}${indentation}if active && restart == .always { intervals[intervals.count - 1].end = begin }`,
    `${indentation}${indentation}}`,
    `${indentation}${indentation}let naturalEnd = activeDuration.isFinite ? begin + activeDuration : .infinity`,
    `${indentation}${indentation}let explicitEnd = ends.first { $0 >= begin - 0.000000000001 } ?? .infinity`,
    `${indentation}${indentation}intervals.append((begin: begin, end: min(naturalEnd, explicitEnd)))`,
    `${indentation}}`,
    `${indentation}return intervals`,
    "}",
  ];
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
    ...(helper.animated ? [`${indentation}let documentTime: Double`, ""] : []),
    ...(helper.animated && helper.eventDriven
      ? [`${indentation}let animationIntervals: [String: [(begin: Double, end: Double)]]`, ""]
      : []),
    `${indentation}var body: some View {`,
    `${i2}Canvas { (context: inout GraphicsContext, size: CGSize) in`,
    `${i3}context.clip(to: Path(CGRect(x: ${formatNumber(node.viewport.x)}, y: ${formatNumber(node.viewport.y)}, width: ${formatNumber(node.viewport.width)}, height: ${formatNumber(node.viewport.height)})).applying(${runtimeTransform(helper.transform, coordinateSpace)}))`,
    `${i3}context.transform = ${helper.transformExpression ?? runtimeTransform(imageTransform, coordinateSpace)}`,
  ];
  if (quality !== "default") body.push(`${i3}context.withCGContext { $0.interpolationQuality = .${quality} }`);
  if (resource.type === "svg") {
    body.push(
      `${i3}if let image = context.resolveSymbol(id: 0) {`,
      `${i4}context.draw(image, in: CGRect(x: 0, y: 0, width: ${formatNumber(intrinsic.width)}, height: ${formatNumber(intrinsic.height)}))`,
      `${i3}}`,
      `${i2}} symbols: {`,
      `${i3}${helper.subdocumentName!}${helper.subdocumentAnimated ? "(documentTime: documentTime)" : "()"}`,
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
    ...(helper.animated ? [`${indentation}let documentTime: Double`, ""] : []),
    `${indentation}var body: some View {`,
    `${i2}Canvas { (context: inout GraphicsContext, size: CGSize) in`,
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
      `${i3}${helper.subdocumentName!}${helper.animated ? "(documentTime: documentTime)" : "()"}`,
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

function gradientSupport(indentationSize: number, animated: boolean): string[] {
  const indentation = " ".repeat(indentationSize);
  return [
    "private struct SVGGradientStop {",
    `${indentation}let offset: CGFloat`,
    `${indentation}let red: CGFloat`,
    `${indentation}let green: CGFloat`,
    `${indentation}let blue: CGFloat`,
    `${indentation}let alpha: CGFloat`,
    "}",
    ...(animated
      ? [
          "",
          "private static func svgAnimatedGradientStop(offset: SVGAnimationRuntimeValue, color: SVGAnimationRuntimeValue, opacity: SVGAnimationRuntimeValue, paintOpacity: Double) -> SVGGradientStop {",
          `${indentation}func encoded(_ component: Double) -> Double { component <= 0.0031308 ? component * 12.92 : 1.055 * pow(component, 1 / 2.4) - 0.055 }`,
          `${indentation}let values = color.components + [0, 0, 0, 1]`,
          `${indentation}let linear = color.signature == "linearRGB"`,
          `${indentation}let alpha = values[3] * svgAnimationNumber(opacity) * paintOpacity`,
          `${indentation}return SVGGradientStop(offset: CGFloat(min(1, max(0, svgAnimationNumber(offset)))), red: CGFloat(min(1, max(0, linear ? encoded(values[0]) : values[0]))), green: CGFloat(min(1, max(0, linear ? encoded(values[1]) : values[1]))), blue: CGFloat(min(1, max(0, linear ? encoded(values[2]) : values[2]))), alpha: CGFloat(min(1, max(0, alpha))))`,
          "}",
          "",
          "private static func svgNormalizedGradientStops(_ stops: [SVGGradientStop]) -> [SVGGradientStop] {",
          `${indentation}var previous: CGFloat = 0`,
          `${indentation}return stops.map { stop in`,
          `${indentation}${indentation}let offset = max(previous, min(1, max(0, stop.offset)))`,
          `${indentation}${indentation}previous = offset`,
          `${indentation}${indentation}return SVGGradientStop(offset: offset, red: stop.red, green: stop.green, blue: stop.blue, alpha: stop.alpha)`,
          `${indentation}}`,
          "}",
        ]
      : []),
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
  const eventDriven = dynamicTimingIds(document).size > 0;
  const animated =
    document.animationProgram.animations.length > 0 ||
    imageHelpers.some((helper) => helper.animated) ||
    filterImageHelpers.some((helper) => helper.animated);
  const content = [
    ...(eventDriven
      ? [`${indentation}let animationIntervals = Self.svgAnimationIntervals(events: animationEvents)`]
      : []),
    `${indentation}ZStack {`,
    ...nodes.flatMap((node) => renderViewNode(node, 2, indentation)),
    `${indentation}}`,
  ];
  const body: string[] = animated
    ? [
        "private let documentTime: Double?",
        "private let respectsReducedMotion: Bool",
        ...(eventDriven ? ["private let suppliedAnimationEvents: [SVGAnimationEvent]"] : []),
        "@StateObject private var animationClock = AnimationClockState()",
        ...(eventDriven
          ? [
              "@State private var interactionAnimationEvents: [SVGAnimationEvent] = []",
              "@State private var nextAnimationEventOrder = 0",
              "@State private var activePointerTargets: Set<String> = []",
            ]
          : []),
        "@Environment(\\.scenePhase) private var scenePhase",
        "@Environment(\\.accessibilityReduceMotion) private var reduceMotion",
        "",
        eventDriven
          ? "init(documentTime: Double? = nil, animationEvents: [SVGAnimationEvent] = [], respectsReducedMotion: Bool = false) {"
          : "init(documentTime: Double? = nil, respectsReducedMotion: Bool = false) {",
        `${indentation}self.documentTime = documentTime`,
        `${indentation}self.respectsReducedMotion = respectsReducedMotion`,
        ...(eventDriven ? [`${indentation}self.suppliedAnimationEvents = animationEvents`] : []),
        "}",
        "",
        "@ViewBuilder",
        eventDriven
          ? "private func content(at documentTime: Double, animationEvents: [SVGAnimationEvent]) -> some View {"
          : "private func content(at documentTime: Double) -> some View {",
        ...content,
        "}",
        "",
        "var body: some View {",
        `${indentation}if let documentTime {`,
        `${indentation}${indentation}content(at: Self.sanitizedDocumentTime(documentTime)${eventDriven ? ", animationEvents: suppliedAnimationEvents + interactionAnimationEvents" : ""})`,
        `${indentation}} else if respectsReducedMotion && reduceMotion {`,
        `${indentation}${indentation}content(at: 0${eventDriven ? ", animationEvents: suppliedAnimationEvents + interactionAnimationEvents" : ""})`,
        `${indentation}} else {`,
        `${indentation}${indentation}TimelineView(.animation(paused: scenePhase != .active)) { timeline in`,
        `${indentation}${indentation}${indentation}content(at: animationClock.sample(date: timeline.date, isActive: scenePhase == .active)${eventDriven ? ", animationEvents: suppliedAnimationEvents + interactionAnimationEvents" : ""})`,
        `${indentation}${indentation}}`,
        `${indentation}}`,
        "}",
        "",
        "private static func sanitizedDocumentTime(_ value: Double) -> Double {",
        `${indentation}value.isFinite ? value : 0`,
        "}",
        "",
        ...(document.animationProgram.animations.some((animation) => animation.kind === "discard")
          ? [
              "private static func svgIsDiscarded(documentTime: Double, intervals: [(begin: Double, end: Double)]) -> Bool {",
              `${indentation}let time = sanitizedDocumentTime(documentTime)`,
              `${indentation}return intervals.contains { time >= $0.begin }`,
              "}",
              "",
            ]
          : []),
        ...(eventDriven
          ? [
              "private func recordAnimationEvent(name: String, targetID: String, documentTime: Double) {",
              `${indentation}let event = SVGAnimationEvent(time: Self.sanitizedDocumentTime(documentTime), name: name.lowercased(), targetID: targetID, order: nextAnimationEventOrder)`,
              `${indentation}nextAnimationEventOrder += 1`,
              `${indentation}interactionAnimationEvents.append(event)`,
              `${indentation}if interactionAnimationEvents.count > 4096 { interactionAnimationEvents.removeFirst(interactionAnimationEvents.count - 4096) }`,
              "}",
              "",
              "private func recordPointerTransition(targetID: String, names: [String], active: Bool, documentTime: Double) {",
              `${indentation}if active {`,
              `${indentation}${indentation}guard activePointerTargets.insert(targetID).inserted else { return }`,
              `${indentation}} else {`,
              `${indentation}${indentation}guard activePointerTargets.remove(targetID) != nil else { return }`,
              `${indentation}}`,
              `${indentation}for name in names { recordAnimationEvent(name: name, targetID: targetID, documentTime: documentTime) }`,
              "}",
              "",
              ...eventTimingSupport(document, indentationSize),
              "",
            ]
          : []),
        "private enum SVGTimingState: Equatable { case inactive, active, frozen, completed }",
        "",
        "private struct SVGTimingSample {",
        `${indentation}let state: SVGTimingState`,
        `${indentation}let simpleTime: Double?`,
        `${indentation}let simpleProgress: Double?`,
        `${indentation}let activeDuration: Double`,
        `${indentation}let simpleDuration: Double`,
        `${indentation}let repeatIteration: Int`,
        `${indentation}let isBeginBoundary: Bool`,
        `${indentation}let isEndBoundary: Bool`,
        `${indentation}let isRepeatBoundary: Bool`,
        `${indentation}let selectedBegin: Double?`,
        `${indentation}let intervalBegin: Double?`,
        `${indentation}let intervalEnd: Double?`,
        "}",
        "",
        "private static func svgTimingSample(documentTime: Double, intervals: [(begin: Double, end: Double)], duration: Double, repeatingDuration: Double, freeze: Bool) -> SVGTimingSample {",
        `${indentation}let time = sanitizedDocumentTime(documentTime)`,
        `${indentation}let active = intervals.first { time >= $0.begin && time < $0.end }`,
        `${indentation}let completed = intervals.last { time >= $0.end }`,
        `${indentation}guard let interval = active ?? completed else {`,
        `${indentation}${indentation}return SVGTimingSample(state: .inactive, simpleTime: nil, simpleProgress: nil, activeDuration: 0, simpleDuration: duration, repeatIteration: 0, isBeginBoundary: false, isEndBoundary: false, isRepeatBoundary: false, selectedBegin: nil, intervalBegin: nil, intervalEnd: nil)`,
        `${indentation}}`,
        `${indentation}let atEnd = active == nil`,
        `${indentation}let hasFutureInterval = intervals.contains { time < $0.begin }`,
        `${indentation}let activeDuration = max(0, interval.end - interval.begin)`,
        `${indentation}let elapsed = max(0, (atEnd ? interval.end : time) - interval.begin)`,
        `${indentation}if !atEnd && elapsed > repeatingDuration && !freeze {`,
        `${indentation}${indentation}return SVGTimingSample(state: .active, simpleTime: nil, simpleProgress: nil, activeDuration: activeDuration, simpleDuration: duration, repeatIteration: max(0, Int(ceil(repeatingDuration / max(duration, 1))) - 1), isBeginBoundary: false, isEndBoundary: false, isRepeatBoundary: false, selectedBegin: interval.begin, intervalBegin: interval.begin, intervalEnd: interval.end)`,
        `${indentation}}`,
        `${indentation}let presentationElapsed = freeze ? min(elapsed, repeatingDuration) : elapsed`,
        `${indentation}let quotient = duration > 0 && duration.isFinite ? presentationElapsed / duration : 0`,
        `${indentation}let rounded = quotient.rounded()`,
        `${indentation}let exactRepeat = presentationElapsed > 0 && abs(quotient - rounded) <= 0.000000000001`,
        `${indentation}let iteration: Int`,
        `${indentation}let simpleTime: Double`,
        `${indentation}let progress: Double`,
        `${indentation}if duration <= 0 {`,
        `${indentation}${indentation}iteration = 0`,
        `${indentation}${indentation}simpleTime = 0`,
        `${indentation}${indentation}progress = 1`,
        `${indentation}} else if !duration.isFinite {`,
        `${indentation}${indentation}iteration = 0`,
        `${indentation}${indentation}simpleTime = presentationElapsed`,
        `${indentation}${indentation}progress = 0`,
        `${indentation}} else if atEnd && exactRepeat {`,
        `${indentation}${indentation}iteration = max(0, Int(rounded) - 1)`,
        `${indentation}${indentation}simpleTime = duration`,
        `${indentation}${indentation}progress = 1`,
        `${indentation}} else {`,
        `${indentation}${indentation}iteration = max(0, Int(floor(quotient + 0.000000000001)))`,
        `${indentation}${indentation}simpleTime = max(0, presentationElapsed - Double(iteration) * duration)`,
        `${indentation}${indentation}progress = min(1, max(0, simpleTime / duration))`,
        `${indentation}}`,
        `${indentation}return SVGTimingSample(state: atEnd ? (freeze && !hasFutureInterval ? .frozen : .completed) : .active, simpleTime: simpleTime, simpleProgress: progress, activeDuration: activeDuration, simpleDuration: duration, repeatIteration: iteration, isBeginBoundary: intervals.contains { abs(time - $0.begin) <= 0.000000000001 }, isEndBoundary: intervals.contains { abs(time - $0.end) <= 0.000000000001 }, isRepeatBoundary: !atEnd && exactRepeat, selectedBegin: interval.begin, intervalBegin: interval.begin, intervalEnd: interval.end)`,
        "}",
        "",
        "enum SVGAnimationForm { case values, fromto, fromby, by, to }",
        "enum SVGAnimationCalcMode { case discrete, linear, paced, spline }",
        "enum SVGAnimationClamp { case none, unit, nonnegative, integer }",
        "enum SVGCSSAnimationDirection { case normal, reverse, alternate, alternateReverse }",
        "enum SVGCSSAnimationFillMode { case none, forwards, backwards, both }",
        "enum SVGCSSAnimationPlayState { case running, paused }",
        "enum SVGCSSTimingKind { case linear, cubic, steps }",
        "enum SVGSStepPosition { case jumpStart, jumpEnd, jumpNone, jumpBoth }",
        "struct SVGCSSTimingFunction { let kind: SVGCSSTimingKind; var x1 = 0.0; var y1 = 0.0; var x2 = 1.0; var y2 = 1.0; var count = 1; var position = SVGSStepPosition.jumpEnd }",
        "enum SVGAnimationMotionRotate { case auto, autoReverse, angle }",
        "struct SVGAnimationMotionPoint { let x: Double; let y: Double; let distance: Double; let move: Bool }",
        "enum SVGAnimationRuntimeValueKind { case number, integer, opacity, length, angle, color, numberList, lengthList, points, paintColor, path, viewBox, transform, discrete }",
        "struct SVGAnimationRuntimeValue {",
        `${indentation}let kind: SVGAnimationRuntimeValueKind`,
        `${indentation}let components: [Double]`,
        `${indentation}let signature: String`,
        `${indentation}let source: String`,
        "}",
        "",
        "private static func svgCubic(_ first: Double, _ second: Double, _ time: Double) -> Double {",
        `${indentation}let inverse = 1 - time`,
        `${indentation}return 3 * inverse * inverse * time * first + 3 * inverse * time * time * second + time * time * time`,
        "}",
        "",
        "private static func svgCubicDerivative(_ first: Double, _ second: Double, _ time: Double) -> Double {",
        `${indentation}let inverse = 1 - time`,
        `${indentation}return 3 * inverse * inverse * first + 6 * inverse * time * (second - first) + 3 * time * time * (1 - second)`,
        "}",
        "",
        "private static func svgSplineProgress(_ progress: Double, _ spline: (x1: Double, y1: Double, x2: Double, y2: Double)) -> Double {",
        `${indentation}let target = min(1, max(0, progress))`,
        `${indentation}if target == 0 || target == 1 { return target }`,
        `${indentation}var parameter = target`,
        `${indentation}for _ in 0..<8 {`,
        `${indentation}${indentation}let error = svgCubic(spline.x1, spline.x2, parameter) - target`,
        `${indentation}${indentation}if abs(error) <= 0.000000001 { return svgCubic(spline.y1, spline.y2, parameter) }`,
        `${indentation}${indentation}let derivative = svgCubicDerivative(spline.x1, spline.x2, parameter)`,
        `${indentation}${indentation}if abs(derivative) < 0.00000001 { break }`,
        `${indentation}${indentation}let next = parameter - error / derivative`,
        `${indentation}${indentation}if next <= 0 || next >= 1 { break }`,
        `${indentation}${indentation}parameter = next`,
        `${indentation}}`,
        `${indentation}var lower = 0.0`,
        `${indentation}var upper = 1.0`,
        `${indentation}for _ in 0..<32 {`,
        `${indentation}${indentation}parameter = (lower + upper) / 2`,
        `${indentation}${indentation}if svgCubic(spline.x1, spline.x2, parameter) < target { lower = parameter } else { upper = parameter }`,
        `${indentation}}`,
        `${indentation}return svgCubic(spline.y1, spline.y2, (lower + upper) / 2)`,
        "}",
        "",
        "static func svgAnimationValueSample(progress: Double, values authoredValues: [Double], form: SVGAnimationForm, calcMode: SVGAnimationCalcMode, keyTimes: [Double], keySplines: [(x1: Double, y1: Double, x2: Double, y2: Double)], additive: Bool, accumulate: Bool, repeatIteration: Int, clamp: SVGAnimationClamp, underlying: Double) -> Double {",
        `${indentation}var values = authoredValues`,
        `${indentation}if form == .to {`,
        `${indentation}${indentation}guard let target = authoredValues.first else { return underlying }`,
        `${indentation}${indentation}values = [underlying, target]`,
        `${indentation}}`,
        `${indentation}guard values.count >= 2 else { return values.first ?? underlying }`,
        `${indentation}var mode = calcMode`,
        `${indentation}var times: [Double]`,
        `${indentation}if mode == .paced {`,
        `${indentation}${indentation}let distances = zip(values, values.dropFirst()).map { abs($1 - $0) }`,
        `${indentation}${indentation}let total = distances.reduce(0, +)`,
        `${indentation}${indentation}if total <= 0 {`,
        `${indentation}${indentation}${indentation}mode = .linear`,
        `${indentation}${indentation}${indentation}times = values.indices.map { Double($0) / Double(values.count - 1) }`,
        `${indentation}${indentation}} else {`,
        `${indentation}${indentation}${indentation}var elapsed = 0.0`,
        `${indentation}${indentation}${indentation}times = [0] + distances.map { distance in elapsed += distance; return elapsed / total }`,
        `${indentation}${indentation}}`,
        `${indentation}} else {`,
        `${indentation}${indentation}times = keyTimes.count == values.count ? keyTimes : values.indices.map { Double($0) / Double(values.count - 1) }`,
        `${indentation}}`,
        `${indentation}var effect: Double`,
        `${indentation}if mode == .discrete {`,
        `${indentation}${indentation}let index: Int`,
        `${indentation}${indentation}if keyTimes.count == values.count {`,
        `${indentation}${indentation}${indentation}index = keyTimes.indices.last { progress + 0.000000000001 >= keyTimes[$0] } ?? 0`,
        `${indentation}${indentation}} else {`,
        `${indentation}${indentation}${indentation}index = min(values.count - 1, Int(floor(progress * Double(values.count) + 0.000000000001)))`,
        `${indentation}${indentation}}`,
        `${indentation}${indentation}effect = values[index]`,
        `${indentation}} else {`,
        `${indentation}${indentation}var segment = 0`,
        `${indentation}${indentation}if progress >= 1 {`,
        `${indentation}${indentation}${indentation}segment = values.count - 2`,
        `${indentation}${indentation}} else {`,
        `${indentation}${indentation}${indentation}while segment + 1 < times.count - 1 && progress >= times[segment + 1] - 0.000000000001 { segment += 1 }`,
        `${indentation}${indentation}}`,
        `${indentation}${indentation}let start = times[segment]`,
        `${indentation}${indentation}let end = times[segment + 1]`,
        `${indentation}${indentation}var local = progress >= 1 ? 1 : (end <= start ? 1 : min(1, max(0, (progress - start) / (end - start))))`,
        `${indentation}${indentation}if mode == .spline && segment < keySplines.count { local = svgSplineProgress(local, keySplines[segment]) }`,
        `${indentation}${indentation}effect = values[segment] + (values[segment + 1] - values[segment]) * local`,
        `${indentation}}`,
        `${indentation}if accumulate && repeatIteration > 0 { effect += values.last! * Double(repeatIteration) }`,
        `${indentation}var result = additive && form != .to ? underlying + effect : effect`,
        `${indentation}switch clamp {`,
        `${indentation}case .none: break`,
        `${indentation}case .unit: result = min(1, max(0, result))`,
        `${indentation}case .nonnegative: result = max(0, result)`,
        `${indentation}case .integer: result = floor(result + 0.5)`,
        `${indentation}}`,
        `${indentation}return result`,
        "}",
        "",
        "private static func svgAnimationNumber(_ value: SVGAnimationRuntimeValue) -> Double {",
        `${indentation}value.components.first ?? 0`,
        "}",
        "",
        "private static func svgAnimationComponent(_ value: SVGAnimationRuntimeValue, index: Int) -> Double {",
        `${indentation}guard !value.components.isEmpty else { return 0 }`,
        `${indentation}return value.components[min(index, value.components.count - 1)]`,
        "}",
        "",
        ...(containsFilterNode(nodes)
          ? [
              "private static func svgAnimationFilterColor(_ value: SVGAnimationRuntimeValue, opacity: Double) -> SVGFilterColor {",
              `${indentation}func encoded(_ channel: Double) -> Double { channel <= 0.0031308 ? channel * 12.92 : 1.055 * pow(channel, 1 / 2.4) - 0.055 }`,
              `${indentation}let components = value.components + [0, 0, 0, 1]`,
              `${indentation}let linear = value.signature == "linearRGB"`,
              `${indentation}return SVGFilterColor(red: min(1, max(0, linear ? encoded(components[0]) : components[0])), green: min(1, max(0, linear ? encoded(components[1]) : components[1])), blue: min(1, max(0, linear ? encoded(components[2]) : components[2])), alpha: min(1, max(0, components[3] * opacity)))`,
              "}",
              "",
            ]
          : []),
        "private static func svgAnimationSource(_ value: SVGAnimationRuntimeValue) -> String { value.source }",
        "",
        "private static func svgAnimationLengths(_ value: SVGAnimationRuntimeValue, scale: CGFloat) -> [CGFloat] {",
        `${indentation}value.components.map { CGFloat($0) * scale }`,
        "}",
        "",
        "private static func svgStrokeLineCap(_ value: String) -> CGLineCap {",
        `${indentation}value == "round" ? .round : value == "square" ? .square : .butt`,
        "}",
        "",
        "private static func svgStrokeLineJoin(_ value: String) -> CGLineJoin {",
        `${indentation}value == "round" ? .round : value == "bevel" ? .bevel : .miter`,
        "}",
        "",
        "private static func svgMultiplyTransform(_ left: CGAffineTransform, _ right: CGAffineTransform) -> CGAffineTransform {",
        `${indentation}CGAffineTransform(a: left.a * right.a + left.c * right.b, b: left.b * right.a + left.d * right.b, c: left.a * right.c + left.c * right.d, d: left.b * right.c + left.d * right.d, tx: left.a * right.tx + left.c * right.ty + left.tx, ty: left.b * right.tx + left.d * right.ty + left.ty)`,
        "}",
        "",
        "private static func svgAnimationTransform(_ value: SVGAnimationRuntimeValue) -> CGAffineTransform {",
        `${indentation}guard value.kind == .transform else { return .identity }`,
        `${indentation}var result = CGAffineTransform.identity`,
        `${indentation}var offset = 0`,
        `${indentation}for entry in value.signature.split(separator: ";").map(String.init) {`,
        `${indentation}${indentation}let digits = String(entry.reversed().prefix { $0.isNumber }.reversed())`,
        `${indentation}${indentation}let count = Int(digits) ?? 0`,
        `${indentation}${indentation}let kind = String(entry.dropLast(digits.count))`,
        `${indentation}${indentation}guard offset + count <= value.components.count else { return result }`,
        `${indentation}${indentation}let values = Array(value.components[offset..<(offset + count)])`,
        `${indentation}${indentation}offset += count`,
        `${indentation}${indentation}let component: CGAffineTransform`,
        `${indentation}${indentation}switch kind {`,
        `${indentation}${indentation}case "matrix": component = values.count == 6 ? CGAffineTransform(a: values[0], b: values[1], c: values[2], d: values[3], tx: values[4], ty: values[5]) : .identity`,
        `${indentation}${indentation}case "translate": component = CGAffineTransform(translationX: values.first ?? 0, y: values.count > 1 ? values[1] : 0)`,
        `${indentation}${indentation}case "scale": component = CGAffineTransform(scaleX: values.first ?? 0, y: values.count > 1 ? values[1] : (values.first ?? 0))`,
        `${indentation}${indentation}case "rotate":`,
        `${indentation}${indentation}${indentation}let angle = (values.first ?? 0) * .pi / 180`,
        `${indentation}${indentation}${indentation}let cosine = cos(angle); let sine = sin(angle)`,
        `${indentation}${indentation}${indentation}let centerX = values.count > 1 ? values[1] : 0; let centerY = values.count > 2 ? values[2] : 0`,
        `${indentation}${indentation}${indentation}component = CGAffineTransform(a: cosine, b: sine, c: -sine, d: cosine, tx: centerX - centerX * cosine + centerY * sine, ty: centerY - centerX * sine - centerY * cosine)`,
        `${indentation}${indentation}case "skewX": component = CGAffineTransform(a: 1, b: 0, c: tan((values.first ?? 0) * .pi / 180), d: 1, tx: 0, ty: 0)`,
        `${indentation}${indentation}case "skewY": component = CGAffineTransform(a: 1, b: tan((values.first ?? 0) * .pi / 180), c: 0, d: 1, tx: 0, ty: 0)`,
        `${indentation}${indentation}default: component = .identity`,
        `${indentation}${indentation}}`,
        `${indentation}${indentation}result = svgMultiplyTransform(result, component)`,
        `${indentation}}`,
        `${indentation}return result`,
        "}",
        "",
        "private static func svgViewBoxMatrix(_ value: SVGAnimationRuntimeValue, rect: CGRect, preserveAspectRatio: String) -> CGAffineTransform {",
        `${indentation}let box = value.components + [0, 0, 1, 1]`,
        `${indentation}let boxWidth = max(0.000000000001, box[2])`,
        `${indentation}let boxHeight = max(0.000000000001, box[3])`,
        `${indentation}var scaleX = Double(rect.width) / boxWidth`,
        `${indentation}var scaleY = Double(rect.height) / boxHeight`,
        `${indentation}let tokens = preserveAspectRatio.split(separator: " ").map(String.init)`,
        `${indentation}let align = tokens.first(where: { $0 == "none" || $0.hasPrefix("x") }) ?? "xMidYMid"`,
        `${indentation}if align != "none" {`,
        `${indentation}${indentation}let scale = tokens.contains("slice") ? max(scaleX, scaleY) : min(scaleX, scaleY)`,
        `${indentation}${indentation}scaleX = scale; scaleY = scale`,
        `${indentation}}`,
        `${indentation}let remainingX = Double(rect.width) - boxWidth * scaleX`,
        `${indentation}let remainingY = Double(rect.height) - boxHeight * scaleY`,
        `${indentation}let alignX = align.contains("xMid") ? remainingX / 2 : align.contains("xMax") ? remainingX : 0`,
        `${indentation}let alignY = align.contains("YMid") ? remainingY / 2 : align.contains("YMax") ? remainingY : 0`,
        `${indentation}return CGAffineTransform(a: scaleX, b: 0, c: 0, d: scaleY, tx: Double(rect.minX) + alignX - box[0] * scaleX, ty: Double(rect.minY) + alignY - box[1] * scaleY)`,
        "}",
        "",
        "private static func svgOutputTransform(_ value: CGAffineTransform, size: CGSize, coordinateSpace: CGRect) -> CGAffineTransform {",
        `${indentation}let width = max(0.000000000001, coordinateSpace.width)`,
        `${indentation}let height = max(0.000000000001, coordinateSpace.height)`,
        `${indentation}let outputWidth = max(0.000000000001, size.width)`,
        `${indentation}let outputHeight = max(0.000000000001, size.height)`,
        `${indentation}let tx = (value.a * coordinateSpace.minX + value.c * coordinateSpace.minY + value.tx - coordinateSpace.minX) / width * outputWidth`,
        `${indentation}let ty = (value.b * coordinateSpace.minX + value.d * coordinateSpace.minY + value.ty - coordinateSpace.minY) / height * outputHeight`,
        `${indentation}return CGAffineTransform(a: value.a, b: value.b * width / height * outputHeight / outputWidth, c: value.c * height / width * outputWidth / outputHeight, d: value.d, tx: tx, ty: ty)`,
        "}",
        "",
        "private static func svgAnimatedViewBoxTransform(value: SVGAnimationRuntimeValue, base: SVGAnimationRuntimeValue, rect: CGRect, outer: CGAffineTransform, staticTransform: CGAffineTransform, outputSize: CGSize, coordinateSpace: CGRect, preserveAspectRatio: String) -> CGAffineTransform {",
        `${indentation}let animatedUser = svgMultiplyTransform(outer, svgViewBoxMatrix(value, rect: rect, preserveAspectRatio: preserveAspectRatio))`,
        `${indentation}let animatedOutput = svgOutputTransform(animatedUser, size: outputSize, coordinateSpace: coordinateSpace)`,
        `${indentation}let staticOutput = svgOutputTransform(staticTransform, size: outputSize, coordinateSpace: coordinateSpace)`,
        `${indentation}return svgMultiplyTransform(animatedOutput, staticOutput.inverted())`,
        "}",
        "",
        "private static func svgAnimatedTransformCorrection(animatedBase: CGAffineTransform, animatedMotion: CGAffineTransform, animatedSuffix: CGAffineTransform, originX: Double, originY: Double, ancestors: CGAffineTransform, staticTransform: CGAffineTransform, outputSize: CGSize, coordinateSpace: CGRect) -> CGAffineTransform {",
        `${indentation}let origin = CGAffineTransform(translationX: originX, y: originY)`,
        `${indentation}let centeredBase = svgMultiplyTransform(origin, svgMultiplyTransform(animatedBase, CGAffineTransform(translationX: -originX, y: -originY)))`,
        `${indentation}let target = svgMultiplyTransform(centeredBase, svgMultiplyTransform(animatedMotion, animatedSuffix))`,
        `${indentation}let animatedUser = svgMultiplyTransform(ancestors, target)`,
        `${indentation}let animatedOutput = svgOutputTransform(animatedUser, size: outputSize, coordinateSpace: coordinateSpace)`,
        `${indentation}let staticOutput = svgOutputTransform(staticTransform, size: outputSize, coordinateSpace: coordinateSpace)`,
        `${indentation}return svgMultiplyTransform(animatedOutput, staticOutput.inverted())`,
        "}",
        "",
        "private static func svgMotionSample(points: [SVGAnimationMotionPoint], length: Double, fraction: Double) -> (x: Double, y: Double, angle: Double) {",
        `${indentation}guard let first = points.first else { return (0, 0, 0) }`,
        `${indentation}let distance = min(max(0, fraction), 1) * max(0, length)`,
        `${indentation}var low = 0; var high = points.count - 1`,
        `${indentation}while low < high { let middle = (low + high) / 2; if points[middle].distance < distance - 0.000000000001 { low = middle + 1 } else { high = middle } }`,
        `${indentation}var upper = low`,
        `${indentation}while upper + 1 < points.count && points[upper + 1].distance <= distance + 0.000000000001 { upper += 1 }`,
        `${indentation}func usable(_ index: Int) -> Bool { index > 0 && index < points.count && !points[index].move && hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y) > 0.000000000001 }`,
        `${indentation}var segment: Int?`,
        `${indentation}var forward = max(1, points[upper].distance <= distance + 0.000000000001 ? upper + 1 : upper)`,
        `${indentation}while forward < points.count { if usable(forward) { segment = forward; break }; forward += 1 }`,
        `${indentation}if segment == nil { var backward = min(points.count - 1, low); while backward >= 1 { if usable(backward) { segment = backward; break }; backward -= 1 } }`,
        `${indentation}guard let segment else { return (points[upper].x, points[upper].y, 0) }`,
        `${indentation}let start = points[segment - 1]; let end = points[segment]`,
        `${indentation}let span = end.distance - start.distance`,
        `${indentation}let progress = span <= 0.000000000001 ? 0 : min(1, max(0, (distance - start.distance) / span))`,
        `${indentation}return (start.x + (end.x - start.x) * progress, start.y + (end.y - start.y) * progress, atan2(end.y - start.y, end.x - start.x))`,
        "}",
        "",
        "private static func svgMotionTransform(points: [SVGAnimationMotionPoint], length: Double, fraction: Double, rotate: SVGAnimationMotionRotate, angle: Double) -> CGAffineTransform {",
        `${indentation}let sample = svgMotionSample(points: points, length: length, fraction: fraction)`,
        `${indentation}let radians: Double`,
        `${indentation}switch rotate { case .auto: radians = sample.angle; case .autoReverse: radians = sample.angle + .pi; case .angle: radians = angle * .pi / 180 }`,
        `${indentation}let translation = CGAffineTransform(translationX: sample.x, y: sample.y)`,
        `${indentation}return svgMultiplyTransform(translation, CGAffineTransform(rotationAngle: radians))`,
        "}",
        "",
        "private static func svgAnimatedMotion(documentTime: Double, intervals: [(begin: Double, end: Double)], duration: Double, repeatingDuration: Double, points: [SVGAnimationMotionPoint], length: Double, pathPoints: [Double], rotate: SVGAnimationMotionRotate, angle: Double, calcMode: SVGAnimationCalcMode, keyTimes: [Double], keyPoints: [Double], keySplines: [(x1: Double, y1: Double, x2: Double, y2: Double)], additive: Bool, accumulate: Bool, underlying: CGAffineTransform, freeze: Bool) -> CGAffineTransform {",
        `${indentation}let timing = svgTimingSample(documentTime: documentTime, intervals: intervals, duration: duration, repeatingDuration: repeatingDuration, freeze: freeze)`,
        `${indentation}if timing.state == .inactive || timing.state == .completed { return underlying }`,
        `${indentation}guard let progress = timing.simpleProgress else { return underlying }`,
        `${indentation}let controlPoints = keyPoints.count >= 2 ? keyPoints : pathPoints`,
        `${indentation}let fraction = calcMode == .paced && keyPoints.isEmpty ? progress : svgAnimationValueSample(progress: progress, values: controlPoints, form: .values, calcMode: calcMode, keyTimes: keyTimes, keySplines: keySplines, additive: false, accumulate: false, repeatIteration: 0, clamp: .unit, underlying: 0)`,
        `${indentation}var effect = svgMotionTransform(points: points, length: length, fraction: fraction, rotate: rotate, angle: angle)`,
        `${indentation}if accumulate && timing.repeatIteration > 0 { let endpoint = svgMotionTransform(points: points, length: length, fraction: 1, rotate: rotate, angle: angle); for _ in 0..<timing.repeatIteration { effect = svgMultiplyTransform(effect, endpoint) } }`,
        `${indentation}return additive ? svgMultiplyTransform(underlying, effect) : effect`,
        "}",
        "",
        "private static func svgAnimationColor(_ value: SVGAnimationRuntimeValue) -> Color {",
        `${indentation}func encoded(_ component: Double) -> Double {`,
        `${indentation}${indentation}component <= 0.0031308 ? component * 12.92 : 1.055 * pow(component, 1 / 2.4) - 0.055`,
        `${indentation}}`,
        `${indentation}let components = value.components + [0, 0, 0, 1]`,
        `${indentation}let linear = value.signature == "linearRGB"`,
        `${indentation}return Color(red: min(1, max(0, linear ? encoded(components[0]) : components[0])), green: min(1, max(0, linear ? encoded(components[1]) : components[1])), blue: min(1, max(0, linear ? encoded(components[2]) : components[2])), opacity: min(1, max(0, components[3])))`,
        "}",
        "",
        "private static func svgAnimationCGColor(_ value: SVGAnimationRuntimeValue, opacity: Double) -> CGColor {",
        `${indentation}func encoded(_ component: Double) -> Double { component <= 0.0031308 ? component * 12.92 : 1.055 * pow(component, 1 / 2.4) - 0.055 }`,
        `${indentation}let values = value.components + [0, 0, 0, 0]`,
        `${indentation}let linear = value.signature == "linearRGB"`,
        `${indentation}let components: [CGFloat] = [CGFloat(min(1, max(0, linear ? encoded(values[0]) : values[0]))), CGFloat(min(1, max(0, linear ? encoded(values[1]) : values[1]))), CGFloat(min(1, max(0, linear ? encoded(values[2]) : values[2]))), CGFloat(min(1, max(0, values[3] * opacity)))]`,
        `${indentation}return CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: components)!`,
        "}",
        "",
        "private static func svgZeroValue(like value: SVGAnimationRuntimeValue) -> SVGAnimationRuntimeValue {",
        `${indentation}SVGAnimationRuntimeValue(kind: value.kind, components: value.components.map { _ in 0 }, signature: value.signature, source: value.source)`,
        "}",
        "",
        "private static func svgValuesCompatible(_ left: SVGAnimationRuntimeValue, _ right: SVGAnimationRuntimeValue) -> Bool {",
        `${indentation}left.kind == right.kind && left.signature == right.signature && left.components.count == right.components.count && left.kind != .discrete`,
        "}",
        "",
        "private static func svgInterpolateValue(_ left: SVGAnimationRuntimeValue, _ right: SVGAnimationRuntimeValue, _ progress: Double) -> SVGAnimationRuntimeValue {",
        `${indentation}guard svgValuesCompatible(left, right) else { return progress >= 1 ? right : left }`,
        `${indentation}let components = zip(left.components, right.components).map { $0 + ($1 - $0) * progress }`,
        `${indentation}return SVGAnimationRuntimeValue(kind: left.kind, components: components, signature: left.signature, source: progress >= 1 ? right.source : left.source)`,
        "}",
        "",
        "private static func svgValueDistance(_ left: SVGAnimationRuntimeValue, _ right: SVGAnimationRuntimeValue) -> Double? {",
        `${indentation}guard svgValuesCompatible(left, right) else { return nil }`,
        `${indentation}return sqrt(zip(left.components, right.components).reduce(0) { sum, pair in sum + (pair.1 - pair.0) * (pair.1 - pair.0) })`,
        "}",
        "",
        "private static func svgAddValue(_ left: SVGAnimationRuntimeValue, _ right: SVGAnimationRuntimeValue) -> SVGAnimationRuntimeValue? {",
        `${indentation}guard svgValuesCompatible(left, right) else { return nil }`,
        `${indentation}return SVGAnimationRuntimeValue(kind: left.kind, components: zip(left.components, right.components).map { $0 + $1 }, signature: left.signature, source: right.source)`,
        "}",
        "",
        "private static func svgComposeValue(_ left: SVGAnimationRuntimeValue, _ right: SVGAnimationRuntimeValue) -> SVGAnimationRuntimeValue? {",
        `${indentation}if left.kind == .transform && right.kind == .transform {`,
        `${indentation}${indentation}let signature = [left.signature, right.signature].filter { !$0.isEmpty }.joined(separator: ";")`,
        `${indentation}${indentation}return SVGAnimationRuntimeValue(kind: .transform, components: left.components + right.components, signature: signature, source: right.source)`,
        `${indentation}}`,
        `${indentation}return svgAddValue(left, right)`,
        "}",
        "",
        "private static func svgClampValue(_ value: SVGAnimationRuntimeValue, _ clamp: SVGAnimationClamp) -> SVGAnimationRuntimeValue {",
        `${indentation}var components = value.components`,
        `${indentation}switch clamp {`,
        `${indentation}case .none: break`,
        `${indentation}case .unit: components = components.map { min(1, max(0, $0)) }`,
        `${indentation}case .nonnegative: components = components.map { max(0, $0) }`,
        `${indentation}case .integer: components = components.map { floor($0 + 0.5) }`,
        `${indentation}}`,
        `${indentation}return SVGAnimationRuntimeValue(kind: value.kind, components: components, signature: value.signature, source: value.source)`,
        "}",
        "",
        "private static func svgAnimationTypedValueSample(progress: Double, values authoredValues: [SVGAnimationRuntimeValue], form: SVGAnimationForm, calcMode: SVGAnimationCalcMode, keyTimes: [Double], keySplines: [(x1: Double, y1: Double, x2: Double, y2: Double)], additive: Bool, accumulate: Bool, repeatIteration: Int, clamp: SVGAnimationClamp, underlying: SVGAnimationRuntimeValue) -> SVGAnimationRuntimeValue {",
        `${indentation}var values = authoredValues`,
        `${indentation}if form == .to {`,
        `${indentation}${indentation}guard let target = authoredValues.first else { return underlying }`,
        `${indentation}${indentation}values = [underlying, target]`,
        `${indentation}} else if form == .by {`,
        `${indentation}${indentation}guard let target = authoredValues.first else { return underlying }`,
        `${indentation}${indentation}values = [svgZeroValue(like: target), target]`,
        `${indentation}}`,
        `${indentation}guard !values.isEmpty else { return underlying }`,
        `${indentation}if values.count == 1 { return svgClampValue(values[0], clamp) }`,
        `${indentation}var mode = calcMode`,
        `${indentation}var times: [Double]`,
        `${indentation}if mode == .paced {`,
        `${indentation}${indentation}let measured = zip(values, values.dropFirst()).map { svgValueDistance($0, $1) }`,
        `${indentation}${indentation}if measured.contains(where: { $0 == nil }) {`,
        `${indentation}${indentation}${indentation}mode = values[0].kind == .discrete ? .discrete : .linear`,
        `${indentation}${indentation}${indentation}times = values.indices.map { Double($0) / Double(values.count - 1) }`,
        `${indentation}${indentation}} else {`,
        `${indentation}${indentation}${indentation}let distances = measured.map { $0! }`,
        `${indentation}${indentation}${indentation}let total = distances.reduce(0, +)`,
        `${indentation}${indentation}${indentation}if total <= 0 { mode = .linear; times = values.indices.map { Double($0) / Double(values.count - 1) } }`,
        `${indentation}${indentation}${indentation}else { var elapsed = 0.0; times = [0] + distances.map { distance in elapsed += distance; return elapsed / total } }`,
        `${indentation}${indentation}}`,
        `${indentation}} else { times = keyTimes.count == values.count ? keyTimes : values.indices.map { Double($0) / Double(values.count - 1) } }`,
        `${indentation}let effect: SVGAnimationRuntimeValue`,
        `${indentation}if mode == .discrete || values[0].kind == .discrete {`,
        `${indentation}${indentation}let index = keyTimes.count == values.count ? (keyTimes.indices.last { progress + 0.000000000001 >= keyTimes[$0] } ?? 0) : min(values.count - 1, Int(floor(progress * Double(values.count) + 0.000000000001)))`,
        `${indentation}${indentation}effect = values[index]`,
        `${indentation}} else {`,
        `${indentation}${indentation}var segment = progress >= 1 ? values.count - 2 : 0`,
        `${indentation}${indentation}while segment + 1 < times.count - 1 && progress >= times[segment + 1] - 0.000000000001 { segment += 1 }`,
        `${indentation}${indentation}let start = times[segment]`,
        `${indentation}${indentation}let end = times[segment + 1]`,
        `${indentation}${indentation}var local = progress >= 1 ? 1 : (end <= start ? 1 : min(1, max(0, (progress - start) / (end - start))))`,
        `${indentation}${indentation}if mode == .spline && segment < keySplines.count { local = svgSplineProgress(local, keySplines[segment]) }`,
        `${indentation}${indentation}effect = svgInterpolateValue(values[segment], values[segment + 1], local)`,
        `${indentation}}`,
        `${indentation}var accumulated = effect`,
        `${indentation}if accumulate && repeatIteration > 0, let endpoint = values.last {`,
        `${indentation}${indentation}for _ in 0..<repeatIteration { accumulated = svgAddValue(accumulated, endpoint) ?? accumulated }`,
        `${indentation}}`,
        `${indentation}let result = additive && form != .to ? (svgComposeValue(underlying, accumulated) ?? accumulated) : accumulated`,
        `${indentation}return svgClampValue(result, clamp)`,
        "}",
        "",
        "private static func svgAnimatedValue(documentTime: Double, intervals: [(begin: Double, end: Double)], duration: Double, repeatingDuration: Double, values authoredValues: [SVGAnimationRuntimeValue], form: SVGAnimationForm, calcMode: SVGAnimationCalcMode, keyTimes: [Double], keySplines: [(x1: Double, y1: Double, x2: Double, y2: Double)], additive: Bool, accumulate: Bool, clamp: SVGAnimationClamp, underlying: SVGAnimationRuntimeValue, freeze: Bool) -> SVGAnimationRuntimeValue {",
        `${indentation}let sample = svgTimingSample(documentTime: documentTime, intervals: intervals, duration: duration, repeatingDuration: repeatingDuration, freeze: freeze)`,
        `${indentation}if sample.state == .inactive || sample.state == .completed { return underlying }`,
        `${indentation}guard let progress = sample.simpleProgress else { return underlying }`,
        `${indentation}return svgAnimationTypedValueSample(progress: progress, values: authoredValues, form: form, calcMode: calcMode, keyTimes: keyTimes, keySplines: keySplines, additive: additive, accumulate: accumulate, repeatIteration: sample.repeatIteration, clamp: clamp, underlying: underlying)`,
        "}",
        "",
        "private static func svgCSSTimingProgress(_ progress: Double, _ timing: SVGCSSTimingFunction) -> Double {",
        `${indentation}let value = min(1, max(0, progress))`,
        `${indentation}switch timing.kind {`,
        `${indentation}case .linear: return value`,
        `${indentation}case .cubic: return svgSplineProgress(value, (timing.x1, timing.y1, timing.x2, timing.y2))`,
        `${indentation}case .steps:`,
        `${indentation}${indentation}let count = max(1, timing.count)`,
        `${indentation}${indentation}switch timing.position {`,
        `${indentation}${indentation}case .jumpStart: return min(1, Double(Int(floor(value * Double(count))) + 1) / Double(count))`,
        `${indentation}${indentation}case .jumpEnd: return value >= 1 ? 1 : Double(Int(floor(value * Double(count)))) / Double(count)`,
        `${indentation}${indentation}case .jumpNone: return min(1, max(0, Double(Int(floor(value * Double(count)))) / Double(max(1, count - 1))))`,
        `${indentation}${indentation}case .jumpBoth: return min(1, Double(Int(floor(value * Double(count))) + 1) / Double(count + 1))`,
        `${indentation}${indentation}}`,
        `${indentation}}`,
        "}",
        "",
        "private static func svgCSSAnimatedValue(documentTime: Double, duration: Double, delay: Double, iterationCount: Double, direction: SVGCSSAnimationDirection, fillMode: SVGCSSAnimationFillMode, playState: SVGCSSAnimationPlayState, values: [SVGAnimationRuntimeValue], keyTimes: [Double], timingFunctions: [SVGCSSTimingFunction], clamp: SVGAnimationClamp, underlying: SVGAnimationRuntimeValue) -> SVGAnimationRuntimeValue {",
        `${indentation}guard values.count >= 2 else { return values.first.map { svgClampValue($0, clamp) } ?? underlying }`,
        `${indentation}let localTime = (playState == .paused ? 0 : documentTime) - delay`,
        `${indentation}let activeDuration = iterationCount.isFinite ? max(0, duration * iterationCount) : Double.infinity`,
        `${indentation}var progress: Double`,
        `${indentation}var iteration = 0`,
        `${indentation}var preserveEndpoint = false`,
        `${indentation}if localTime < 0 {`,
        `${indentation}${indentation}guard fillMode == .backwards || fillMode == .both else { return underlying }`,
        `${indentation}${indentation}progress = 0`,
        `${indentation}} else if duration <= 0 || iterationCount <= 0 || localTime >= activeDuration {`,
        `${indentation}${indentation}guard fillMode == .forwards || fillMode == .both else { return underlying }`,
        `${indentation}${indentation}preserveEndpoint = true`,
        `${indentation}${indentation}let whole = floor(iterationCount)`,
        `${indentation}${indentation}let fraction = iterationCount.isFinite ? iterationCount - whole : 0`,
        `${indentation}${indentation}if fraction > 0.000000000001 { iteration = max(0, Int(whole)); progress = fraction }`,
        `${indentation}${indentation}else { iteration = max(0, Int(max(0, whole - 1))); progress = 1 }`,
        `${indentation}} else {`,
        `${indentation}${indentation}let quotient = localTime / duration`,
        `${indentation}${indentation}iteration = max(0, Int(floor(quotient)))`,
        `${indentation}${indentation}progress = min(1, max(0, quotient - Double(iteration)))`,
        `${indentation}}`,
        `${indentation}let reversed: Bool`,
        `${indentation}switch direction {`,
        `${indentation}case .normal: reversed = false`,
        `${indentation}case .reverse: reversed = true`,
        `${indentation}case .alternate: reversed = iteration % 2 == 1`,
        `${indentation}case .alternateReverse: reversed = iteration % 2 == 0`,
        `${indentation}}`,
        `${indentation}if reversed { progress = 1 - progress }`,
        `${indentation}let times = keyTimes.count == values.count ? keyTimes : values.indices.map { Double($0) / Double(values.count - 1) }`,
        `${indentation}if values[0].kind == .discrete {`,
        `${indentation}${indentation}let index = times.indices.last { progress + 0.000000000001 >= times[$0] } ?? 0`,
        `${indentation}${indentation}return svgClampValue(values[min(index, values.count - 1)], clamp)`,
        `${indentation}}`,
        `${indentation}var segment = progress >= 1 ? values.count - 2 : 0`,
        `${indentation}while segment + 1 < times.count - 1 && progress >= times[segment + 1] - 0.000000000001 { segment += 1 }`,
        `${indentation}let start = times[segment]; let end = times[segment + 1]`,
        `${indentation}var segmentProgress = progress >= 1 ? 1 : (end <= start ? 1 : min(1, max(0, (progress - start) / (end - start))))`,
        `${indentation}if !preserveEndpoint && segment < timingFunctions.count { segmentProgress = svgCSSTimingProgress(segmentProgress, timingFunctions[segment]) }`,
        `${indentation}return svgClampValue(svgInterpolateValue(values[segment], values[segment + 1], segmentProgress), clamp)`,
        "}",
        "",
        "private static func svgAnimatedNumber(documentTime: Double, intervals: [(begin: Double, end: Double)], duration: Double, repeatingDuration: Double, values authoredValues: [Double], form: SVGAnimationForm, calcMode: SVGAnimationCalcMode, keyTimes: [Double], keySplines: [(x1: Double, y1: Double, x2: Double, y2: Double)], additive: Bool, accumulate: Bool, clamp: SVGAnimationClamp, underlying: Double, freeze: Bool) -> Double {",
        `${indentation}let sample = svgTimingSample(documentTime: documentTime, intervals: intervals, duration: duration, repeatingDuration: repeatingDuration, freeze: freeze)`,
        `${indentation}if sample.state == .inactive || sample.state == .completed { return underlying }`,
        `${indentation}guard let progress = sample.simpleProgress else { return underlying }`,
        `${indentation}return svgAnimationValueSample(progress: progress, values: authoredValues, form: form, calcMode: calcMode, keyTimes: keyTimes, keySplines: keySplines, additive: additive, accumulate: accumulate, repeatIteration: sample.repeatIteration, clamp: clamp, underlying: underlying)`,
        "}",
        "",
        "private final class AnimationClockState: ObservableObject {",
        `${indentation}private var startDate: Date?`,
        `${indentation}private var pausedAt: Date?`,
        `${indentation}private var pausedDuration: TimeInterval = 0`,
        "",
        `${indentation}func sample(date: Date, isActive: Bool) -> Double {`,
        `${indentation}${indentation}guard let startDate else {`,
        `${indentation}${indentation}${indentation}self.startDate = date`,
        `${indentation}${indentation}${indentation}if !isActive { pausedAt = date }`,
        `${indentation}${indentation}${indentation}return 0`,
        `${indentation}${indentation}}`,
        `${indentation}${indentation}if !isActive {`,
        `${indentation}${indentation}${indentation}if pausedAt == nil { pausedAt = date }`,
        `${indentation}${indentation}${indentation}let stoppedAt = pausedAt ?? date`,
        `${indentation}${indentation}${indentation}return max(0, stoppedAt.timeIntervalSince(startDate) - pausedDuration)`,
        `${indentation}${indentation}}`,
        `${indentation}${indentation}if let pausedAt {`,
        `${indentation}${indentation}${indentation}pausedDuration += max(0, date.timeIntervalSince(pausedAt))`,
        `${indentation}${indentation}${indentation}self.pausedAt = nil`,
        `${indentation}${indentation}}`,
        `${indentation}${indentation}return max(0, date.timeIntervalSince(startDate) - pausedDuration)`,
        `${indentation}}`,
        "}",
      ]
    : ["var body: some View {", ...content, "}"];
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
      body: helper.animated
        ? [
            "let documentTime: Double",
            ...(document.animationProgram.animations.some((animation) =>
              [...animation.timing.begin, ...animation.timing.end].some((time) => time.type === "event"),
            )
              ? ["let animationIntervals: [String: [(begin: Double, end: Double)]]"]
              : []),
            "",
            ...pathFunction,
          ]
        : pathFunction,
    });
    layerStruct[0] = `private ${layerStruct[0]}`;
    body.push("", ...layerStruct);
  }
  for (const helper of textHelpers)
    body.push("", ...createTextHelper(helper, coordinateSpace, document, name, indentationSize));
  for (const helper of imageHelpers) body.push("", ...createImageHelper(helper, coordinateSpace, indentationSize));
  for (const helper of filterImageHelpers) body.push("", ...createFilterImageHelper(helper, indentationSize));
  if (containsGradientNode(nodes)) body.push("", ...gradientSupport(indentationSize, animated));
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
    animationIntervals: sampleSMILProgram(document.animationProgram, 0).intervals,
    dynamicTimingIds: dynamicTimingIds(document),
    eventTargets: animationEventTargets(document),
  };
  const nodes = buildViewNodes(document.children, context);
  const imports = new Set<string>();
  if (
    document.animationProgram.animations.length > 0 ||
    context.imageHelpers.some((helper) => helper.animated) ||
    context.filterImageHelpers.some((helper) => helper.animated)
  ) {
    imports.add("Foundation");
    imports.add("SwiftUI");
  }
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
