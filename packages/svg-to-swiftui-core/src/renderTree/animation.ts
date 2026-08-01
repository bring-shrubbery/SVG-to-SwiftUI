import type { ElementNode } from "svg-parser";
import { defaultFontMetrics } from "../lengths";
import { parseViewBox } from "../viewports";
import {
  type AnimationCalculation,
  type AnimationValueContext,
  type AnimationValueSet,
  animationAttributeSpec,
  parseAnimationValueSet,
  parseKeySplines,
  parseKeyTimes,
  sampleAnimationValue,
  validateAnimationCalculation,
} from "./animationValues";
import { sampleSMILTiming } from "./smilTiming";
import type { RenderDiagnostic, SourceLocation } from "./types";

export type AnimationKind = "animate" | "set" | "animateTransform" | "animateMotion" | "discard";

export type AnimationTime =
  | { type: "offset"; seconds: number }
  | { type: "syncbase"; animationId: string; phase: "begin" | "end"; offsetSeconds: number }
  | { type: "repeat"; animationId: string; iteration: number; offsetSeconds: number }
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
}

export interface AnimationDefinition {
  stableId: string;
  authoredId?: string;
  source: SourceLocation;
  target?: AnimationTarget;
  kind: AnimationKind;
  attributeName?: string;
  timing: AnimationTiming;
  value: AnimationValue;
  composition: AnimationCalculation;
  documentOrder: number;
  dependencies: readonly string[];
  runtimeSupport: "scalar" | "pending" | "invalid";
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

const NON_RENDERABLE_TARGETS = new Set([
  "animate",
  "animatemotion",
  "animatetransform",
  "discard",
  "set",
  "defs",
  "style",
  "script",
  "metadata",
  "title",
  "desc",
  "lineargradient",
  "radialgradient",
  "stop",
  "pattern",
  "clippath",
  "mask",
  "marker",
  "filter",
]);

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

function parseValue(
  animation: ElementNode,
  target: ElementNode | undefined,
  attributeName: string | undefined,
  context: AnimationValueContext,
): AnimationValue {
  const fromRaw = property(animation, "from");
  const toRaw = property(animation, "to");
  const byRaw = property(animation, "by");
  const valuesRaw = property(animation, "values")
    ?.split(";")
    .map((value) => value.trim());
  const baseRaw = attributeName && target ? property(target, attributeName) : undefined;
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
  if (definition.kind !== "animate" || !definition.target?.renderable || !definition.attributeName) return false;
  if (!definition.target.key.startsWith("id:") || !["cx", "x"].includes(definition.attributeName)) return false;
  if (!["number", "integer", "opacity", "length", "angle"].includes(definition.value.family)) return false;
  if (
    definition.timing.duration.type === "invalid" ||
    definition.timing.duration.type === "media" ||
    (definition.timing.duration.type === "seconds" &&
      (!Number.isFinite(definition.timing.duration.seconds) || definition.timing.duration.seconds < 0))
  )
    return false;
  const deterministicTime = (time: AnimationTime) => ["offset", "syncbase", "repeat", "indefinite"].includes(time.type);
  if (!definition.timing.begin.every(deterministicTime) || !definition.timing.end.every(deterministicTime))
    return false;
  if (
    definition.timing.repeatCount.type === "count" &&
    (!Number.isFinite(definition.timing.repeatCount.value) || definition.timing.repeatCount.value <= 0)
  )
    return false;
  if (definition.value.family === "unsupported" || definition.value.form === "invalid") return false;
  const scalar = (value: AnimationValueSet["base"] | undefined) =>
    value === undefined || ["number", "integer", "opacity", "length", "angle"].includes(value.family);
  if (
    !scalar(definition.value.base) ||
    !scalar(definition.value.from) ||
    !scalar(definition.value.to) ||
    !scalar(definition.value.by) ||
    definition.value.values?.some((value) => !scalar(value))
  )
    return false;
  const count = definition.value.values?.length ?? 2;
  return validateAnimationCalculation(count, definition.composition).length === 0;
}

/** Parse declarative SVG animation into immutable, typed compiler input. */
export function buildAnimationProgram(
  root: ElementNode,
  diagnostics: RenderDiagnostic[],
  targetContexts: ReadonlyMap<string, AnimationValueContext> = new Map(),
): AnimationProgram {
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

  const animations: AnimationDefinition[] = [];
  for (const { element, kind } of animationElements) {
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
    const renderable = !!targetElement && !NON_RENDERABLE_TARGETS.has((targetElement.tagName ?? "").toLowerCase());
    if (targetElement && !renderable)
      diagnostic(
        diagnostics,
        element,
        "wrong-animation-target-type",
        `Animation target <${targetElement.tagName}> is not a rendered graphics element.`,
        href === undefined ? undefined : "href",
      );
    const target = targetElement
      ? {
          key: property(targetElement, "id")
            ? `id:${property(targetElement, "id")}`
            : `source:${order.get(targetElement)}`,
          source: source(targetElement),
          reference,
          renderable,
        }
      : undefined;
    const attributeName = property(element, "attributeName");
    if (kind === "animate" && !attributeName)
      diagnostic(
        diagnostics,
        element,
        "missing-animation-attribute",
        "<animate> requires attributeName.",
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
    const value = parseValue(
      element,
      targetElement,
      attributeName,
      (target?.source.id ? targetContexts.get(target.source.id) : undefined) ?? animationValueContext,
    );
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
    const dependencies = [...timing.begin, ...timing.end]
      .filter(
        (time): time is Extract<AnimationTime, { type: "syncbase" | "repeat" }> =>
          time.type === "syncbase" || time.type === "repeat",
      )
      .map((time) => time.animationId);
    const baseDefinition = {
      stableId,
      ...(authoredId ? { authoredId } : {}),
      source: source(element),
      ...(target ? { target } : {}),
      kind,
      ...(attributeName ? { attributeName } : {}),
      timing,
      value,
      composition,
      documentOrder,
      dependencies,
    };
    let runtimeSupport: AnimationDefinition["runtimeSupport"] = target ? "pending" : "invalid";
    if (isRuntimeSupported(baseDefinition)) runtimeSupport = "scalar";
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
    if (value.family === "unsupported")
      diagnostic(
        diagnostics,
        element,
        animationAttributeSpec(attributeName ?? "") ? "invalid-animation-value" : "unknown-animation-attribute",
        animationAttributeSpec(attributeName ?? "")
          ? "The authored animation values are invalid for the target attribute's value family."
          : `The animation value family for '${attributeName ?? ""}' is unknown; the compiler will not guess.`,
        "attributeName",
      );
    if (value.family !== "unsupported") {
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
    if (runtimeSupport === "pending" && value.family !== "unsupported")
      diagnostic(
        diagnostics,
        element,
        "unsupported-animation-semantics",
        `Animation <${element.tagName}> is parsed by the value engine but target wiring is delivered by a later ticket.`,
      );
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
    animation.runtimeSupport !== "scalar" ||
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
