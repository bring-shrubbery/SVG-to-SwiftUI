import type { ElementNode } from "svg-parser";
import type { RenderDiagnostic, SourceLocation } from "./types";

export type AnimationKind = "animate" | "set" | "animateTransform" | "animateMotion" | "discard";

export type AnimationTime =
  | { type: "offset"; seconds: number }
  | { type: "syncbase"; animationId: string; phase: "begin" | "end"; offsetSeconds: number }
  | { type: "event"; targetId?: string; event: string; offsetSeconds: number }
  | { type: "indefinite" }
  | { type: "invalid"; syntax: string };

export type AnimationDuration =
  | { type: "seconds"; seconds: number }
  | { type: "indefinite" }
  | { type: "media" }
  | { type: "invalid"; syntax: string };

export type AnimationValue =
  | {
      type: "number";
      base: number;
      from?: number;
      to?: number;
      by?: number;
      values?: readonly number[];
    }
  | {
      type: "unsupported";
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
  composition: {
    additive: "replace" | "sum";
    accumulate: "none" | "sum";
    calcMode: "discrete" | "linear" | "paced" | "spline";
  };
  documentOrder: number;
  dependencies: readonly string[];
  runtimeSupport: "numeric-linear" | "pending" | "invalid";
}

export interface AnimationProgram {
  animations: readonly AnimationDefinition[];
  /** Stable dependency order. Presentation sampling must never mutate the static render tree. */
  evaluationOrder: readonly string[];
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
  if (clock) return Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  const unit = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(ms|s|min|h)?$/.exec(value);
  if (!unit) return undefined;
  const number = Number(unit[1]);
  const multiplier = unit[2] === "ms" ? 0.001 : unit[2] === "min" ? 60 : unit[2] === "h" ? 3600 : 1;
  return Number.isFinite(number) ? number * multiplier : undefined;
}

function parseTime(raw: string): AnimationTime {
  const value = raw.trim();
  if (value === "indefinite") return { type: "indefinite" };
  const offset = parseClock(value);
  if (offset !== undefined) return { type: "offset", seconds: offset };
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
  if (!raw) return fallback;
  return raw
    .split(";")
    .map(parseTime)
    .filter((value, index, values) => value.type !== "invalid" || values.length === 1 || index < values.length);
}

function parseDuration(raw: string | undefined): AnimationDuration {
  if (!raw) return { type: "invalid", syntax: "" };
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
): AnimationValue {
  const fromRaw = property(animation, "from");
  const toRaw = property(animation, "to");
  const byRaw = property(animation, "by");
  const valuesRaw = property(animation, "values")
    ?.split(";")
    .map((value) => value.trim());
  const baseRaw = attributeName && target ? property(target, attributeName) : undefined;
  const base = numeric(baseRaw) ?? 0;
  const from = numeric(fromRaw);
  const to = numeric(toRaw);
  const by = numeric(byRaw);
  const values = valuesRaw?.map(numeric);
  if (
    (fromRaw === undefined || from !== undefined) &&
    (toRaw === undefined || to !== undefined) &&
    (byRaw === undefined || by !== undefined) &&
    (!values || values.every((value) => value !== undefined))
  ) {
    return {
      type: "number",
      base,
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      ...(by === undefined ? {} : { by }),
      ...(values ? { values: values as number[] } : {}),
    };
  }
  return {
    type: "unsupported",
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
  if (definition.value.type !== "number") return false;
  if (definition.value.from === undefined || definition.value.to === undefined) return false;
  if (definition.timing.duration.type !== "seconds" || definition.timing.duration.seconds <= 0) return false;
  if (definition.timing.begin.length !== 1 || definition.timing.begin[0]?.type !== "offset") return false;
  if (definition.timing.end.length > 0) return false;
  if (definition.timing.repeatCount.type !== "unspecified" || definition.timing.repeatDuration) return false;
  return definition.composition.additive === "replace" && definition.composition.accumulate === "none";
}

/** Parse declarative SVG animation into immutable, typed compiler input. */
export function buildAnimationProgram(root: ElementNode, diagnostics: RenderDiagnostic[]): AnimationProgram {
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
    const timing: AnimationTiming = {
      begin: parseTimes(property(element, "begin"), [{ type: "offset", seconds: 0 }]),
      duration: parseDuration(property(element, "dur")),
      end: parseTimes(property(element, "end"), []),
      ...(parseOptionalDuration(property(element, "min"))
        ? { min: parseOptionalDuration(property(element, "min")) }
        : {}),
      ...(parseOptionalDuration(property(element, "max"))
        ? { max: parseOptionalDuration(property(element, "max")) }
        : {}),
      repeatCount: parseRepeatCount(property(element, "repeatCount")),
      ...(parseOptionalDuration(property(element, "repeatDur"))
        ? { repeatDuration: parseOptionalDuration(property(element, "repeatDur")) }
        : {}),
      restart: (property(element, "restart") as AnimationTiming["restart"]) ?? "always",
      fill: property(element, "fill") === "freeze" ? "freeze" : "remove",
    };
    const value = parseValue(element, targetElement, attributeName);
    const dependencies = timing.begin
      .filter((time): time is Extract<AnimationTime, { type: "syncbase" }> => time.type === "syncbase")
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
      composition: {
        additive: property(element, "additive") === "sum" ? ("sum" as const) : ("replace" as const),
        accumulate: property(element, "accumulate") === "sum" ? ("sum" as const) : ("none" as const),
        calcMode: (property(element, "calcMode") as AnimationDefinition["composition"]["calcMode"]) ?? "linear",
      },
      documentOrder,
      dependencies,
    };
    let runtimeSupport: AnimationDefinition["runtimeSupport"] = target ? "pending" : "invalid";
    if (isRuntimeSupported(baseDefinition)) runtimeSupport = "numeric-linear";
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
    if (value.type === "unsupported")
      diagnostic(
        diagnostics,
        element,
        "unsupported-animation-value",
        "This animation value family is not implemented yet.",
      );
    if (runtimeSupport === "pending" && value.type !== "unsupported")
      diagnostic(
        diagnostics,
        element,
        "unsupported-animation-semantics",
        `Animation <${element.tagName}> uses timing or composition semantics not implemented by this ticket.`,
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
  for (const group of compositions.values()) {
    if (group.length < 2) continue;
    for (const animation of group) animation.runtimeSupport = "pending";
    const owner = animationElements.find(({ element }) => order.get(element) === group[0]?.documentOrder)?.element;
    if (owner)
      diagnostic(
        diagnostics,
        owner,
        "unsupported-animation-composition",
        "Multiple animations target the same property; deterministic composition is implemented by a later ticket.",
      );
  }

  const byId = new Map(animations.map((animation) => [animation.stableId, animation]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const evaluationOrder: string[] = [];
  const visitDependency = (animation: AnimationDefinition, path: string[]): void => {
    if (visited.has(animation.stableId)) return;
    if (visiting.has(animation.stableId)) {
      diagnostic(
        diagnostics,
        animationElements.find(({ element }) => property(element, "id") === animation.authoredId)?.element ?? root,
        "cyclic-animation-dependency",
        `Animation dependency cycle detected: ${[...path, animation.stableId].join(" -> ")}.`,
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
  return { animations, evaluationOrder };
}

export function declarativeAnimationTag(tagName: string | undefined): boolean {
  return ANIMATION_TAGS.has((tagName ?? "").toLowerCase());
}

/** Reference sampler for the first compiler slice and exact clock-boundary tests. */
export function sampleNumericAnimation(animation: AnimationDefinition, documentTime: number): number | undefined {
  if (
    animation.runtimeSupport !== "numeric-linear" ||
    animation.value.type !== "number" ||
    animation.value.from === undefined ||
    animation.value.to === undefined ||
    animation.timing.duration.type !== "seconds" ||
    animation.timing.begin[0]?.type !== "offset"
  )
    return undefined;
  const time = Number.isFinite(documentTime) ? documentTime : 0;
  const begin = animation.timing.begin[0].seconds;
  const duration = animation.timing.duration.seconds;
  if (time < begin) return animation.value.base;
  if (duration <= 0 || time >= begin + duration)
    return animation.timing.fill === "freeze" ? animation.value.to : animation.value.base;
  const progress = (time - begin) / duration;
  return animation.value.from + (animation.value.to - animation.value.from) * progress;
}
