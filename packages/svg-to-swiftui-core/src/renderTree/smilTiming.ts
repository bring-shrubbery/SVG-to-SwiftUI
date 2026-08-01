import type {
  AnimationDefinition,
  AnimationDuration,
  AnimationProgram,
  AnimationTime,
  AnimationTiming,
} from "./animation";

export interface DeterministicTimingEvent {
  /** Document time in seconds. */
  time: number;
  name: string;
  targetId?: string;
  /** SMIL repeat event detail, when the event source is a repeat boundary. */
  repeatIteration?: number;
  /** Stable order for events with the same timestamp. Input order is used by default. */
  order?: number;
}

export type SMILTimingState = "inactive" | "active" | "frozen" | "completed";

export interface SMILTimingInterval {
  begin: number;
  end: number;
  naturalEnd: number;
  activeDuration: number;
  beginInstance: number;
  restartCutoff: boolean;
}

export interface SMILTimingSample {
  state: SMILTimingState;
  simpleTime?: number;
  simpleProgress?: number;
  activeDuration?: number;
  simpleDuration?: number;
  repeatIteration: number;
  isBeginBoundary: boolean;
  isEndBoundary: boolean;
  isRepeatBoundary: boolean;
  selectedBegin?: number;
  interval?: SMILTimingInterval;
  unresolved: boolean;
}

export interface SMILProgramSample {
  samples: ReadonlyMap<string, SMILTimingSample>;
  intervals: ReadonlyMap<string, readonly SMILTimingInterval[]>;
}

const EPSILON = 1e-12;

function equal(left: number, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return left === right;
  return Math.abs(left - right) <= EPSILON;
}

function finiteDuration(duration: AnimationDuration | undefined): number | undefined {
  return duration?.type === "seconds" ? duration.seconds : undefined;
}

function simpleDuration(timing: AnimationTiming): number {
  if (timing.duration.type === "seconds") return timing.duration.seconds;
  return Number.POSITIVE_INFINITY;
}

/** Duration of simple playback/repeats before min/max constraints extend or clamp it. */
export function computeSMILRepeatingDuration(timing: AnimationTiming): number {
  const simple = simpleDuration(timing);
  const repeatCount =
    timing.repeatCount.type === "count"
      ? timing.repeatCount.value
      : timing.repeatCount.type === "indefinite"
        ? Number.POSITIVE_INFINITY
        : 1;
  const repeatDuration =
    timing.repeatDuration?.type === "seconds"
      ? timing.repeatDuration.seconds
      : timing.repeatDuration?.type === "indefinite"
        ? Number.POSITIVE_INFINITY
        : undefined;

  if (simple === 0) return 0;
  if (!Number.isFinite(simple)) return repeatDuration ?? Number.POSITIVE_INFINITY;
  const counted = Number.isFinite(repeatCount) ? simple * repeatCount : Number.POSITIVE_INFINITY;
  return repeatDuration === undefined ? counted : Math.min(counted, repeatDuration);
}

/** SMIL active-duration arithmetic before begin/end interval constraints. */
export function computeSMILActiveDuration(timing: AnimationTiming): number {
  let active = computeSMILRepeatingDuration(timing);

  const minimum = finiteDuration(timing.min) ?? 0;
  const maximum = timing.max?.type === "seconds" ? timing.max.seconds : Number.POSITIVE_INFINITY;
  // Per SMIL, contradictory min/max values are both ignored.
  if (maximum >= minimum) active = Math.min(Math.max(active, minimum), maximum);
  return active;
}

function sortedUnique(values: readonly number[]): number[] {
  return [...values]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)
    .filter((value, index, array) => index === 0 || !equal(value, array[index - 1]!));
}

/** Build all deterministic intervals from already-resolved begin/end instance lists. */
export function resolveSMILIntervals(
  timing: AnimationTiming,
  beginInstances: readonly number[],
  endInstances: readonly number[] = [],
): SMILTimingInterval[] {
  const begins = sortedUnique(beginInstances);
  const ends = sortedUnique(endInstances);
  const activeDuration = computeSMILActiveDuration(timing);
  const intervals: SMILTimingInterval[] = [];

  for (const begin of begins) {
    const previous = intervals[intervals.length - 1];
    if (previous) {
      if (timing.restart === "never") continue;
      const previousActive = begin < previous.end && !equal(begin, previous.end);
      if (previousActive && timing.restart === "whenNotActive") continue;
      if (previousActive && timing.restart === "always") {
        previous.end = begin;
        previous.activeDuration = Math.max(0, begin - previous.begin);
        previous.restartCutoff = true;
      }
    }

    const naturalEnd = Number.isFinite(activeDuration) ? begin + activeDuration : Number.POSITIVE_INFINITY;
    const explicitEnd = ends.find((candidate) => candidate >= begin || equal(candidate, begin));
    const end = explicitEnd === undefined ? naturalEnd : Math.min(naturalEnd, explicitEnd);
    intervals.push({
      begin,
      end,
      naturalEnd,
      activeDuration: Math.max(0, end - begin),
      beginInstance: begin,
      restartCutoff: false,
    });
  }
  return intervals;
}

function progressAt(
  timing: AnimationTiming,
  interval: SMILTimingInterval,
  documentTime: number,
  atEnd: boolean,
): Pick<SMILTimingSample, "simpleTime" | "simpleProgress" | "repeatIteration" | "isRepeatBoundary"> {
  const simple = simpleDuration(timing);
  const elapsed = Math.max(0, (atEnd ? interval.end : documentTime) - interval.begin);
  const repeatingDuration = computeSMILRepeatingDuration(timing);
  if (Number.isFinite(repeatingDuration) && elapsed > repeatingDuration && !equal(elapsed, repeatingDuration)) {
    if (timing.fill === "remove")
      return {
        simpleTime: undefined,
        simpleProgress: undefined,
        repeatIteration: Math.max(0, Math.ceil(repeatingDuration / (simple || 1)) - 1),
        isRepeatBoundary: false,
      };
    return progressAt(
      timing,
      { ...interval, end: interval.begin + repeatingDuration },
      interval.begin + repeatingDuration,
      true,
    );
  }
  if (!Number.isFinite(simple)) {
    return { simpleTime: elapsed, simpleProgress: 0, repeatIteration: 0, isRepeatBoundary: false };
  }
  if (simple <= 0) {
    return { simpleTime: 0, simpleProgress: 1, repeatIteration: 0, isRepeatBoundary: false };
  }

  const quotient = elapsed / simple;
  const exactRepeat = elapsed > 0 && equal(quotient, Math.round(quotient));
  if (atEnd && exactRepeat) {
    return {
      simpleTime: simple,
      simpleProgress: 1,
      repeatIteration: Math.max(0, Math.round(quotient) - 1),
      isRepeatBoundary: false,
    };
  }
  const iteration = Math.max(0, Math.floor(quotient + EPSILON));
  const time = Math.max(0, elapsed - iteration * simple);
  return {
    simpleTime: time,
    simpleProgress: Math.min(1, Math.max(0, time / simple)),
    repeatIteration: iteration,
    isRepeatBoundary: exactRepeat,
  };
}

/** Pure sample of a compiled timing definition and resolved instance times. */
export function sampleSMILTiming(
  timing: AnimationTiming,
  documentTime: number,
  beginInstances: readonly number[],
  endInstances: readonly number[] = [],
  unresolved = false,
): SMILTimingSample {
  const time = Number.isFinite(documentTime) ? documentTime : 0;
  const intervals = resolveSMILIntervals(timing, beginInstances, endInstances);
  const beginBoundary = intervals.some((interval) => equal(time, interval.begin));
  const endBoundary = intervals.some((interval) => equal(time, interval.end));
  const active = intervals.find(
    (interval) => time >= interval.begin && (time < interval.end || !Number.isFinite(interval.end)),
  );
  if (active) {
    return {
      state: "active",
      ...progressAt(timing, active, time, false),
      activeDuration: active.activeDuration,
      simpleDuration: simpleDuration(timing),
      isBeginBoundary: beginBoundary,
      isEndBoundary: false,
      selectedBegin: active.begin,
      interval: active,
      unresolved,
    };
  }

  const completed = [...intervals].reverse().find((interval) => time >= interval.end);
  if (completed) {
    const hasFutureInterval = intervals.some((interval) => interval.begin > time);
    return {
      state: !hasFutureInterval && timing.fill === "freeze" ? "frozen" : "completed",
      ...progressAt(timing, completed, completed.end, true),
      activeDuration: completed.activeDuration,
      simpleDuration: simpleDuration(timing),
      isBeginBoundary: beginBoundary,
      isEndBoundary: endBoundary,
      selectedBegin: completed.begin,
      interval: completed,
      unresolved,
    };
  }

  return {
    state: "inactive",
    repeatIteration: 0,
    isBeginBoundary: false,
    isEndBoundary: false,
    isRepeatBoundary: false,
    unresolved,
  };
}

function eventTimes(time: Extract<AnimationTime, { type: "event" }>, events: readonly DeterministicTimingEvent[]) {
  return events
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) => event.name === time.event && (time.targetId === undefined || event.targetId === time.targetId),
    )
    .sort(
      (left, right) =>
        left.event.time - right.event.time || (left.event.order ?? left.index) - (right.event.order ?? right.index),
    )
    .map(({ event }) => event.time + time.offsetSeconds);
}

function resolveTimes(
  values: readonly AnimationTime[],
  intervals: ReadonlyMap<string, readonly SMILTimingInterval[]>,
  definitions: ReadonlyMap<string, AnimationDefinition>,
  events: readonly DeterministicTimingEvent[],
): { times: number[]; unresolved: boolean } {
  const times: number[] = [];
  let unresolved = false;
  for (const value of values) {
    if (value.type === "offset") times.push(value.seconds);
    else if (value.type === "syncbase") {
      const referenced = intervals.get(value.animationId);
      if (!referenced) unresolved = true;
      else
        for (const interval of referenced) {
          const base = value.phase === "begin" ? interval.begin : interval.end;
          if (Number.isFinite(base)) times.push(base + value.offsetSeconds);
        }
    } else if (value.type === "repeat") {
      const referenced = intervals.get(value.animationId);
      const definition = definitions.get(value.animationId);
      const duration = definition ? simpleDuration(definition.timing) : Number.POSITIVE_INFINITY;
      if (!referenced || !Number.isFinite(duration)) unresolved = true;
      else {
        for (const interval of referenced) {
          const repeatTime = interval.begin + duration * value.iteration;
          if (repeatTime < interval.end && !equal(repeatTime, interval.end))
            times.push(repeatTime + value.offsetSeconds);
        }
      }
    } else if (value.type === "event") {
      const resolved = eventTimes(value, events);
      if (resolved.length === 0) unresolved = true;
      times.push(...resolved);
    } else if (value.type !== "indefinite") unresolved = true;
  }
  return { times: sortedUnique(times), unresolved };
}

/** Evaluate the dependency graph in stable topological/document order. */
export function sampleSMILProgram(
  program: AnimationProgram,
  documentTime: number,
  events: readonly DeterministicTimingEvent[] = [],
): SMILProgramSample {
  const definitions = new Map(program.animations.map((animation) => [animation.stableId, animation]));
  const intervals = new Map<string, readonly SMILTimingInterval[]>();
  const samples = new Map<string, SMILTimingSample>();
  const cyclic = new Set<string>();
  for (const cycle of program.dependencyCycles) for (const id of cycle) cyclic.add(id);
  for (const id of program.evaluationOrder) {
    const animation = definitions.get(id);
    if (!animation) continue;
    if (cyclic.has(id)) {
      intervals.set(id, []);
      samples.set(id, sampleSMILTiming(animation.timing, documentTime, [], [], true));
      continue;
    }
    const begins = resolveTimes(animation.timing.begin, intervals, definitions, events);
    const ends = resolveTimes(animation.timing.end, intervals, definitions, events);
    const resolved = resolveSMILIntervals(animation.timing, begins.times, ends.times);
    intervals.set(id, resolved);
    samples.set(
      id,
      sampleSMILTiming(animation.timing, documentTime, begins.times, ends.times, begins.unresolved || ends.unresolved),
    );
  }
  return { samples, intervals };
}
