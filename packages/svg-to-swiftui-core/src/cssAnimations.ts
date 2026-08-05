export const CSS_ANIMATION_LONGHANDS = [
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-delay",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-play-state",
] as const;

export type CSSAnimationLonghand = (typeof CSS_ANIMATION_LONGHANDS)[number];

export type CSSTimingFunction =
  | { type: "linear" }
  | { type: "cubic"; x1: number; y1: number; x2: number; y2: number }
  | {
      type: "steps";
      count: number;
      position: "jump-start" | "jump-end" | "jump-none" | "jump-both";
    };

export interface CSSAnimationInstance {
  name: string;
  duration: number;
  delay: number;
  timingFunction: CSSTimingFunction;
  iterationCount: number;
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  fillMode: "none" | "forwards" | "backwards" | "both";
  playState: "running" | "paused";
  listIndex: number;
}

export const CSS_ANIMATION_INITIALS: Record<CSSAnimationLonghand, string> = {
  "animation-name": "none",
  "animation-duration": "0s",
  "animation-timing-function": "ease",
  "animation-delay": "0s",
  "animation-iteration-count": "1",
  "animation-direction": "normal",
  "animation-fill-mode": "none",
  "animation-play-state": "running",
};

/** Split a CSS comma-list without splitting functions or quoted names. */
export function splitCSSList(source: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      result.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(source.slice(start).trim());
  return result;
}

function splitComponents(source: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  const flush = (end: number) => {
    const value = source.slice(start, end).trim();
    if (value) result.push(value);
  };
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (/\s/.test(character) && depth === 0) {
      flush(index);
      start = index + 1;
    }
  }
  flush(source.length);
  return result;
}

function parseTime(source: string): number | undefined {
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(ms|s)$/i.exec(source);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value * (match[2]!.toLowerCase() === "ms" ? 0.001 : 1) : undefined;
}

export function parseCSSTimingFunction(source: string): CSSTimingFunction | undefined {
  const value = source.trim().toLowerCase();
  const presets: Record<string, CSSTimingFunction> = {
    linear: { type: "linear" },
    ease: { type: "cubic", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
    "ease-in": { type: "cubic", x1: 0.42, y1: 0, x2: 1, y2: 1 },
    "ease-out": { type: "cubic", x1: 0, y1: 0, x2: 0.58, y2: 1 },
    "ease-in-out": { type: "cubic", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
    "step-start": { type: "steps", count: 1, position: "jump-start" },
    "step-end": { type: "steps", count: 1, position: "jump-end" },
  };
  if (presets[value]) return presets[value];
  const cubic =
    /^cubic-bezier\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/i.exec(
      value,
    );
  if (cubic) {
    const [x1, y1, x2, y2] = cubic.slice(1).map(Number) as [number, number, number, number];
    return x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1 ? { type: "cubic", x1, y1, x2, y2 } : undefined;
  }
  const steps = /^steps\(\s*(\d+)\s*(?:,\s*(start|end|jump-start|jump-end|jump-none|jump-both))?\s*\)$/i.exec(value);
  if (steps) {
    const count = Number(steps[1]);
    const raw = steps[2]?.toLowerCase() ?? "end";
    const position = raw === "start" ? "jump-start" : raw === "end" ? "jump-end" : raw;
    if (count < 1 || (position === "jump-none" && count < 2)) return undefined;
    return { type: "steps", count, position: position as Extract<CSSTimingFunction, { type: "steps" }>["position"] };
  }
  return undefined;
}

function unquote(source: string): string {
  const trimmed = source.trim();
  return (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ? trimmed.slice(1, -1)
    : trimmed;
}

export function parseAnimationShorthand(source: string): Record<CSSAnimationLonghand, string> | undefined {
  const items = splitCSSList(source);
  if (items.length === 0 || items.some((item) => !item)) return undefined;
  const values = {} as Record<CSSAnimationLonghand, string[]>;
  for (const property of CSS_ANIMATION_LONGHANDS) values[property] = [];
  for (const item of items) {
    let duration: string | undefined;
    let delay: string | undefined;
    let timing: string | undefined;
    let iteration: string | undefined;
    let direction: string | undefined;
    let fill: string | undefined;
    let play: string | undefined;
    let name: string | undefined;
    for (const token of splitComponents(item)) {
      const lower = token.toLowerCase();
      const time = parseTime(token);
      if (time !== undefined && duration === undefined) duration = token;
      else if (time !== undefined && delay === undefined) delay = token;
      else if (timing === undefined && parseCSSTimingFunction(token)) timing = token;
      else if (iteration === undefined && (lower === "infinite" || /^\d*(?:\.\d+)?$/.test(lower))) iteration = token;
      else if (direction === undefined && ["normal", "reverse", "alternate", "alternate-reverse"].includes(lower))
        direction = lower;
      else if (fill === undefined && ["none", "forwards", "backwards", "both"].includes(lower)) fill = lower;
      else if (play === undefined && ["running", "paused"].includes(lower)) play = lower;
      else if (name === undefined) name = unquote(token);
      else return undefined;
    }
    if (duration !== undefined && (parseTime(duration) ?? -1) < 0) return undefined;
    values["animation-name"].push(name ?? "none");
    values["animation-duration"].push(duration ?? "0s");
    values["animation-timing-function"].push(timing ?? "ease");
    values["animation-delay"].push(delay ?? "0s");
    values["animation-iteration-count"].push(iteration ?? "1");
    values["animation-direction"].push(direction ?? "normal");
    values["animation-fill-mode"].push(fill ?? "none");
    values["animation-play-state"].push(play ?? "running");
  }
  return Object.fromEntries(
    CSS_ANIMATION_LONGHANDS.map((property) => [property, values[property].join(", ")]),
  ) as Record<CSSAnimationLonghand, string>;
}

function listItem(source: string, index: number): string | undefined {
  const values = splitCSSList(source);
  return values.length === 0 || values.some((value) => value === "") ? undefined : values[index % values.length];
}

export function parseCSSAnimationInstances(values: Readonly<Record<string, string | number>>): {
  instances: CSSAnimationInstance[];
  errors: string[];
} {
  const errors: string[] = [];
  const names = splitCSSList(String(values["animation-name"] ?? "none"));
  if (names.some((name) => !name)) return { instances: [], errors: ["animation-name contains an empty list item"] };
  const instances: CSSAnimationInstance[] = [];
  for (let index = 0; index < names.length; index++) {
    const name = unquote(names[index]!);
    if (name.toLowerCase() === "none") continue;
    const durationRaw = listItem(String(values["animation-duration"] ?? "0s"), index);
    const delayRaw = listItem(String(values["animation-delay"] ?? "0s"), index);
    const timingRaw = listItem(String(values["animation-timing-function"] ?? "ease"), index);
    const iterationRaw = listItem(String(values["animation-iteration-count"] ?? "1"), index);
    const directionRaw = listItem(String(values["animation-direction"] ?? "normal"), index)?.toLowerCase();
    const fillRaw = listItem(String(values["animation-fill-mode"] ?? "none"), index)?.toLowerCase();
    const playRaw = listItem(String(values["animation-play-state"] ?? "running"), index)?.toLowerCase();
    const duration = durationRaw === undefined ? undefined : parseTime(durationRaw);
    const delay = delayRaw === undefined ? undefined : parseTime(delayRaw);
    const timingFunction = timingRaw === undefined ? undefined : parseCSSTimingFunction(timingRaw);
    const iterationCount = iterationRaw?.toLowerCase() === "infinite" ? Number.POSITIVE_INFINITY : Number(iterationRaw);
    if (duration === undefined || duration < 0) errors.push(`${name}: invalid animation-duration '${durationRaw}'`);
    if (delay === undefined) errors.push(`${name}: invalid animation-delay '${delayRaw}'`);
    if (!timingFunction) errors.push(`${name}: invalid animation-timing-function '${timingRaw}'`);
    if ((!Number.isFinite(iterationCount) && iterationRaw?.toLowerCase() !== "infinite") || iterationCount < 0)
      errors.push(`${name}: invalid animation-iteration-count '${iterationRaw}'`);
    if (!directionRaw || !["normal", "reverse", "alternate", "alternate-reverse"].includes(directionRaw))
      errors.push(`${name}: invalid animation-direction '${directionRaw}'`);
    if (!fillRaw || !["none", "forwards", "backwards", "both"].includes(fillRaw))
      errors.push(`${name}: invalid animation-fill-mode '${fillRaw}'`);
    if (!playRaw || !["running", "paused"].includes(playRaw))
      errors.push(`${name}: invalid animation-play-state '${playRaw}'`);
    if (errors.some((error) => error.startsWith(`${name}:`))) continue;
    instances.push({
      name,
      duration: duration!,
      delay: delay!,
      timingFunction: timingFunction!,
      iterationCount,
      direction: directionRaw as CSSAnimationInstance["direction"],
      fillMode: fillRaw as CSSAnimationInstance["fillMode"],
      playState: playRaw as CSSAnimationInstance["playState"],
      listIndex: index,
    });
  }
  return { instances, errors };
}
