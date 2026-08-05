import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { RgbaTolerance } from "../visual-tests/rgba-compare";

const ANIMATION_TESTS_DIR = __dirname;
export const ANIMATION_FIXTURES_DIR = resolve(ANIMATION_TESTS_DIR, "fixtures");
export const ANIMATION_MANIFEST_PATH = resolve(ANIMATION_TESTS_DIR, "animation-fixture-manifest.json");
export const SMIL_TIMING_EXPECTATIONS_PATH = resolve(ANIMATION_TESTS_DIR, "smil-timing-expectations.json");
export const ANIMATION_VALUE_GOLDENS_PATH = resolve(ANIMATION_TESTS_DIR, "animation-value-goldens.json");

export type AnimationFixtureMode = "comparison" | "reference-probe";
export type ExpectedOutputMode = "shape" | "view";
export type AnimationReferenceBackend = "webkit";

const REQUIRED_SMIL_TIMING_PROBE_TAGS = [
  "clock-values",
  "deterministic-events",
  "end-list",
  "eventbase",
  "fill",
  "fractional-repeat",
  "full-partial-clock",
  "indefinite",
  "instance-time-list",
  "min-max",
  "negative-begin",
  "repeat-count",
  "repeat-duration",
  "repeat-reference",
  "restart-always",
  "restart-never",
  "restart-when-not-active",
  "syncbase",
  "zero-duration",
] as const;

const REQUIRED_SMIL_VALUE_PROBE_TAGS = [
  "accumulate",
  "additive",
  "animation-sandwich",
  "by",
  "color",
  "color-alpha",
  "discrete",
  "from-by",
  "from-to",
  "key-splines",
  "key-times",
  "length",
  "length-list",
  "list",
  "number",
  "opacity",
  "paced",
  "paint",
  "path",
  "percentage",
  "points",
  "spline",
  "to",
  "values",
  "viewbox",
] as const;

const REQUIRED_ANIMATE_SET_BENCHMARK_TAGS = [
  "computed-presentation",
  "geometry",
  "gradient-stop",
  "href-target",
  "nested-viewport",
  "paint",
  "resource-presentation",
  "set",
  "stroke",
  "text",
  "use",
  "viewbox",
] as const;

const REQUIRED_ANIMATE_TRANSFORM_BENCHMARK_TAGS = [
  "accumulate",
  "additive",
  "animate-transform",
  "clip",
  "filter",
  "gradient",
  "marker",
  "mask",
  "nested-transform",
  "non-scaling-stroke",
  "paced",
  "pattern",
  "rotate",
  "scale",
  "skew-x",
  "skew-y",
  "spline",
  "text",
  "transform-sandwich",
  "translate",
  "use",
] as const;

const REQUIRED_ANIMATE_MOTION_BENCHMARK_TAGS = [
  "accumulate",
  "additive",
  "animate-motion",
  "auto-reverse",
  "auto-rotate",
  "closed-path",
  "discrete",
  "explicit-rotate",
  "key-points",
  "mpath",
  "nested-transform",
  "path-length",
  "point-pairs",
  "spline",
  "transform-sandwich",
] as const;

const REQUIRED_CSS_KEYFRAMES_BENCHMARK_TAGS = [
  "alternate",
  "css-keyframes",
  "custom-properties",
  "fill-mode",
  "important",
  "implicit-endpoints",
  "keyframe-easing",
  "list-matching",
  "mixed-css-smil",
  "multiple-names",
  "negative-delay",
  "reverse",
  "steps",
  "transform",
] as const;

const REQUIRED_ANIMATED_RESOURCES_BENCHMARK_TAGS = [
  "animated-bounds",
  "clip-content",
  "clip-transform",
  "filter-parameters",
  "filter-regions",
  "gradient-coordinates",
  "image",
  "marker-content",
  "marker-orientation",
  "marker-units",
  "mask-content",
  "mask-region",
  "pattern-content",
  "pattern-transform",
  "preserve-aspect-ratio",
  "resource-consumers",
  "text",
  "text-character-position",
] as const;

function validateBackground(value: string | null): void {
  if (value !== null && !/^#([\da-f]{6}|[\da-f]{8})$/i.test(value))
    throw new Error(`Background must be null, #RRGGBB, or #RRGGBBAA: ${value}`);
}

export interface AnimationTimeline {
  durationMicroseconds: number;
  framesPerSecond: number;
  sampleTimesMicroseconds?: number[];
  includeEndFrame?: boolean;
}

export interface AnimationTimelineEvent {
  timeMicroseconds: number;
  name: string;
  targetId?: string;
  order?: number;
  payload?: { x?: number; y?: number; button?: number; key?: string };
}

interface RawAnimationFixture {
  mode: AnimationFixtureMode;
  referenceBackend: AnimationReferenceBackend;
  width: number;
  height: number;
  scale?: number;
  background?: string | null;
  fonts?: string[];
  fontFamilies?: string[];
  expectedMode?: ExpectedOutputMode;
  tags: string[];
  timeline: AnimationTimeline;
  events?: AnimationTimelineEvent[];
  expectDistinctReferenceFrames?: boolean;
  tolerance?: Partial<RgbaTolerance>;
  toleranceReason?: string;
}

interface AnimationManifestFile {
  version: 1;
  defaults: {
    scale: number;
    background: string | null;
    fonts: string[];
    fontFamilies?: string[];
    tolerance: RgbaTolerance;
  };
  fixtures: Record<string, RawAnimationFixture>;
}

export interface SMILTimingExpectationSet {
  beginSeconds: number;
  durationSeconds: number;
  repeatCount: number;
  fill: "remove" | "freeze";
  values: number[];
  samples: Array<{
    timeMicroseconds: number;
    state: "inactive" | "active" | "frozen" | "completed";
    iteration: number;
    value: number;
    beginBoundary?: boolean;
    endBoundary?: boolean;
    repeatBoundary?: boolean;
  }>;
}

interface AnimationValueGoldenFile {
  version: 1;
  tolerance: number;
  literalCases: Array<{
    name: string;
    attributeName: string;
    source: string;
    expected: string;
  }>;
  cases: Array<{
    name: string;
    form: string;
    calcMode: string;
    clamp: string;
    expected: number;
  }>;
}

export interface AnimationFrame {
  index: number;
  timeMicroseconds: number;
  stem: string;
}

export interface LoadedAnimationFixture {
  name: string;
  relativePath: string;
  sourcePath: string;
  mode: AnimationFixtureMode;
  referenceBackend: AnimationReferenceBackend;
  width: number;
  height: number;
  scale: number;
  background: string | null;
  fonts: string[];
  fontFamilies: string[];
  expectedMode?: ExpectedOutputMode;
  tags: string[];
  timeline: AnimationTimeline;
  events: AnimationTimelineEvent[];
  frames: AnimationFrame[];
  expectDistinctReferenceFrames: boolean;
  tolerance: RgbaTolerance;
  toleranceReason?: string;
}

function findSvgFiles(directory = ANIMATION_FIXTURES_DIR): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...findSvgFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".svg")) files.push(path);
  }
  return files.sort();
}

function fixtureKey(path: string): string {
  return relative(ANIMATION_FIXTURES_DIR, path)
    .replace(/\\/g, "/")
    .replace(/\.svg$/, "");
}

export function animationFrameStem(index: number, timeMicroseconds: number): string {
  return `${String(index).padStart(6, "0")}-${String(timeMicroseconds).padStart(15, "0")}`;
}

export function timelineFrames(timeline: AnimationTimeline): AnimationFrame[] {
  const explicit = timeline.sampleTimesMicroseconds;
  const times = explicit
    ? [...explicit]
    : Array.from(
        {
          length:
            Math.floor((timeline.durationMicroseconds * timeline.framesPerSecond) / 1_000_000) +
            (timeline.includeEndFrame ? 1 : 0),
        },
        (_, index) => Math.floor((index * 1_000_000) / timeline.framesPerSecond),
      );
  return times.map((timeMicroseconds, index) => ({
    index,
    timeMicroseconds,
    stem: animationFrameStem(index, timeMicroseconds),
  }));
}

function readManifest(): AnimationManifestFile {
  return JSON.parse(readFileSync(ANIMATION_MANIFEST_PATH, "utf8")) as AnimationManifestFile;
}

export function loadSMILTimingExpectations(): Record<string, SMILTimingExpectationSet> {
  return JSON.parse(readFileSync(SMIL_TIMING_EXPECTATIONS_PATH, "utf8")) as Record<string, SMILTimingExpectationSet>;
}

export function loadAnimationValueGoldens(): AnimationValueGoldenFile {
  return JSON.parse(readFileSync(ANIMATION_VALUE_GOLDENS_PATH, "utf8")) as AnimationValueGoldenFile;
}

export function loadAnimationFixtures(): LoadedAnimationFixture[] {
  const manifest = readManifest();
  if (manifest.version !== 1) throw new Error(`Unsupported animation fixture manifest version: ${manifest.version}`);
  return Object.entries(manifest.fixtures)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, entry]) => ({
      name,
      relativePath: `${name}.svg`,
      sourcePath: resolve(ANIMATION_FIXTURES_DIR, `${name}.svg`),
      mode: entry.mode,
      referenceBackend: entry.referenceBackend,
      width: entry.width,
      height: entry.height,
      scale: entry.scale ?? manifest.defaults.scale,
      background: entry.background === undefined ? manifest.defaults.background : entry.background,
      fonts: entry.fonts ?? manifest.defaults.fonts,
      fontFamilies: entry.fontFamilies ?? manifest.defaults.fontFamilies ?? [],
      ...(entry.expectedMode ? { expectedMode: entry.expectedMode } : {}),
      tags: entry.tags,
      timeline: entry.timeline,
      events: entry.events ?? [],
      frames: timelineFrames(entry.timeline),
      expectDistinctReferenceFrames: entry.expectDistinctReferenceFrames ?? false,
      tolerance: { ...manifest.defaults.tolerance, ...entry.tolerance },
      ...(entry.toleranceReason ? { toleranceReason: entry.toleranceReason } : {}),
    }));
}

function validPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateAnimationManifest(): string[] {
  const errors: string[] = [];
  let manifest: AnimationManifestFile;
  let fixtures: LoadedAnimationFixture[];
  let timingExpectations: Record<string, SMILTimingExpectationSet>;
  let valueGoldens: AnimationValueGoldenFile;
  try {
    manifest = readManifest();
    fixtures = loadAnimationFixtures();
    timingExpectations = loadSMILTimingExpectations();
    valueGoldens = loadAnimationValueGoldens();
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  const actual = new Set(findSvgFiles().map(fixtureKey));
  const declared = new Set(fixtures.map((fixture) => fixture.name));
  for (const name of actual)
    if (!declared.has(name)) errors.push(`Animation fixture missing from manifest: ${name}.svg`);
  for (const name of declared) if (!actual.has(name)) errors.push(`Animation manifest entry has no SVG: ${name}.svg`);
  for (const name of Object.keys(timingExpectations))
    if (!declared.has(name)) errors.push(`SMIL timing expectations have no manifest fixture: ${name}`);
  const timingProbeTags = new Set(
    fixtures
      .filter((fixture) => fixture.mode === "reference-probe" && fixture.tags.includes("smil-timing"))
      .flatMap((fixture) => fixture.tags),
  );
  for (const tag of REQUIRED_SMIL_TIMING_PROBE_TAGS)
    if (!timingProbeTags.has(tag)) errors.push(`SMIL timing reference probes do not cover required tag: ${tag}`);
  const valueProbeTags = new Set(
    fixtures
      .filter((fixture) => fixture.mode === "reference-probe" && fixture.tags.includes("smil-values"))
      .flatMap((fixture) => fixture.tags),
  );
  for (const tag of REQUIRED_SMIL_VALUE_PROBE_TAGS)
    if (!valueProbeTags.has(tag)) errors.push(`SMIL value reference probes do not cover required tag: ${tag}`);
  const animateSetBenchmarkTags = new Set(
    fixtures
      .filter((fixture) => fixture.mode === "comparison" && fixture.tags.includes("benchmark-05"))
      .flatMap((fixture) => fixture.tags),
  );
  for (const tag of REQUIRED_ANIMATE_SET_BENCHMARK_TAGS)
    if (!animateSetBenchmarkTags.has(tag))
      errors.push(`Animate/set comparison benchmark does not cover required tag: ${tag}`);
  const animateTransformBenchmarkTags = new Set(
    fixtures
      .filter((fixture) => fixture.mode === "comparison" && fixture.tags.includes("benchmark-06"))
      .flatMap((fixture) => fixture.tags),
  );
  for (const tag of REQUIRED_ANIMATE_TRANSFORM_BENCHMARK_TAGS)
    if (!animateTransformBenchmarkTags.has(tag))
      errors.push(`animateTransform comparison benchmark does not cover required tag: ${tag}`);
  const animateMotionBenchmarkTags = new Set(
    fixtures
      .filter((fixture) => fixture.mode === "comparison" && fixture.tags.includes("benchmark-07"))
      .flatMap((fixture) => fixture.tags),
  );
  for (const tag of REQUIRED_ANIMATE_MOTION_BENCHMARK_TAGS)
    if (!animateMotionBenchmarkTags.has(tag))
      errors.push(`animateMotion comparison benchmark does not cover required tag: ${tag}`);
  const cssKeyframesBenchmarkTags = new Set(
    fixtures
      .filter((fixture) => fixture.mode === "comparison" && fixture.tags.includes("benchmark-08"))
      .flatMap((fixture) => fixture.tags),
  );
  for (const tag of REQUIRED_CSS_KEYFRAMES_BENCHMARK_TAGS)
    if (!cssKeyframesBenchmarkTags.has(tag))
      errors.push(`CSS keyframes comparison benchmark does not cover required tag: ${tag}`);
  const animatedResourcesBenchmarkTags = new Set(
    fixtures
      .filter((fixture) => fixture.mode === "comparison" && fixture.tags.includes("benchmark-09"))
      .flatMap((fixture) => fixture.tags),
  );
  for (const tag of REQUIRED_ANIMATED_RESOURCES_BENCHMARK_TAGS)
    if (!animatedResourcesBenchmarkTags.has(tag))
      errors.push(`Animated resources comparison benchmark does not cover required tag: ${tag}`);
  if (valueGoldens.version !== 1) errors.push(`Unsupported animation value golden version: ${valueGoldens.version}`);
  if (!Number.isFinite(valueGoldens.tolerance) || valueGoldens.tolerance <= 0)
    errors.push("Animation value golden tolerance must be finite and positive");
  if (new Set(valueGoldens.cases.map((item) => item.name)).size !== valueGoldens.cases.length)
    errors.push("Animation value golden names must be unique");
  if (new Set(valueGoldens.literalCases.map((item) => item.name)).size !== valueGoldens.literalCases.length)
    errors.push("Animation value literal golden names must be unique");
  for (const required of [
    "angle",
    "color",
    "discrete",
    "integer",
    "length",
    "length-list",
    "number",
    "number-list",
    "opacity",
    "paint",
    "path",
    "points",
    "transform",
    "viewBox",
  ])
    if (!valueGoldens.literalCases.some((item) => item.name === required))
      errors.push(`Animation value literal goldens do not cover family: ${required}`);
  for (const required of ["values", "from-to", "from-by", "by", "to"])
    if (!valueGoldens.cases.some((item) => item.form === required))
      errors.push(`Animation value goldens do not cover form: ${required}`);
  for (const required of ["discrete", "linear", "paced", "spline"])
    if (!valueGoldens.cases.some((item) => item.calcMode === required))
      errors.push(`Animation value goldens do not cover calcMode: ${required}`);
  for (const item of valueGoldens.cases)
    if (!Number.isFinite(item.expected)) errors.push(`Animation value golden ${item.name} has a non-finite result`);

  for (const fixture of fixtures) {
    const prefix = `${fixture.name}:`;
    const raw = manifest.fixtures[fixture.name]!;
    if (!Number.isFinite(fixture.width) || fixture.width <= 0) errors.push(`${prefix} width must be positive`);
    if (!Number.isFinite(fixture.height) || fixture.height <= 0) errors.push(`${prefix} height must be positive`);
    if (!Number.isFinite(fixture.scale) || fixture.scale <= 0) errors.push(`${prefix} scale must be positive`);
    if (!validPositiveInteger(fixture.timeline.durationMicroseconds))
      errors.push(`${prefix} durationMicroseconds must be a positive safe integer`);
    if (!validPositiveInteger(fixture.timeline.framesPerSecond))
      errors.push(`${prefix} framesPerSecond must be a positive safe integer`);
    if (fixture.timeline.framesPerSecond > 240) errors.push(`${prefix} framesPerSecond must not exceed 240`);
    if (
      fixture.events.some(
        (event, index) =>
          !Number.isSafeInteger(event.timeMicroseconds) ||
          event.timeMicroseconds < 0 ||
          event.timeMicroseconds > fixture.timeline.durationMicroseconds ||
          event.name.trim() === "" ||
          (event.order !== undefined && !Number.isSafeInteger(event.order)) ||
          (event.payload?.x !== undefined && !Number.isFinite(event.payload.x)) ||
          (event.payload?.y !== undefined && !Number.isFinite(event.payload.y)) ||
          (event.payload?.button !== undefined && !Number.isSafeInteger(event.payload.button)) ||
          (index > 0 && event.timeMicroseconds < fixture.events[index - 1]!.timeMicroseconds),
      )
    )
      errors.push(`${prefix} events and payloads must be named, ordered, finite, and inside the timeline`);
    if (fixture.frames.length === 0) errors.push(`${prefix} timeline must produce at least one frame`);
    if (fixture.frames.length > 10_000) errors.push(`${prefix} timeline must not exceed 10,000 frames`);
    const times = fixture.frames.map((frame) => frame.timeMicroseconds);
    const timingExpectation = timingExpectations[fixture.name];
    if (
      timingExpectation &&
      JSON.stringify(times) !== JSON.stringify(timingExpectation.samples.map((sample) => sample.timeMicroseconds))
    )
      errors.push(`${prefix} frame schedule must exactly match its shared SMIL timing expectations`);
    if (times.some((time) => !Number.isSafeInteger(time) || time < 0))
      errors.push(`${prefix} sample times must be non-negative safe integer microseconds`);
    if (new Set(times).size !== times.length) errors.push(`${prefix} sample times must be unique`);
    if (times.some((time, index) => index > 0 && time <= times[index - 1]!))
      errors.push(`${prefix} sample times must be strictly increasing`);
    if (times.some((time) => time > fixture.timeline.durationMicroseconds))
      errors.push(`${prefix} sample times must not exceed durationMicroseconds`);
    if (fixture.mode === "comparison" && !fixture.expectedMode)
      errors.push(`${prefix} comparison fixtures require expectedMode`);
    if (fixture.mode === "reference-probe" && fixture.expectedMode)
      errors.push(`${prefix} reference probes must not declare expectedMode`);
    if (fixture.referenceBackend !== "webkit") errors.push(`${prefix} referenceBackend must be webkit`);
    if (fixture.expectDistinctReferenceFrames && fixture.frames.length < 2)
      errors.push(`${prefix} distinct-frame probes require at least two frames`);
    if (fixture.tags.length === 0) errors.push(`${prefix} at least one feature tag is required`);
    if (new Set(fixture.tags).size !== fixture.tags.length) errors.push(`${prefix} feature tags must be unique`);
    if (raw.tolerance && !raw.toleranceReason)
      errors.push(`${prefix} tolerance overrides require a narrow justification`);
    if (raw.toleranceReason && !raw.tolerance) errors.push(`${prefix} toleranceReason requires an override`);
    try {
      validateBackground(fixture.background);
    } catch (error) {
      errors.push(`${prefix} ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const font of fixture.fonts) {
      const fontPath = resolve(ANIMATION_TESTS_DIR, font);
      if (!fontPath.startsWith(ANIMATION_TESTS_DIR) || !existsSync(fontPath))
        errors.push(`${prefix} deterministic font does not exist: ${font}`);
    }
    if (fixture.fonts.length > 0 && fixture.fontFamilies.length === 0)
      errors.push(`${prefix} deterministic fonts require at least one fontFamilies entry`);
    if (!existsSync(fixture.sourcePath)) continue;
    const source = readFileSync(fixture.sourcePath, "utf8");
    if (/<script\b/i.test(source)) errors.push(`${prefix} authored scripts are forbidden in animation fixtures`);
    if (/<(?:audio|video|iframe|object|embed|canvas)\b/i.test(source))
      errors.push(`${prefix} active media and embedded browsing content are forbidden`);
    if (/\son[a-z]+\s*=/i.test(source)) errors.push(`${prefix} authored event handlers are forbidden`);
    if (/\b(?:href|src)\s*=\s*["']https?:\/\//i.test(source) || /url\(\s*["']?https?:\/\//i.test(source))
      errors.push(`${prefix} network resources are forbidden`);
    if (/@import\s+(?:url\(\s*)?["']?https?:\/\//i.test(source))
      errors.push(`${prefix} network stylesheet imports are forbidden`);
    for (const match of source.matchAll(/<(?:image|feImage)\b[^>]*\b(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)) {
      const href = match[1]!;
      if (/^(?:data:|#)/i.test(href)) continue;
      if (!existsSync(resolve(dirname(fixture.sourcePath), href)))
        errors.push(`${prefix} local image resource does not exist: ${href}`);
    }
  }
  return errors;
}
