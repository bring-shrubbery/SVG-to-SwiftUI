import type { ElementNode } from "svg-parser";
import {
  type CSSAnimationInstance,
  type CSSTimingFunction,
  parseCSSAnimationInstances,
  parseCSSTimingFunction,
} from "../cssAnimations";
import { defaultFontMetrics } from "../lengths";
import { type CSSKeyframesRule, substituteVariables } from "../styleCascade";
import { parseViewBox } from "../viewports";
import {
  type AnimateTransformType,
  type AnimationCalculation,
  type AnimationValueContext,
  type AnimationValueSet,
  animationAttributeSpec,
  matchNeutralTransformValue,
  parseAnimateTransformValueSet,
  parseAnimationValue,
  parseAnimationValueSet,
  parseKeySplines,
  parseKeyTimes,
  resolveAnimationAttributeForTarget,
  sampleAnimationValue,
  validateAnimationCalculation,
} from "./animationValues";
import { type MotionDefinition, parseMotionDefinition } from "./motion";
import { type DeterministicTimingEvent, sampleSMILProgram, sampleSMILTiming } from "./smilTiming";
import type { RenderDiagnostic, SourceLocation } from "./types";

export type AnimationKind = "animate" | "set" | "animateTransform" | "animateMotion" | "discard" | "cssAnimation";

export type AnimationTime =
  | { type: "offset"; seconds: number }
  | { type: "syncbase"; animationId: string; phase: "begin" | "end"; offsetSeconds: number }
  | { type: "repeat"; animationId: string; iteration: number; offsetSeconds: number }
  | { type: "repeatEvent"; animationId: string; offsetSeconds: number }
  | { type: "event"; targetId?: string; event: string; offsetSeconds: number }
  | { type: "accessKey"; key: string; offsetSeconds: number }
  | { type: "wallclock"; value: string }
  | { type: "indefinite" }
  | { type: "invalid"; syntax: string };

export type AnimationDuration =
  | { type: "seconds"; seconds: number }
  | { type: "indefinite" }
  | { type: "media" }
  | { type: "invalid"; syntax: string };

export type AnimationValue =
  | AnimationValueSet
  | {
      family: "unsupported";
      base?: string;
      from?: string;
      to?: string;
      by?: string;
      values?: readonly string[];
    };

export interface AnimationTiming {
  begin: readonly AnimationTime[];
  duration: AnimationDuration;
  end: readonly AnimationTime[];
  min?: AnimationDuration;
  max?: AnimationDuration;
  repeatCount: { type: "count"; value: number } | { type: "indefinite" } | { type: "unspecified" };
  repeatDuration?: AnimationDuration;
  restart: "always" | "whenNotActive" | "never";
  fill: "remove" | "freeze";
}

export interface AnimationTarget {
  key: string;
  source: SourceLocation;
  reference: { type: "parent" } | { type: "local"; id: string };
  renderable: boolean;
  tagName: string;
  referenceChain: readonly SourceLocation[];
  binding: "render-node" | "resource";
}

export interface AnimationTargetSnapshot {
  key: string;
  tagName: string;
  binding?: "render-node" | "resource";
  context: AnimationValueContext;
  /** Computed static presentation/geometry values, after cascade and inheritance. */
  baseValues: Readonly<Record<string, string>>;
  importantProperties?: Readonly<Record<string, true>>;
}

export interface CSSAnimationRuntime {
  name: string;
  duration: number;
  delay: number;
  iterationCount: number;
  direction: CSSAnimationInstance["direction"];
  fillMode: CSSAnimationInstance["fillMode"];
  playState: CSSAnimationInstance["playState"];
  segmentTimingFunctions: readonly CSSTimingFunction[];
}

export interface AnimationDefinition {
  stableId: string;
  authoredId?: string;
  source: SourceLocation;
  target?: AnimationTarget;
  kind: AnimationKind;
  transformType?: AnimateTransformType;
  motion?: MotionDefinition;
  cssAnimation?: CSSAnimationRuntime;
  authoredAttributeName?: string;
  attributeName?: string;
  attributeType: "auto" | "XML" | "CSS";
  timing: AnimationTiming;
  value: AnimationValue;
  composition: AnimationCalculation;
  documentOrder: number;
  dependencies: readonly string[];
  runtimeSupport: "typed" | "pending" | "invalid";
}

export interface AnimationProgram {
  animations: readonly AnimationDefinition[];
  /** Stable dependency order. Presentation sampling must never mutate the static render tree. */
  evaluationOrder: readonly string[];
  dependencyCycles: readonly (readonly string[])[];
}

const ANIMATION_TAGS = new Map<string, AnimationKind>([
  ["animate", "animate"],
  ["set", "set"],
  ["animatetransform", "animateTransform"],
  ["animatemotion", "animateMotion"],
  ["discard", "discard"],
]);

export const SUPPORTED_ANIMATION_EVENTS = [
  "activate",
  "blur",
  "click",
  "focus",
  "focusin",
  "focusout",
  "mousedown",
  "mouseenter",
  "mouseleave",
  "mouseout",
  "mouseover",
  "mouseup",
  "pointerdown",
  "pointerup",
] as const;

const SUPPORTED_ANIMATION_EVENT_SET = new Set<string>(SUPPORTED_ANIMATION_EVENTS);

function children(element: ElementNode): ElementNode[] {
  return element.children.filter(
    (child): child is ElementNode => typeof child !== "string" && child.type === "element",
  );
}

function source(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) };
}

function property(element: ElementNode, name: string): string | undefined {
  const value = element.properties?.[name];
  return value === undefined || value === null ? undefined : String(value).trim();
}

function diagnostic(
  diagnostics: RenderDiagnostic[],
  element: ElementNode,
  code: string,
  message: string,
  attribute?: string,
): void {
  diagnostics.push({
    code,
    message,
    severity: "warning",
    source: source(element),
    ...(attribute ? { attribute } : {}),
  });
}

function parseClock(raw: string): number | undefined {
  const value = raw.trim().toLowerCase();
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(value);
  if (clock) {
    const minutes = Number(clock[2]);
    const seconds = Number(clock[3]);
    if (minutes >= 60 || seconds >= 60) return undefined;
    return Number(clock[1] ?? 0) * 3600 + minutes * 60 + seconds;
  }
  const unit = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(ms|s|min|h)?$/.exec(value);
  if (!unit) return undefined;
  const number = Number(unit[1]);
  const multiplier = unit[2] === "ms" ? 0.001 : unit[2] === "min" ? 60 : unit[2] === "h" ? 3600 : 1;
  return Number.isFinite(number) ? number * multiplier : undefined;
}

function parseTime(raw: string): AnimationTime {
  const value = raw.trim();
  if (value === "") return { type: "invalid", syntax: value };
  if (value === "indefinite") return { type: "indefinite" };
  const wallclock = /^wallclock\((.+)\)$/i.exec(value);
  if (wallclock) return { type: "wallclock", value: wallclock[1]!.trim() };
  const accessKey = /^accesskey\((.)\)([+-].+)?$/i.exec(value);
  if (accessKey) {
    const parsedOffset = accessKey[2] ? parseClock(accessKey[2]) : 0;
    return parsedOffset === undefined
      ? { type: "invalid", syntax: value }
      : { type: "accessKey", key: accessKey[1]!, offsetSeconds: parsedOffset };
  }
  const offset = parseClock(value);
  if (offset !== undefined) return { type: "offset", seconds: offset };
  const repeat = /^([\w:.-]+)\.repeat\((\d+)\)([+-].+)?$/i.exec(value);
  if (repeat) {
    const parsedOffset = repeat[3] ? parseClock(repeat[3]) : 0;
    return parsedOffset === undefined || Number(repeat[2]) <= 0
      ? { type: "invalid", syntax: value }
      : {
          type: "repeat",
          animationId: repeat[1]!,
          iteration: Number(repeat[2]),
          offsetSeconds: parsedOffset,
        };
  }
  const reference = /^([\w:.-]+)\.(begin|end)([+-].+)?$/i.exec(value);
  if (reference) {
    const parsedOffset = reference[3] ? parseClock(reference[3]) : 0;
    return parsedOffset === undefined
      ? { type: "invalid", syntax: value }
      : {
          type: "syncbase",
          animationId: reference[1]!,
          phase: reference[2]!.toLowerCase() as "begin" | "end",
          offsetSeconds: parsedOffset,
        };
  }
  const lifecycle = /^([\w:.-]+)\.(beginEvent|endEvent|repeatEvent)([+-].+)?$/i.exec(value);
  if (lifecycle) {
    const parsedOffset = lifecycle[3] ? parseClock(lifecycle[3]) : 0;
    if (parsedOffset === undefined) return { type: "invalid", syntax: value };
    const eventName = lifecycle[2]!.toLowerCase();
    if (eventName === "repeatevent")
      return { type: "repeatEvent", animationId: lifecycle[1]!, offsetSeconds: parsedOffset };
    return {
      type: "syncbase",
      animationId: lifecycle[1]!,
      phase: eventName === "beginevent" ? "begin" : "end",
      offsetSeconds: parsedOffset,
    };
  }
  const event = /^(?:([\w:.-]+)\.)?([a-z][\w-]*)([+-].+)?$/i.exec(value);
  if (event) {
    const parsedOffset = event[3] ? parseClock(event[3]) : 0;
    return parsedOffset === undefined
      ? { type: "invalid", syntax: value }
      : {
          type: "event",
          ...(event[1] ? { targetId: event[1] } : {}),
          event: event[2]!,
          offsetSeconds: parsedOffset,
        };
  }
  return { type: "invalid", syntax: value };
}

function parseTimes(raw: string | undefined, fallback: readonly AnimationTime[]): readonly AnimationTime[] {
  if (raw === undefined) return fallback;
  return raw.split(";").map(parseTime);
}

function parseDuration(raw: string | undefined): AnimationDuration {
  if (raw === undefined) return { type: "indefinite" };
  if (raw === "") return { type: "invalid", syntax: raw };
  if (raw === "indefinite") return { type: "indefinite" };
  if (raw === "media") return { type: "media" };
  const seconds = parseClock(raw);
  return seconds !== undefined && seconds >= 0 ? { type: "seconds", seconds } : { type: "invalid", syntax: raw };
}

function parseOptionalDuration(raw: string | undefined): AnimationDuration | undefined {
  return raw === undefined ? undefined : parseDuration(raw);
}

function parseRepeatCount(raw: string | undefined): AnimationTiming["repeatCount"] {
  if (raw === undefined) return { type: "unspecified" };
  if (raw === "indefinite") return { type: "indefinite" };
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? { type: "count", value } : { type: "count", value: Number.NaN };
}

function numeric(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

const GEOMETRY_TARGETS: Readonly<Record<string, readonly string[]>> = {
  cx: ["circle", "ellipse", "radialGradient"],
  cy: ["circle", "ellipse", "radialGradient"],
  d: ["path"],
  height: ["rect", "svg", "image", "foreignObject", "pattern", "mask", "filter"],
  points: ["polygon", "polyline"],
  r: ["circle", "radialGradient"],
  rx: ["rect", "ellipse"],
  ry: ["rect", "ellipse"],
  width: ["rect", "svg", "image", "foreignObject", "pattern", "mask", "filter"],
  x: ["rect", "svg", "image", "foreignObject", "text", "tspan", "use", "pattern", "mask", "filter"],
  x1: ["line", "linearGradient"],
  x2: ["line", "linearGradient"],
  y1: ["line", "linearGradient"],
  y2: ["line", "linearGradient"],
  y: ["rect", "svg", "image", "foreignObject", "text", "tspan", "use", "pattern", "mask", "filter"],
};

const FILTER_REGION_ATTRIBUTES = ["x", "y", "width", "height", "result", "color-interpolation-filters"];
const FILTER_INPUT_ATTRIBUTES = [...FILTER_REGION_ATTRIBUTES, "in"];
const FILTER_TARGET_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  feblend: [...FILTER_INPUT_ATTRIBUTES, "in2", "mode"],
  fecolormatrix: [...FILTER_INPUT_ATTRIBUTES, "type", "values"],
  fecomponenttransfer: FILTER_INPUT_ATTRIBUTES,
  fecomposite: [...FILTER_INPUT_ATTRIBUTES, "in2", "operator", "k1", "k2", "k3", "k4"],
  feconvolvematrix: [
    ...FILTER_INPUT_ATTRIBUTES,
    "order",
    "kernelMatrix",
    "divisor",
    "bias",
    "targetX",
    "targetY",
    "edgeMode",
    "kernelUnitLength",
    "preserveAlpha",
  ],
  fediffuselighting: [
    ...FILTER_INPUT_ATTRIBUTES,
    "surfaceScale",
    "diffuseConstant",
    "kernelUnitLength",
    "lighting-color",
  ],
  fedisplacementmap: [...FILTER_INPUT_ATTRIBUTES, "in2", "scale", "xChannelSelector", "yChannelSelector"],
  fedistantlight: ["azimuth", "elevation"],
  fedropshadow: [...FILTER_INPUT_ATTRIBUTES, "stdDeviation", "dx", "dy", "flood-color", "flood-opacity"],
  feflood: [...FILTER_REGION_ATTRIBUTES, "flood-color", "flood-opacity"],
  fefunca: ["type", "tableValues", "slope", "intercept", "amplitude", "exponent", "offset"],
  fefuncb: ["type", "tableValues", "slope", "intercept", "amplitude", "exponent", "offset"],
  fefuncg: ["type", "tableValues", "slope", "intercept", "amplitude", "exponent", "offset"],
  fefuncr: ["type", "tableValues", "slope", "intercept", "amplitude", "exponent", "offset"],
  fegaussianblur: [...FILTER_INPUT_ATTRIBUTES, "stdDeviation", "edgeMode"],
  feimage: [...FILTER_REGION_ATTRIBUTES, "href", "preserveAspectRatio"],
  femerge: FILTER_REGION_ATTRIBUTES,
  femergenode: ["in"],
  femorphology: [...FILTER_INPUT_ATTRIBUTES, "operator", "radius"],
  feoffset: [...FILTER_INPUT_ATTRIBUTES, "dx", "dy"],
  fepointlight: ["x", "y", "z"],
  fespecularlighting: [
    ...FILTER_INPUT_ATTRIBUTES,
    "surfaceScale",
    "specularConstant",
    "specularExponent",
    "kernelUnitLength",
    "lighting-color",
  ],
  fespotlight: ["x", "y", "z", "pointsAtX", "pointsAtY", "pointsAtZ", "specularExponent", "limitingConeAngle"],
  fetile: FILTER_INPUT_ATTRIBUTES,
  feturbulence: [...FILTER_REGION_ATTRIBUTES, "baseFrequency", "numOctaves", "seed", "stitchTiles", "type"],
};

function propertyAppliesToTarget(attributeName: string | undefined, tagName: string | undefined): boolean {
  if (!attributeName || !tagName) return false;
  const filterAttributes = FILTER_TARGET_ATTRIBUTES[tagName.toLowerCase()];
  if (filterAttributes) return filterAttributes.includes(attributeName);
  const allowed = GEOMETRY_TARGETS[attributeName];
  if (allowed) return allowed.includes(tagName);
  if (attributeName === "viewBox") return ["svg", "symbol", "view", "marker", "pattern"].includes(tagName);
  if (attributeName === "preserveAspectRatio")
    return ["svg", "symbol", "view", "marker", "pattern", "image"].includes(tagName);
  if (["dx", "dy", "rotate", "textLength", "startOffset"].includes(attributeName))
    return ["text", "tspan", "textPath"].includes(tagName);
  if (attributeName === "offset") return tagName === "stop";
  return true;
}

function parseValue(
  animation: ElementNode,
  attributeName: string | undefined,
  context: AnimationValueContext,
  baseRaw?: string,
  attributeSpec?: ReturnType<typeof resolveAnimationAttributeForTarget>,
): AnimationValue {
  const fromRaw = property(animation, "from");
  const toRaw = property(animation, "to");
  const byRaw = property(animation, "by");
  const valuesRaw = property(animation, "values")
    ?.split(";")
    .map((value) => value.trim());
  if (attributeName) {
    const parsed = parseAnimationValueSet(
      attributeName,
      {
        base: baseRaw ?? "0",
        ...(fromRaw === undefined ? {} : { from: fromRaw }),
        ...(toRaw === undefined ? {} : { to: toRaw }),
        ...(byRaw === undefined ? {} : { by: byRaw }),
        ...(valuesRaw ? { values: valuesRaw } : {}),
      },
      context,
      attributeSpec,
    );
    if (parsed) return parsed;
  }
  return {
    family: "unsupported",
    ...(baseRaw === undefined ? {} : { base: baseRaw }),
    ...(fromRaw === undefined ? {} : { from: fromRaw }),
    ...(toRaw === undefined ? {} : { to: toRaw }),
    ...(byRaw === undefined ? {} : { by: byRaw }),
    ...(valuesRaw ? { values: valuesRaw } : {}),
  };
}

function isRuntimeSupported(definition: Omit<AnimationDefinition, "runtimeSupport">): boolean {
  const deterministicTime = (time: AnimationTime) =>
    ["offset", "syncbase", "repeat", "repeatEvent", "event", "indefinite"].includes(time.type) &&
    (time.type !== "event" || SUPPORTED_ANIMATION_EVENT_SET.has(time.event.toLowerCase()));
  if (definition.kind === "discard")
    return (
      !!definition.target?.renderable &&
      definition.target.binding === "render-node" &&
      definition.timing.begin.every(deterministicTime) &&
      definition.timing.end.every(deterministicTime)
    );
  if (
    !(["animate", "set", "animateTransform", "animateMotion", "cssAnimation"] as AnimationKind[]).includes(
      definition.kind,
    )
  )
    return false;
  const attribute = definition.attributeName
    ? resolveAnimationAttributeForTarget(definition.attributeName, definition.attributeType, definition.target?.tagName)
    : undefined;
  const resourceSupported =
    definition.target?.binding === "resource" &&
    (attribute?.runtimeBinding === "gradient-stop" || attribute?.runtimeBinding === "resource");
  const renderNodeSupported =
    definition.target?.binding === "render-node" &&
    (attribute?.runtimeBinding === "render-node" ||
      attribute?.runtimeBinding === "resource" ||
      (definition.kind === "animateTransform" && definition.attributeName === "transform") ||
      (definition.kind === "animateMotion" && definition.attributeName === "motion"));
  if (
    !definition.target?.renderable ||
    (!renderNodeSupported && !resourceSupported) ||
    !definition.attributeName ||
    (definition.attributeName === "transform" && !["animateTransform", "cssAnimation"].includes(definition.kind)) ||
    !propertyAppliesToTarget(definition.attributeName, definition.target.tagName)
  )
    return false;
  if (
    definition.timing.duration.type === "invalid" ||
    definition.timing.duration.type === "media" ||
    (definition.timing.duration.type === "seconds" &&
      (!Number.isFinite(definition.timing.duration.seconds) || definition.timing.duration.seconds < 0))
  )
    return false;
  if (!definition.timing.begin.every(deterministicTime) || !definition.timing.end.every(deterministicTime))
    return false;
  if (
    definition.timing.repeatCount.type === "count" &&
    (!Number.isFinite(definition.timing.repeatCount.value) || definition.timing.repeatCount.value <= 0)
  )
    return false;
  if (definition.kind === "animateMotion") {
    if (!definition.motion) return false;
    const keyPoints = definition.composition.keyPoints;
    const keyTimes = definition.composition.keyTimes;
    if (keyPoints && (!keyTimes || keyPoints.length !== keyTimes.length || keyPoints.length < 2)) return false;
    const motionPointCount = keyPoints?.length ?? definition.motion.keyDistances.length;
    if (keyTimes && keyTimes.length !== motionPointCount) return false;
    if (
      definition.composition.calcMode === "spline" &&
      definition.composition.keySplines?.length !== motionPointCount - 1
    )
      return false;
    return true;
  }
  if (definition.value.family === "unsupported" || definition.value.form === "invalid") return false;
  if (definition.kind === "set" && !definition.value.to && !definition.value.values?.length) return false;
  const count = definition.value.values?.length ?? 2;
  return validateAnimationCalculation(count, definition.composition).length === 0;
}

/** Parse declarative SVG animation into immutable, typed compiler input. */
export function buildAnimationProgram(
  root: ElementNode,
  diagnostics: RenderDiagnostic[],
  targetSnapshots: ReadonlyMap<string, AnimationTargetSnapshot> = new Map(),
  cssKeyframes: ReadonlyMap<string, CSSKeyframesRule> = new Map(),
  limits: { maxDefinitions?: number; maxKeyframes?: number; maxDependencyDepth?: number; strict?: boolean } = {},
): AnimationProgram {
  const maxDefinitions = Math.max(1, Math.floor(limits.maxDefinitions ?? 1024));
  const maxKeyframes = Math.max(2, Math.floor(limits.maxKeyframes ?? 2048));
  const maxDependencyDepth = Math.max(1, Math.floor(limits.maxDependencyDepth ?? 128));
  let parsedRootViewBox: ReturnType<typeof parseViewBox>;
  try {
    parsedRootViewBox = parseViewBox(property(root, "viewBox"));
  } catch {
    parsedRootViewBox = undefined;
  }
  const viewport = {
    width: parsedRootViewBox?.width ?? numeric(property(root, "width")) ?? 300,
    height: parsedRootViewBox?.height ?? numeric(property(root, "height")) ?? 150,
  };
  const animationValueContext: AnimationValueContext = {
    length: {
      viewport,
      rootViewport: viewport,
      fontMetrics: defaultFontMetrics(),
      percentageBasis: "viewport-diagonal",
      axis: "other",
    },
    colorSpace: property(root, "color-interpolation")?.toLowerCase() === "linearrgb" ? "linearRGB" : "sRGB",
  };
  const parents = new Map<ElementNode, ElementNode>();
  const order = new Map<ElementNode, number>();
  const definitions = new Map<string, ElementNode>();
  const duplicateIds = new Set<string>();
  const animationElements: Array<{ element: ElementNode; kind: AnimationKind }> = [];
  let nextOrder = 0;
  const visit = (element: ElementNode): void => {
    order.set(element, nextOrder++);
    const id = property(element, "id");
    if (id) {
      if (definitions.has(id)) duplicateIds.add(id);
      else definitions.set(id, element);
    }
    const kind = ANIMATION_TAGS.get((element.tagName ?? "").toLowerCase());
    if (kind) animationElements.push({ element, kind });
    for (const child of children(element)) {
      parents.set(child, element);
      visit(child);
    }
  };
  visit(root);

  if (animationElements.length > maxDefinitions)
    diagnostics.push({
      code: "animation-definition-limit",
      message: `Document contains ${animationElements.length} animation elements; only the first ${maxDefinitions} are compiled.`,
      severity: limits.strict ? "error" : "warning",
      source: source(animationElements[maxDefinitions]!.element),
    });

  const animations: AnimationDefinition[] = [];
  for (const { element, kind } of animationElements.slice(0, maxDefinitions)) {
    const documentOrder = order.get(element)!;
    const authoredId = property(element, "id");
    const stableId = authoredId || `animation-${String(documentOrder).padStart(6, "0")}`;
    if (authoredId && duplicateIds.has(authoredId))
      diagnostic(
        diagnostics,
        element,
        "duplicate-animation-id",
        `Animation id #${authoredId} is duplicated, so timing references to it are ambiguous.`,
        "id",
      );
    const href = property(element, "href") ?? property(element, "xlink:href");
    let targetElement: ElementNode | undefined;
    let reference: AnimationTarget["reference"];
    if (href !== undefined) {
      const match = /^#([^\s]+)$/.exec(href);
      reference = { type: "local", id: match?.[1] ?? href };
      if (!match)
        diagnostic(
          diagnostics,
          element,
          "invalid-animation-target",
          `Animation target '${href}' must be a local #id reference.`,
          "href",
        );
      else if (duplicateIds.has(match[1]!))
        diagnostic(
          diagnostics,
          element,
          "duplicate-animation-target-id",
          `Animation target #${match[1]} is ambiguous because that id is duplicated.`,
          "href",
        );
      else targetElement = definitions.get(match[1]!);
      if (match && !targetElement)
        diagnostic(
          diagnostics,
          element,
          "missing-animation-target",
          `Animation target #${match[1]} does not exist.`,
          "href",
        );
    } else {
      reference = { type: "parent" };
      targetElement = parents.get(element);
      if (!targetElement)
        diagnostic(
          diagnostics,
          element,
          "missing-animation-target",
          "An animation without href must be a child of its target element.",
        );
    }
    const targetKey = targetElement
      ? property(targetElement, "id")
        ? `id:${property(targetElement, "id")}`
        : `source:${order.get(targetElement)}`
      : undefined;
    const targetSnapshot = targetKey ? targetSnapshots.get(targetKey) : undefined;
    const targetTag = (targetElement?.tagName ?? "").toLowerCase();
    const resourceTarget = new Set([
      "stop",
      "lineargradient",
      "radialgradient",
      "fegaussianblur",
      "fecolormatrix",
      "fecomponenttransfer",
      "fefunca",
      "fefuncb",
      "fefuncg",
      "fefuncr",
      "fecomposite",
      "feconvolvematrix",
      "fediffuselighting",
      "fedisplacementmap",
      "fedistantlight",
      "fedropshadow",
      "feflood",
      "femorphology",
      "feoffset",
      "fepointlight",
      "fespecularlighting",
      "fespotlight",
      "feturbulence",
    ]).has(targetTag);
    const renderable = !!targetElement && (!!targetSnapshot || resourceTarget);
    if (targetElement && !renderable)
      diagnostic(
        diagnostics,
        element,
        "wrong-animation-target-type",
        `Animation target <${targetElement.tagName}> is not a rendered graphics element.`,
        href === undefined ? undefined : "href",
      );
    const target: AnimationTarget | undefined = targetElement
      ? {
          key: targetKey!,
          source: source(targetElement),
          reference,
          renderable,
          tagName: targetElement.tagName ?? "unknown",
          binding: targetSnapshot?.binding ?? (targetSnapshot ? "render-node" : "resource"),
          referenceChain: (() => {
            const chain: SourceLocation[] = [];
            let current: ElementNode | undefined = targetElement;
            while (current) {
              chain.push(source(current));
              current = parents.get(current);
            }
            return chain;
          })(),
        }
      : undefined;
    const authoredAttributeName = property(element, "attributeName");
    const attributeTypeSource = property(element, "attributeType");
    const attributeType: AnimationDefinition["attributeType"] =
      attributeTypeSource === "XML" || attributeTypeSource === "CSS" ? attributeTypeSource : "auto";
    const effectiveAttributeName =
      kind === "animateTransform"
        ? (authoredAttributeName ?? "transform")
        : kind === "animateMotion"
          ? "motion"
          : authoredAttributeName;
    const attributeSpec = effectiveAttributeName
      ? resolveAnimationAttributeForTarget(effectiveAttributeName, attributeType, targetTag)
      : undefined;
    const attributeName = kind === "animateMotion" ? "motion" : attributeSpec?.canonicalName;
    if ((kind === "animate" || kind === "set" || kind === "animateTransform") && !authoredAttributeName)
      diagnostic(
        diagnostics,
        element,
        "missing-animation-attribute",
        `<${element.tagName}> requires attributeName.`,
        "attributeName",
      );
    if (attributeTypeSource !== undefined && !["auto", "XML", "CSS"].includes(attributeTypeSource))
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-attribute-type",
        `attributeType must be auto, XML, or CSS; received '${attributeTypeSource}'.`,
        "attributeType",
      );
    if (authoredAttributeName && animationAttributeSpec(authoredAttributeName) && !attributeSpec)
      diagnostic(
        diagnostics,
        element,
        "incompatible-animation-attribute-type",
        `${authoredAttributeName} is not available in the requested ${attributeType} namespace.`,
        "attributeType",
      );
    if (kind === "animateTransform" && authoredAttributeName && authoredAttributeName !== "transform")
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-transform-attribute",
        `<animateTransform> can only target the transform attribute; received '${authoredAttributeName}'.`,
        "attributeName",
      );
    const restartValue = property(element, "restart");
    const fillValue = property(element, "fill");
    const parsedMax = parseOptionalDuration(property(element, "max"));
    const max =
      parsedMax?.type === "seconds" && parsedMax.seconds <= 0
        ? ({ type: "invalid", syntax: property(element, "max") ?? "" } as const)
        : parsedMax;
    const timing: AnimationTiming = {
      begin: parseTimes(property(element, "begin"), [{ type: "offset", seconds: 0 }]),
      duration: parseDuration(property(element, "dur")),
      end: parseTimes(property(element, "end"), []),
      ...(parseOptionalDuration(property(element, "min"))
        ? { min: parseOptionalDuration(property(element, "min")) }
        : {}),
      ...(max ? { max } : {}),
      repeatCount: parseRepeatCount(property(element, "repeatCount")),
      ...(parseOptionalDuration(property(element, "repeatDur"))
        ? { repeatDuration: parseOptionalDuration(property(element, "repeatDur")) }
        : {}),
      restart: ["always", "whenNotActive", "never"].includes(restartValue ?? "")
        ? (restartValue as AnimationTiming["restart"])
        : "always",
      fill: fillValue === "freeze" ? "freeze" : "remove",
    };
    const transformTypeSource = property(element, "type") ?? "translate";
    const transformType = (["translate", "scale", "rotate", "skewX", "skewY"] as const).find(
      (candidate) => candidate === transformTypeSource,
    );
    if (kind === "animateTransform" && !transformType)
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-transform-type",
        `animateTransform type must be translate, scale, rotate, skewX, or skewY; received '${transformTypeSource}'.`,
        "type",
      );
    const baseRaw = attributeName
      ? (targetSnapshot?.baseValues[attributeName] ??
        (targetElement ? property(targetElement, attributeName) : undefined))
      : undefined;
    const value =
      kind === "animateTransform" && transformType && attributeName === "transform"
        ? (parseAnimateTransformValueSet(
            transformType,
            {
              ...(baseRaw ? { base: baseRaw } : {}),
              ...(property(element, "from") === undefined ? {} : { from: property(element, "from") }),
              ...(property(element, "to") === undefined ? {} : { to: property(element, "to") }),
              ...(property(element, "by") === undefined ? {} : { by: property(element, "by") }),
              ...(property(element, "values") === undefined
                ? {}
                : {
                    values: property(element, "values")!
                      .split(";")
                      .map((item) => item.trim()),
                  }),
            },
            targetSnapshot?.context ?? animationValueContext,
          ) ?? { family: "unsupported" as const })
        : parseValue(element, attributeName, targetSnapshot?.context ?? animationValueContext, baseRaw, attributeSpec);
    const calcModeSource = property(element, "calcMode");
    const defaultCalcMode = kind === "set" ? "discrete" : kind === "animateMotion" ? "paced" : "linear";
    const calcMode = ["discrete", "linear", "paced", "spline"].includes(calcModeSource ?? "")
      ? (calcModeSource as AnimationCalculation["calcMode"])
      : defaultCalcMode;
    const keyTimesSource = property(element, "keyTimes");
    const keySplinesSource = property(element, "keySplines");
    const keyPointsSource = property(element, "keyPoints");
    const composition: AnimationCalculation = {
      additive: property(element, "additive") === "sum" ? "sum" : "replace",
      accumulate: property(element, "accumulate") === "sum" ? "sum" : "none",
      calcMode,
      ...(keyTimesSource === undefined ? {} : { keyTimes: parseKeyTimes(keyTimesSource) ?? [] }),
      ...(keySplinesSource === undefined ? {} : { keySplines: parseKeySplines(keySplinesSource) ?? [] }),
      ...(keyPointsSource === undefined ? {} : { keyPoints: parseKeyTimes(keyPointsSource) ?? [] }),
    };
    const parsedMotion =
      kind === "animateMotion"
        ? parseMotionDefinition(element, definitions, duplicateIds, targetSnapshot?.context ?? animationValueContext)
        : undefined;
    if (parsedMotion) diagnostics.push(...parsedMotion.diagnostics);
    const dependencies = [...timing.begin, ...timing.end]
      .filter(
        (time): time is Extract<AnimationTime, { type: "syncbase" | "repeat" | "repeatEvent" }> =>
          time.type === "syncbase" || time.type === "repeat" || time.type === "repeatEvent",
      )
      .map((time) => time.animationId);
    const baseDefinition = {
      stableId,
      ...(authoredId ? { authoredId } : {}),
      source: source(element),
      ...(target ? { target } : {}),
      kind,
      ...(kind === "animateTransform" && transformType ? { transformType } : {}),
      ...(parsedMotion?.motion ? { motion: parsedMotion.motion } : {}),
      ...(authoredAttributeName ? { authoredAttributeName } : {}),
      ...(attributeName ? { attributeName } : {}),
      attributeType,
      timing,
      value,
      composition,
      documentOrder,
      dependencies,
    };
    let runtimeSupport: AnimationDefinition["runtimeSupport"] = target ? "pending" : "invalid";
    const eventSourcesAvailable = [...timing.begin, ...timing.end].every(
      (time) =>
        time.type !== "event" || !time.targetId || (!duplicateIds.has(time.targetId) && definitions.has(time.targetId)),
    );
    if (eventSourcesAvailable && isRuntimeSupported(baseDefinition)) runtimeSupport = "typed";
    const definition: AnimationDefinition = { ...baseDefinition, runtimeSupport };
    animations.push(definition);

    if (timing.duration.type === "invalid")
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-duration",
        "Animation dur must be a non-negative clock value.",
        "dur",
      );
    if (timing.begin.some((time) => time.type === "invalid"))
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-begin",
        "Animation begin contains invalid timing syntax.",
        "begin",
      );
    if (timing.end.some((time) => time.type === "invalid"))
      diagnostic(diagnostics, element, "invalid-animation-end", "Animation end contains invalid timing syntax.", "end");
    for (const [attribute, duration] of [
      ["min", timing.min],
      ["max", timing.max],
      ["repeatDur", timing.repeatDuration],
    ] as const) {
      if (duration?.type === "invalid")
        diagnostic(
          diagnostics,
          element,
          `invalid-animation-${attribute.toLowerCase()}`,
          `${attribute} contains an invalid duration and is ignored by the timing model.`,
          attribute,
        );
    }
    for (const [attribute, duration] of [
      ["dur", timing.duration],
      ["min", timing.min],
      ["max", timing.max],
      ["repeatDur", timing.repeatDuration],
    ] as const) {
      if (duration?.type === "media")
        diagnostic(
          diagnostics,
          element,
          "unsupported-animation-media-duration",
          `${attribute}="media" has no intrinsic media duration on an SVG animation element and is ignored.`,
          attribute,
        );
    }
    if (timing.min?.type === "seconds" && timing.max?.type === "seconds" && timing.max.seconds < timing.min.seconds)
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-min-max",
        "max is less than min; SVG timing ignores both constraints.",
        "max",
      );
    for (const time of [...timing.begin, ...timing.end]) {
      if (time.type === "wallclock")
        diagnostic(
          diagnostics,
          element,
          "unsupported-animation-wallclock",
          "wallclock timing is nondeterministic in generated SwiftUI; the instance remains unresolved.",
          timing.begin.includes(time) ? "begin" : "end",
        );
      if (time.type === "accessKey")
        diagnostic(
          diagnostics,
          element,
          "unsupported-animation-accesskey",
          "accessKey timing has no deterministic native input mapping; the instance remains unresolved.",
          timing.begin.includes(time) ? "begin" : "end",
        );
      if (time.type === "event") {
        if (!SUPPORTED_ANIMATION_EVENT_SET.has(time.event.toLowerCase()))
          diagnostic(
            diagnostics,
            element,
            "unsupported-animation-event",
            `Event '${time.event}' has no deterministic native adapter; the timing instance remains unresolved.`,
            timing.begin.includes(time) ? "begin" : "end",
          );
        if (time.targetId && (duplicateIds.has(time.targetId) || !definitions.has(time.targetId)))
          diagnostic(
            diagnostics,
            element,
            duplicateIds.has(time.targetId) ? "ambiguous-animation-event-target" : "missing-animation-event-target",
            duplicateIds.has(time.targetId)
              ? `Event target #${time.targetId} is ambiguous because that id is duplicated.`
              : `Event target #${time.targetId} does not exist.`,
            timing.begin.includes(time) ? "begin" : "end",
          );
      }
    }
    if (timing.repeatCount.type === "count" && !Number.isFinite(timing.repeatCount.value))
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-repeat-count",
        "repeatCount must be a positive number or indefinite.",
        "repeatCount",
      );
    const restart = property(element, "restart");
    if (restart && !["always", "whenNotActive", "never"].includes(restart))
      diagnostic(diagnostics, element, "invalid-animation-restart", `Invalid restart value '${restart}'.`, "restart");
    const fill = property(element, "fill");
    if (fill && !["remove", "freeze"].includes(fill))
      diagnostic(diagnostics, element, "invalid-animation-fill", `Invalid animation fill value '${fill}'.`, "fill");
    if (calcModeSource !== undefined && !["discrete", "linear", "paced", "spline"].includes(calcModeSource))
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-calc-mode",
        `Invalid calcMode '${calcModeSource}'; using ${defaultCalcMode}.`,
        "calcMode",
      );
    if (calcMode !== "paced" && keyTimesSource !== undefined && parseKeyTimes(keyTimesSource) === undefined)
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-key-times",
        "keyTimes must be a semicolon-separated list of values from 0 through 1.",
        "keyTimes",
      );
    if (calcMode === "spline" && keySplinesSource !== undefined && parseKeySplines(keySplinesSource) === undefined)
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-key-splines",
        "Each keySplines segment must contain four control values from 0 through 1.",
        "keySplines",
      );
    if (keyPointsSource !== undefined && parseKeyTimes(keyPointsSource) === undefined)
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-key-points",
        "keyPoints must be a semicolon-separated list of values from 0 through 1.",
        "keyPoints",
      );
    if (attributeName && target && !propertyAppliesToTarget(attributeName, target.tagName))
      diagnostic(
        diagnostics,
        element,
        "non-animatable-target-property",
        `${attributeName} does not apply to animation target <${target.tagName}> (${target.referenceChain
          .map((item) => (item.id ? `<${item.element}#${item.id}>` : `<${item.element}>`))
          .join(" <- ")}).`,
        "attributeName",
      );
    for (const raw of [
      property(element, "from"),
      property(element, "to"),
      property(element, "by"),
      ...(property(element, "values")?.split(";") ?? []),
    ]) {
      if (!raw || !/url\(/i.test(raw)) continue;
      const local = /^\s*url\(\s*["']?#([^\s)"']+)["']?\s*\)(?:\s+.+)?\s*$/i.exec(raw);
      if (!local) {
        diagnostic(
          diagnostics,
          element,
          "unsupported-animation-resource-reference",
          `Animated resource value '${raw}' must use one local url(#id) reference.`,
          "values",
        );
      } else if (!definitions.has(local[1]!)) {
        diagnostic(
          diagnostics,
          element,
          "unresolved-animation-resource-reference",
          `Animated resource value references missing definition #${local[1]}.`,
          "values",
        );
      }
    }
    if (value.family === "unsupported" && kind !== "animateMotion" && kind !== "discard")
      diagnostic(
        diagnostics,
        element,
        animationAttributeSpec(authoredAttributeName ?? "") ? "invalid-animation-value" : "unknown-animation-attribute",
        animationAttributeSpec(authoredAttributeName ?? "")
          ? "The authored animation values are invalid for the target attribute's value family."
          : `The animation value family for '${authoredAttributeName ?? ""}' is unknown; the compiler will not guess.`,
        "attributeName",
      );
    if (kind === "animateTransform" && transformType && value.family === "unsupported")
      diagnostic(
        diagnostics,
        element,
        "invalid-animation-transform-value",
        `One or more ${transformType} values have invalid syntax or arity.`,
        property(element, "values") === undefined ? "from" : "values",
      );
    if (value.family !== "unsupported" && kind !== "animateMotion") {
      if (value.form === "invalid")
        diagnostic(
          diagnostics,
          element,
          "invalid-animation-value-form",
          "Animation requires values, from/to, from/by, to, or by.",
        );
      const count = value.values?.length ?? 2;
      for (const error of validateAnimationCalculation(count, composition))
        diagnostic(
          diagnostics,
          element,
          `invalid-animation-${error.toLowerCase()}`,
          `The ${error} constraint is invalid for ${count} animation value(s); the animation has no effect.`,
          error.startsWith("keySplines") ? "keySplines" : "keyTimes",
        );
      const probe = sampleAnimationValue(value, composition, 0.5, 0, value.base);
      if (probe?.fallback === "incompatible-values")
        diagnostic(
          diagnostics,
          element,
          "incompatible-animation-values",
          "The animation values have incompatible list or path structures; permissive mode uses discrete changes.",
          value.values ? "values" : "to",
        );
      if (
        (composition.additive === "sum" ||
          composition.accumulate === "sum" ||
          value.form === "by" ||
          value.form === "from-by") &&
        !value.attribute.additive
      )
        diagnostic(
          diagnostics,
          element,
          "unsupported-animation-addition",
          "The target value family does not define addition; additive and accumulate are ignored.",
          composition.additive === "sum" ? "additive" : "accumulate",
        );
    }
    if (kind === "animateMotion" && composition.keyPoints) {
      if (!composition.keyTimes || composition.keyPoints.length !== composition.keyTimes.length)
        diagnostic(
          diagnostics,
          element,
          "invalid-animation-motion-key-points",
          "animateMotion keyPoints requires a matching keyTimes entry for every point.",
          "keyPoints",
        );
      if (composition.calcMode === "spline" && composition.keySplines?.length !== composition.keyPoints.length - 1)
        diagnostic(
          diagnostics,
          element,
          "invalid-animation-motion-key-splines",
          "Spline motion requires one keySpline per keyPoints interval.",
          "keySplines",
        );
    }
    if (kind === "animateMotion" && parsedMotion?.motion && !composition.keyPoints) {
      const pointCount = parsedMotion.motion.keyDistances.length;
      if (composition.keyTimes && composition.keyTimes.length !== pointCount)
        diagnostic(
          diagnostics,
          element,
          "invalid-animation-motion-key-times",
          `Motion path has ${pointCount} authored points, so keyTimes must contain ${pointCount} entries.`,
          "keyTimes",
        );
      if (composition.calcMode === "spline" && composition.keySplines?.length !== pointCount - 1)
        diagnostic(
          diagnostics,
          element,
          "invalid-animation-motion-key-splines",
          `Motion path has ${pointCount - 1} intervals, so keySplines must contain ${pointCount - 1} entries.`,
          "keySplines",
        );
    }
    if (runtimeSupport === "pending" && (value.family !== "unsupported" || kind === "animateMotion"))
      diagnostic(
        diagnostics,
        element,
        "unsupported-animation-semantics",
        `Animation <${element.tagName}> is parsed by the value engine but target wiring is delivered by a later ticket.`,
      );
  }

  for (const targetElement of order.keys()) {
    const targetKey = property(targetElement, "id")
      ? `id:${property(targetElement, "id")}`
      : `source:${order.get(targetElement)}`;
    const targetSnapshot = targetSnapshots.get(targetKey);
    if (!targetSnapshot) continue;
    const parsed = parseCSSAnimationInstances(targetSnapshot.baseValues);
    for (const message of parsed.errors)
      diagnostic(diagnostics, targetElement, "invalid-css-animation", message, "animation");
    for (const instance of parsed.instances) {
      const rule = cssKeyframes.get(instance.name);
      if (!rule) {
        diagnostic(
          diagnostics,
          targetElement,
          "missing-css-keyframes",
          `animation-name '${instance.name}' does not match an @keyframes rule.`,
          "animation-name",
        );
        continue;
      }
      if (rule.blocks.length > maxKeyframes)
        diagnostics.push({
          code: "animation-keyframe-limit",
          message: `@keyframes ${instance.name} has ${rule.blocks.length} blocks; only the first ${maxKeyframes} are compiled.`,
          severity: limits.strict ? "error" : "warning",
          source: source(targetElement),
          attribute: "animation-name",
        });
      const ruleBlocks = rule.blocks.slice(0, maxKeyframes);
      const properties = new Set(ruleBlocks.flatMap((block) => block.declarations.map((item) => item.property)));
      for (const attributeName of properties) {
        if (attributeName.startsWith("--")) continue;
        if (targetSnapshot.importantProperties?.[attributeName]) continue;
        const attribute = resolveAnimationAttributeForTarget(attributeName, "CSS", targetSnapshot.tagName);
        if (!attribute || !attribute.animatable || !propertyAppliesToTarget(attributeName, targetSnapshot.tagName)) {
          diagnostic(
            diagnostics,
            targetElement,
            "non-animatable-css-property",
            `CSS keyframes cannot animate '${attributeName}' on <${targetSnapshot.tagName}>.`,
            attributeName,
          );
          continue;
        }
        const baseRaw = targetSnapshot.baseValues[attributeName];
        if (baseRaw === undefined) continue;
        let base = parseAnimationValue(attribute, baseRaw, targetSnapshot.context);
        if (!base) {
          diagnostic(
            diagnostics,
            targetElement,
            "invalid-css-animation-base-value",
            `The computed '${attributeName}' value '${baseRaw}' cannot be animated.`,
            attributeName,
          );
          continue;
        }
        const entries: Array<{ offset: number; value: typeof base; timingFunction: CSSTimingFunction }> = [];
        for (const block of ruleBlocks) {
          const declaration = [...block.declarations].reverse().find((item) => item.property === attributeName);
          if (!declaration) continue;
          const resolved = substituteVariables(declaration.value, (name) => {
            const value = targetSnapshot.baseValues[name];
            return value === undefined ? undefined : String(value);
          });
          const value = resolved ? parseAnimationValue(attribute, resolved, targetSnapshot.context) : undefined;
          const timingFunction = block.timingFunction
            ? parseCSSTimingFunction(block.timingFunction)
            : instance.timingFunction;
          if (!value || !timingFunction) {
            diagnostic(
              diagnostics,
              targetElement,
              "invalid-css-keyframe-value",
              `The ${Math.round(block.offset * 100)}% '${attributeName}' keyframe is invalid and is ignored.`,
              attributeName,
            );
            continue;
          }
          entries.push({ offset: block.offset, value, timingFunction });
        }
        if (attribute.family === "transform") {
          const template = entries.find(
            (entry) => entry.value.family === "transform" && entry.value.components.length > 0,
          )?.value;
          if (template) {
            base = matchNeutralTransformValue(base, template);
            for (const entry of entries) entry.value = matchNeutralTransformValue(entry.value, template);
          }
        }
        if (!entries.some((entry) => entry.offset === 0))
          entries.unshift({ offset: 0, value: base, timingFunction: instance.timingFunction });
        if (!entries.some((entry) => entry.offset === 1))
          entries.push({ offset: 1, value: base, timingFunction: instance.timingFunction });
        entries.sort((left, right) => left.offset - right.offset);
        if (entries.length < 2) continue;
        const sourceLocation = source(targetElement);
        const target: AnimationTarget = {
          key: targetKey,
          source: sourceLocation,
          reference: { type: "parent" },
          renderable: true,
          tagName: targetSnapshot.tagName,
          binding: targetSnapshot.binding ?? "render-node",
          referenceChain: (() => {
            const chain: SourceLocation[] = [];
            let current: ElementNode | undefined = targetElement;
            while (current) {
              chain.push(source(current));
              current = parents.get(current);
            }
            return chain;
          })(),
        };
        const documentOrder = nextOrder++;
        const value: AnimationValueSet = {
          family: attribute.family,
          attribute,
          base,
          values: entries.map((entry) => entry.value),
          form: "values",
        };
        const definition: AnimationDefinition = {
          stableId: `css-animation-${String(documentOrder).padStart(6, "0")}`,
          source: sourceLocation,
          target,
          kind: "cssAnimation",
          cssAnimation: {
            name: instance.name,
            duration: instance.duration,
            delay: instance.delay,
            iterationCount: instance.iterationCount,
            direction: instance.direction,
            fillMode: instance.fillMode,
            playState: instance.playState,
            segmentTimingFunctions: entries.slice(0, -1).map((entry) => entry.timingFunction),
          },
          authoredAttributeName: attributeName,
          attributeName,
          attributeType: "CSS",
          timing: {
            begin: [{ type: "offset", seconds: instance.delay }],
            duration: { type: "seconds", seconds: instance.duration },
            end: [],
            repeatCount: Number.isFinite(instance.iterationCount)
              ? { type: "count", value: instance.iterationCount }
              : { type: "indefinite" },
            restart: "always",
            fill: instance.fillMode === "forwards" || instance.fillMode === "both" ? "freeze" : "remove",
          },
          value,
          composition: {
            calcMode: attribute.family === "discrete" ? "discrete" : "linear",
            keyTimes: entries.map((entry) => entry.offset),
            additive: "replace",
            accumulate: "none",
          },
          documentOrder,
          dependencies: [],
          runtimeSupport: "typed",
        };
        animations.push(definition);
      }
    }
  }

  if (animations.length > maxDefinitions) {
    diagnostics.push({
      code: "animation-definition-limit",
      message: `Compiled animation effects exceed ${maxDefinitions}; later CSS effects are omitted deterministically.`,
      severity: limits.strict ? "error" : "warning",
      source: source(root),
    });
    animations.splice(maxDefinitions);
  }

  const compositions = new Map<string, AnimationDefinition[]>();
  for (const animation of animations) {
    if (!animation.target || !animation.attributeName) continue;
    const key = `${animation.target.key}:${animation.attributeName}`;
    const group = compositions.get(key) ?? [];
    group.push(animation);
    compositions.set(key, group);
  }
  for (const group of compositions.values()) group.sort((left, right) => left.documentOrder - right.documentOrder);

  const byId = new Map(animations.map((animation) => [animation.stableId, animation]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const evaluationOrder: string[] = [];
  const dependencyCycles: string[][] = [];
  const visitDependency = (animation: AnimationDefinition, path: string[]): void => {
    if (visited.has(animation.stableId)) return;
    if (path.length >= maxDependencyDepth) {
      diagnostics.push({
        code: "animation-dependency-depth-limit",
        message: `Animation dependency traversal exceeded ${maxDependencyDepth} levels at #${animation.stableId}.`,
        severity: limits.strict ? "error" : "warning",
        source: animation.source,
      });
      visited.add(animation.stableId);
      return;
    }
    if (visiting.has(animation.stableId)) {
      const start = path.indexOf(animation.stableId);
      const cycle = [...path.slice(Math.max(0, start)), animation.stableId];
      if (!dependencyCycles.some((candidate) => candidate.join("\0") === cycle.join("\0")))
        dependencyCycles.push(cycle);
      diagnostic(
        diagnostics,
        animationElements.find(({ element }) => property(element, "id") === animation.authoredId)?.element ?? root,
        "cyclic-animation-dependency",
        `Animation dependency cycle detected: ${cycle.join(" -> ")}.`,
      );
      return;
    }
    visiting.add(animation.stableId);
    for (const dependencyId of animation.dependencies) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        const owner = animationElements.find(
          ({ element }) => property(element, "id") === animation.authoredId,
        )?.element;
        if (owner)
          diagnostic(
            diagnostics,
            owner,
            "missing-animation-dependency",
            `Animation timing references missing animation #${dependencyId}.`,
            "begin",
          );
        continue;
      }
      visitDependency(dependency, [...path, animation.stableId]);
    }
    visiting.delete(animation.stableId);
    visited.add(animation.stableId);
    evaluationOrder.push(animation.stableId);
  };
  for (const animation of animations) visitDependency(animation, []);
  return { animations, evaluationOrder, dependencyCycles };
}

export function declarativeAnimationTag(tagName: string | undefined): boolean {
  return ANIMATION_TAGS.has((tagName ?? "").toLowerCase());
}

/** Reference sampler for the first compiler slice and exact clock-boundary tests. */
export function sampleNumericAnimation(animation: AnimationDefinition, documentTime: number): number | undefined {
  if (
    animation.runtimeSupport !== "typed" ||
    animation.value.family === "unsupported" ||
    animation.timing.duration.type !== "seconds" ||
    animation.timing.begin[0]?.type !== "offset"
  )
    return undefined;
  const sample = sampleSMILTiming(animation.timing, documentTime, [animation.timing.begin[0].seconds]);
  const scalar = (value: AnimationValueSet["base"]): number | undefined => {
    switch (value.family) {
      case "number":
      case "integer":
      case "opacity":
      case "length":
      case "angle":
        return value.value;
      default:
        return undefined;
    }
  };
  if (sample.state === "inactive" || sample.state === "completed" || sample.simpleProgress === undefined)
    return scalar(animation.value.base);
  const result = sampleAnimationValue(
    animation.value,
    animation.composition,
    sample.simpleProgress,
    sample.repeatIteration,
    animation.value.base,
  );
  return result ? scalar(result.value) : undefined;
}

/** Pure presentation-value sampling for tests, reports, and non-Swift frontends. */
export function sampleAnimatedPresentationValue(
  program: AnimationProgram,
  targetKey: string,
  attributeName: string,
  base: AnimationValueSet["base"],
  documentTime: number,
  events: readonly DeterministicTimingEvent[] = [],
): AnimationValueSet["base"] {
  const timing = sampleSMILProgram(program, documentTime, events);
  let underlying = base;
  for (const animation of program.animations
    .filter(
      (candidate) =>
        candidate.runtimeSupport === "typed" &&
        candidate.target?.key === targetKey &&
        candidate.attributeName === attributeName &&
        candidate.value.family !== "unsupported",
    )
    .sort((left, right) => left.documentOrder - right.documentOrder)) {
    if (animation.value.family === "unsupported") continue;
    const clock = timing.samples.get(animation.stableId);
    if (!clock || clock.state === "inactive" || clock.state === "completed" || clock.simpleProgress === undefined)
      continue;
    const values: AnimationValueSet =
      animation.kind === "set"
        ? {
            ...animation.value,
            form: "values",
            values: animation.value.to
              ? [animation.value.to]
              : animation.value.values
                ? [animation.value.values[animation.value.values.length - 1]!]
                : [],
          }
        : animation.value;
    const sampled = sampleAnimationValue(
      values,
      animation.kind === "set" ? { ...animation.composition, calcMode: "discrete" } : animation.composition,
      clock.simpleProgress,
      clock.repeatIteration,
      underlying,
    );
    if (sampled) underlying = sampled.value;
  }
  return underlying;
}
