import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  __testing,
  type AnimationTiming,
  computeSMILActiveDuration,
  convert,
  convertWithDiagnostics,
  resolveSMILIntervals,
  sampleNumericAnimation,
  sampleSMILProgram,
  sampleSMILTiming,
} from "../index";

function timing(overrides: Partial<AnimationTiming> = {}): AnimationTiming {
  return {
    begin: [{ type: "offset", seconds: 0 }],
    duration: { type: "seconds", seconds: 1 },
    end: [],
    repeatCount: { type: "unspecified" },
    restart: "always",
    fill: "remove",
    ...overrides,
  };
}

describe("SMIL timing syntax and graph", () => {
  test("parses clock, syncbase, repeat, eventbase, accessKey, wallclock, and all duration controls", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 10 10"><rect id="box" width="1" height="1"/>
        <animate id="other" href="#box" attributeName="x" from="0" to="1" dur="1s"/>
        <animate id="timed" href="#box" attributeName="x" from="0" to="1"
          begin="01:02:03.5;02:03.25;-250ms;other.end-200ms;other.repeat(2)+1s;button.click+1s;accessKey(a);wallclock(2026-01-01T00:00:00Z)"
          end="other.begin+2s" dur="1.5min" min="500ms" max="2h" repeatCount="2.5"
          repeatDur="3min" restart="whenNotActive" fill="freeze"/>
      </svg>`);
    const animation = document.animationProgram.animations[1]!;

    expect(animation.timing).toMatchObject({
      begin: [
        { type: "offset", seconds: 3723.5 },
        { type: "offset", seconds: 123.25 },
        { type: "offset", seconds: -0.25 },
        { type: "syncbase", animationId: "other", phase: "end", offsetSeconds: -0.2 },
        { type: "repeat", animationId: "other", iteration: 2, offsetSeconds: 1 },
        { type: "event", targetId: "button", event: "click", offsetSeconds: 1 },
        { type: "accessKey", key: "a", offsetSeconds: 0 },
        { type: "wallclock", value: "2026-01-01T00:00:00Z" },
      ],
      end: [{ type: "syncbase", animationId: "other", phase: "begin", offsetSeconds: 2 }],
      duration: { type: "seconds", seconds: 90 },
      min: { type: "seconds", seconds: 0.5 },
      max: { type: "seconds", seconds: 7200 },
      repeatCount: { type: "count", value: 2.5 },
      repeatDuration: { type: "seconds", seconds: 180 },
      restart: "whenNotActive",
      fill: "freeze",
    });
    expect(animation.dependencies).toEqual(["other", "other", "other"]);
    expect(document.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["unsupported-animation-accesskey", "unsupported-animation-wallclock"]),
    );
  });

  test("topologically resolves syncbase, repeat, and deterministic eventbase instances", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20">
        <circle id="one" cx="1" r="1"/><circle id="two" cx="1" r="1"/>
        <circle id="three" cx="1" r="1"/><circle id="four" cx="1" r="1"/>
        <animate id="a" href="#one" attributeName="cx" from="1" to="2" dur="1s" repeatCount="2"/>
        <animate id="b" href="#two" attributeName="cx" from="1" to="2" begin="a.end+200ms" dur="1s"/>
        <animate id="c" href="#three" attributeName="cx" from="1" to="2" begin="a.repeat(1)-100ms" dur="1s"/>
        <animate id="d" href="#four" attributeName="cx" from="1" to="2" begin="button.click+100ms" dur="1s"/>
      </svg>`);
    const result = sampleSMILProgram(document.animationProgram, 2.3, [
      { targetId: "button", name: "click", time: 0.5 },
    ]);

    expect(document.animationProgram.evaluationOrder).toEqual(["a", "b", "c", "d"]);
    expect(result.intervals.get("a")?.[0]).toMatchObject({ begin: 0, end: 2 });
    expect(result.intervals.get("b")?.[0]?.begin).toBeCloseTo(2.2);
    expect(result.intervals.get("c")?.[0]?.begin).toBeCloseTo(0.9);
    expect(result.intervals.get("d")?.[0]?.begin).toBeCloseTo(0.6);
    expect(result.samples.get("b")?.state).toBe("active");
    expect(result.intervals.get("c")).toHaveLength(1);
  });

  test("terminates dependency cycles as unresolved with stable diagnostics", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 10 10"><rect id="box" width="1" height="1"/>
        <animate id="a" href="#box" attributeName="x" from="0" to="1" begin="b.end" dur="1s"/>
        <animate id="b" href="#box" attributeName="y" from="0" to="1" begin="a.end" dur="1s"/>
      </svg>`);
    const sampled = sampleSMILProgram(document.animationProgram, 100);
    expect(document.animationProgram.dependencyCycles).toEqual([["a", "b", "a"]]);
    expect(sampled.samples.get("a")).toMatchObject({ state: "inactive", unresolved: true });
    expect(sampled.samples.get("b")).toMatchObject({ state: "inactive", unresolved: true });
    expect(document.diagnostics.map((item) => item.code)).toContain("cyclic-animation-dependency");
  });

  test("keeps nondeterministic timing inactive in permissive mode and rejects it in strict mode", () => {
    const source = `<svg viewBox="0 0 10 10"><rect id="box" width="1" height="1"><animate attributeName="x" from="0" to="1" begin="wallclock(2026-01-01T00:00:00Z);accessKey(a)" dur="1s"/></rect></svg>`;
    const permissive = convertWithDiagnostics(source);
    expect(permissive.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["unsupported-animation-wallclock", "unsupported-animation-accesskey"]),
    );
    expect(permissive.swift).not.toContain(".offset(x:");
    expect(() => convert(source, { strict: true })).toThrow(/unsupported-animation-(wallclock|accesskey)/);
  });
});

describe("pure SMIL state machine", () => {
  test("samples one microsecond around begin, repeat, and end boundaries", () => {
    const spec = timing({
      begin: [{ type: "offset", seconds: 0.2 }],
      duration: { type: "seconds", seconds: 0.6 },
      repeatCount: { type: "count", value: 2 },
      fill: "freeze",
    });
    const cases = [
      [0.199999, "inactive", 0, false, false, false],
      [0.2, "active", 0, true, false, false],
      [0.799999, "active", 0, false, false, false],
      [0.8, "active", 1, false, false, true],
      [1.399999, "active", 1, false, false, false],
      [1.4, "frozen", 1, false, true, false],
    ] as const;
    for (const [time, state, iteration, begin, end, repeat] of cases) {
      expect(sampleSMILTiming(spec, time, [0.2])).toMatchObject({
        state,
        repeatIteration: iteration,
        isBeginBoundary: begin,
        isEndBoundary: end,
        isRepeatBoundary: repeat,
      });
    }
  });

  test("computes fractional repeats, repeatDur, zero/indefinite duration, and min/max constraints", () => {
    expect(computeSMILActiveDuration(timing({ repeatCount: { type: "count", value: 2.5 } }))).toBe(2.5);
    expect(
      computeSMILActiveDuration(
        timing({ repeatCount: { type: "indefinite" }, repeatDuration: { type: "seconds", seconds: 3.25 } }),
      ),
    ).toBe(3.25);
    expect(
      computeSMILActiveDuration(
        timing({ duration: { type: "indefinite" }, repeatDuration: { type: "seconds", seconds: 4 } }),
      ),
    ).toBe(4);
    expect(computeSMILActiveDuration(timing({ duration: { type: "seconds", seconds: 0 } }))).toBe(0);
    expect(
      computeSMILActiveDuration(
        timing({
          repeatCount: { type: "count", value: 10 },
          min: { type: "seconds", seconds: 2 },
          max: { type: "seconds", seconds: 3 },
        }),
      ),
    ).toBe(3);
    expect(
      computeSMILActiveDuration(
        timing({
          repeatCount: { type: "count", value: 10 },
          min: { type: "seconds", seconds: 5 },
          max: { type: "seconds", seconds: 2 },
        }),
      ),
    ).toBe(10);
  });

  test("covers the behavior-changing repeat/fill/restart/min/max cross product", () => {
    const constraints = [
      { name: "none", overrides: {}, counts: { always: 3, whenNotActive: 2, never: 1 } },
      {
        name: "min",
        overrides: { min: { type: "seconds", seconds: 2 } as const },
        counts: { always: 3, whenNotActive: 2, never: 1 },
      },
      {
        name: "max",
        overrides: { max: { type: "seconds", seconds: 0.25 } as const },
        counts: { always: 3, whenNotActive: 3, never: 1 },
      },
    ];
    for (const fill of ["remove", "freeze"] as const) {
      for (const restart of ["always", "whenNotActive", "never"] as const) {
        for (const constraint of constraints) {
          const spec = timing({
            repeatCount: { type: "count", value: 1 },
            fill,
            restart,
            ...constraint.overrides,
          });
          const intervals = resolveSMILIntervals(spec, [0, 0.5, 2]);
          expect(intervals).toHaveLength(constraint.counts[restart]);
          expect(sampleSMILTiming(spec, 10, [0, 0.5, 2]).state).toBe(fill === "freeze" ? "frozen" : "completed");
        }
      }
    }
  });

  test("keeps min-extended timing active while applying fill to the ended simple presentation", () => {
    const remove = timing({ min: { type: "seconds", seconds: 2 }, fill: "remove" });
    const freeze = timing({ min: { type: "seconds", seconds: 2 }, fill: "freeze" });
    expect(sampleSMILTiming(remove, 1.5, [0])).toMatchObject({ state: "active", simpleProgress: undefined });
    expect(sampleSMILTiming(freeze, 1.5, [0])).toMatchObject({ state: "active", simpleProgress: 1 });
  });

  test("applies defaults and diagnoses invalid or conflicting duration controls", () => {
    const defaults = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><rect id="box" width="1" height="1"><animate attributeName="x" from="0" to="1"/></rect></svg>`,
    );
    expect(defaults.animationProgram.animations[0]?.timing).toMatchObject({
      duration: { type: "indefinite" },
      repeatCount: { type: "unspecified" },
      restart: "always",
      fill: "remove",
    });

    const invalid = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><rect id="box" width="1" height="1"><animate attributeName="x" from="0" to="1" dur="1s" min="2s" max="1s"/></rect></svg>`,
    );
    expect(invalid.diagnostics.map((item) => item.code)).toContain("invalid-animation-min-max");
    expect(computeSMILActiveDuration(invalid.animationProgram.animations[0]!.timing)).toBe(1);

    const zeroMax = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><rect id="box" width="1" height="1"><animate attributeName="x" from="0" to="1" dur="1s" max="0s"/></rect></svg>`,
    );
    expect(zeroMax.diagnostics.map((item) => item.code)).toContain("invalid-animation-max");
    expect(computeSMILActiveDuration(zeroMax.animationProgram.animations[0]!.timing)).toBe(1);
  });

  test("applies restart always, whenNotActive, and never deterministically", () => {
    const begins = [0, 0.5, 2];
    expect(resolveStates("always", begins)).toEqual([
      { begin: 0, end: 0.5, restartCutoff: true },
      { begin: 0.5, end: 1.5, restartCutoff: false },
      { begin: 2, end: 3, restartCutoff: false },
    ]);
    expect(resolveSMILIntervals(timing(), [0, 0.5])[0]?.activeDuration).toBe(0.5);
    expect(resolveStates("whenNotActive", begins)).toEqual([
      { begin: 0, end: 1, restartCutoff: false },
      { begin: 2, end: 3, restartCutoff: false },
    ]);
    expect(resolveStates("never", begins)).toEqual([{ begin: 0, end: 1, restartCutoff: false }]);
  });

  test("removes a completed interval during a scheduled gap and freezes only after the final interval", () => {
    const spec = timing({ fill: "freeze" });
    expect(sampleSMILTiming(spec, 1.5, [0, 2])).toMatchObject({ state: "completed", selectedBegin: 0 });
    expect(sampleSMILTiming(spec, 3, [0, 2])).toMatchObject({ state: "frozen", selectedBegin: 2 });
  });
});

function resolveStates(restart: AnimationTiming["restart"], begins: number[]) {
  return resolveSMILIntervals(timing({ restart }), begins).map(({ begin, end, restartCutoff }) => ({
    begin,
    end,
    restartCutoff,
  }));
}

describe("shared timing benchmark expectations", () => {
  test("drives TypeScript sampling and generated Swift from the same exact frame schedule", () => {
    const fixturePath = resolve(__dirname, "../../animation-tests/fixtures/benchmark-02-smil-timing.svg");
    const expectationsPath = resolve(__dirname, "../../animation-tests/smil-timing-expectations.json");
    const source = readFileSync(fixturePath, "utf8");
    const expectations = JSON.parse(readFileSync(expectationsPath, "utf8"))["benchmark-02-smil-timing"] as {
      samples: Array<{
        timeMicroseconds: number;
        state: string;
        iteration: number;
        value: number;
        beginBoundary?: boolean;
        endBoundary?: boolean;
        repeatBoundary?: boolean;
      }>;
    };
    const animation = __testing.parseRenderDocument(source).animationProgram.animations[0]!;
    for (const expected of expectations.samples) {
      const sample = sampleSMILTiming(animation.timing, expected.timeMicroseconds / 1_000_000, [0.2]);
      expect(sample).toMatchObject({
        state: expected.state,
        repeatIteration: expected.iteration,
        isBeginBoundary: expected.beginBoundary ?? false,
        isEndBoundary: expected.endBoundary ?? false,
        isRepeatBoundary: expected.repeatBoundary ?? false,
      });
      expect(sampleNumericAnimation(animation, expected.timeMicroseconds / 1_000_000)).toBe(expected.value);
    }

    const swift = convert(source, { structName: "SMILTimingBenchmark", strict: true });
    expect(swift).toContain("private struct SVGTimingSample");
    expect(swift).toContain("intervals: [(begin: 0.2, end: 1.4)]");
    expect(swift).toContain("repeatingDuration: 1.2");
    expect(swift).toContain("values: [16, 48, 80]");
  });

  test("precompiles advanced offset and syncbase intervals into generated Swift", () => {
    const swift = convert(
      `<svg viewBox="0 0 100 40">
        <circle id="source" cx="10" cy="10" r="4"><animate id="lead" attributeName="cx" values="10;20;30" calcMode="discrete" begin="0s;1.2s" dur="400ms" repeatCount="2.5" repeatDur="900ms" min="300ms" max="1s" fill="freeze"/></circle>
        <circle id="dependent" cx="10" cy="30" r="4"><animate attributeName="cx" from="10" to="90" begin="lead.end+100ms" dur="500ms" fill="freeze"/></circle>
      </svg>`,
      { structName: "AdvancedTiming", strict: true },
    );
    expect(swift).toContain("intervals: [(begin: 0, end: 0.9), (begin: 1.2, end: 2.1)]");
    expect(swift).toContain("intervals: [(begin: 1, end: 1.5), (begin: 2.2, end: 2.7)]");
    expect(swift.match(/Self\.svgAnimatedNumber\(documentTime:/g)).toHaveLength(2);
  });
});
