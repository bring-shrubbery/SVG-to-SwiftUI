import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type AnimationCalculation,
  type AnimationValueContext,
  type AnimationValueSet,
  addAnimationValues,
  animationAttributeSpec,
  animationValueDistance,
  animationValuesEqual,
  composeAnimationSandwich,
  cubicBezierProgress,
  interpolateAnimationValue,
  normalizeAnimationValue,
  parseAnimationValue,
  parseAnimationValueSet,
  parseKeySplines,
  parseKeyTimes,
  sampleAnimationValue,
  serializeAnimationValue,
  swiftAnimationValueLiteral,
  type TypedAnimationValue,
  validateAnimationCalculation,
} from "../index";

const context: AnimationValueContext = {
  length: {
    viewport: { width: 200, height: 100 },
    rootViewport: { width: 400, height: 300 },
    objectBoundingBox: { x: 0, y: 0, width: 80, height: 40 },
    fontMetrics: { fontSize: 20, rootFontSize: 16, xHeight: 10, zeroAdvance: 8 },
    percentageBasis: "viewport-diagonal",
    axis: "other",
  },
  colorSpace: "sRGB",
};

const calculation = (overrides: Partial<AnimationCalculation> = {}): AnimationCalculation => ({
  calcMode: "linear",
  additive: "replace",
  accumulate: "none",
  ...overrides,
});

function set(attributeName: string, raw: Parameters<typeof parseAnimationValueSet>[1]): AnimationValueSet {
  const parsed = parseAnimationValueSet(attributeName, raw, context);
  if (!parsed) throw new Error(`Unable to parse ${attributeName}`);
  return parsed;
}

function scalar(value: TypedAnimationValue): number {
  if (!["number", "integer", "opacity", "length", "angle"].includes(value.family))
    throw new Error(`Expected scalar, received ${value.family}`);
  return (value as Extract<TypedAnimationValue, { value: number }>).value;
}

describe("typed SVG animation values", () => {
  test("maps known attributes without guessing unknown properties", () => {
    expect(animationAttributeSpec("cx")).toMatchObject({ family: "length", axis: "horizontal", additive: true });
    expect(animationAttributeSpec("opacity")).toMatchObject({ family: "opacity", clamp: "unit" });
    expect(animationAttributeSpec("fill")).toMatchObject({ family: "paint" });
    expect(animationAttributeSpec("d")).toMatchObject({ family: "path", additive: false });
    expect(animationAttributeSpec("stroke-linecap")).toMatchObject({ family: "discrete", additive: false });
    expect(animationAttributeSpec("made-up-property")).toBeUndefined();
  });

  test.each([
    ["pathLength", "2.5", "number", "2.5"],
    ["order", "3", "integer", "3"],
    ["opacity", "1.5", "opacity", "1"],
    ["offset", "25%", "opacity", "0.25"],
    ["cx", "50%", "length", "100"],
    ["cy", "50%", "length", "50"],
    ["orient", `${Math.PI}rad`, "angle", "180deg"],
    ["stop-color", "rgba(255 0 128 / 50%)", "color", "rgba(255 0 128 / 0.5)"],
    ["values", "1, 2 3", "number-list", "1 2 3"],
    ["stroke-dasharray", "10% 1em", "length-list", "15.8113883008 20"],
    ["points", "0,0 10,20", "points", "0,0 10,20"],
    ["fill", "url(#gradient)", "paint", "url(#gradient)"],
    ["viewBox", "0 1 20 30", "viewBox", "0 1 20 30"],
    ["transform", "translate(2 3) rotate(45)", "transform", "translate(2 3) rotate(45)"],
    ["stroke-linecap", "round", "discrete", "round"],
  ])("parses and deterministically serializes %s", (attribute, source, family, serialized) => {
    const spec = animationAttributeSpec(attribute)!;
    const value = parseAnimationValue(spec, source, context)!;
    expect(value.family).toBe(family);
    expect(serializeAnimationValue(normalizeAnimationValue(value, spec))).toBe(serialized);
  });

  test("resolves viewport, root viewport, font, and absolute length units before interpolation", () => {
    const spec = animationAttributeSpec("cx")!;
    expect(serializeAnimationValue(parseAnimationValue(spec, "1in", context)!)).toBe("96");
    expect(serializeAnimationValue(parseAnimationValue(spec, "10vw", context)!)).toBe("40");
    expect(serializeAnimationValue(parseAnimationValue(spec, "2em", context)!)).toBe("40");
    expect(serializeAnimationValue(parseAnimationValue(spec, "2rem", context)!)).toBe("32");
  });

  test("rejects malformed values for every structured parser", () => {
    expect(parseAnimationValue(animationAttributeSpec("order")!, "1.5", context)).toBeUndefined();
    expect(parseAnimationValue(animationAttributeSpec("points")!, "0,0,10", context)).toBeUndefined();
    expect(parseAnimationValue(animationAttributeSpec("viewBox")!, "0 0 -1 2", context)).toBeUndefined();
    expect(parseAnimationValue(animationAttributeSpec("transform")!, "rotate(nope)", context)).toBeUndefined();
    expect(parseAnimationValue(animationAttributeSpec("d")!, "M nope", context)).toBeUndefined();
  });

  test("retains auto length and orient keywords as discrete alternatives", () => {
    expect(parseAnimationValue(animationAttributeSpec("x")!, "auto", context)).toEqual({
      family: "discrete",
      value: "auto",
    });
    expect(parseAnimationValue(animationAttributeSpec("orient")!, "auto-start-reverse", context)).toEqual({
      family: "discrete",
      value: "auto-start-reverse",
    });
  });

  test("compares, interpolates, measures, and adds compatible numeric vectors", () => {
    const left = parseAnimationValue(animationAttributeSpec("points")!, "0,0 10,20", context)!;
    const right = parseAnimationValue(animationAttributeSpec("points")!, "10,20 30,40", context)!;
    const middle = interpolateAnimationValue(left, right, 0.5)!;
    expect(serializeAnimationValue(middle)).toBe("5,10 20,30");
    expect(animationValueDistance(left, right)).toBeCloseTo(Math.hypot(10, 20, 20, 20));
    expect(serializeAnimationValue(addAnimationValues(left, right)!)).toBe("10,20 40,60");
    expect(animationValuesEqual(middle, interpolateAnimationValue(left, right, 0.5)!)).toBe(true);
  });

  test.each([
    ["pathLength", "1", "3", true, true, true],
    ["order", "1", "3", true, true, true],
    ["opacity", ".2", ".8", true, true, true],
    ["cx", "10%", "50%", true, true, true],
    ["orient", "0deg", ".5turn", true, true, true],
    ["stop-color", "red", "blue", true, true, true],
    ["values", "1 2", "3 4", true, true, true],
    ["stroke-dasharray", "1 2", "3 4", true, true, true],
    ["points", "0,0 1,1", "2,2 3,3", true, true, true],
    ["fill", "red", "blue", true, true, true],
    ["d", "M0 0 L1 1", "M2 2 L3 3", true, true, false],
    ["viewBox", "0 0 10 10", "2 4 20 30", true, true, true],
    ["transform", "translate(0)", "translate(10)", false, false, false],
    ["stroke-linecap", "butt", "round", false, false, false],
  ])("defines equality, interpolation, distance, and addition for the %s family", (attribute, leftSource, rightSource, interpolable, measurable, addable) => {
    const spec = animationAttributeSpec(attribute)!;
    const left = parseAnimationValue(spec, leftSource, context)!;
    const right = parseAnimationValue(spec, rightSource, context)!;
    expect(animationValuesEqual(left, left)).toBe(true);
    expect(animationValuesEqual(left, right)).toBe(false);
    expect(interpolateAnimationValue(left, right, 0.5) !== undefined).toBe(interpolable);
    expect(animationValueDistance(left, right) !== undefined).toBe(measurable);
    expect(addAnimationValues(left, right) !== undefined).toBe(addable);
  });

  test("interpolates alpha and RGB in the explicitly selected color space", () => {
    const colorSpec = animationAttributeSpec("stop-color")!;
    const black = parseAnimationValue(colorSpec, "rgba(0 0 0 / 0)", context)!;
    const white = parseAnimationValue(colorSpec, "white", context)!;
    expect(serializeAnimationValue(interpolateAnimationValue(black, white, 0.5)!)).toBe(
      "rgba(127.5 127.5 127.5 / 0.5)",
    );

    const linearContext = { ...context, colorSpace: "linearRGB" as const };
    const linearBlack = parseAnimationValue(colorSpec, "black", linearContext)!;
    const linearWhite = parseAnimationValue(colorSpec, "white", linearContext)!;
    expect(serializeAnimationValue(interpolateAnimationValue(linearBlack, linearWhite, 0.5)!)).toBe(
      "rgba(187.5160306784 187.5160306784 187.5160306784 / 1)",
    );
  });

  test("normalizes path commands and interpolates only compatible structures", () => {
    const pathSpec = animationAttributeSpec("d")!;
    const left = parseAnimationValue(pathSpec, "m0 0 h10 v10 z", context)!;
    const right = parseAnimationValue(pathSpec, "M10 20 L30 20 L30 40 Z", context)!;
    expect(serializeAnimationValue(interpolateAnimationValue(left, right, 0.5)!)).toBe("M5 10 L20 10 L20 25 Z");
    const incompatible = parseAnimationValue(pathSpec, "M0 0 C1 2 3 4 5 6", context)!;
    expect(interpolateAnimationValue(left, incompatible, 0.5)).toBeUndefined();
    expect(animationValueDistance(left, incompatible)).toBeUndefined();
    expect(addAnimationValues(left, right)).toBeUndefined();
  });

  test("interpolates color paints but treats URL and keyword paints discretely", () => {
    const paintSpec = animationAttributeSpec("fill")!;
    const red = parseAnimationValue(paintSpec, "red", context)!;
    const blue = parseAnimationValue(paintSpec, "blue", context)!;
    const gradient = parseAnimationValue(paintSpec, "url(#g)", context)!;
    expect(serializeAnimationValue(interpolateAnimationValue(red, blue, 0.5)!)).toBe("rgba(127.5 0 127.5 / 1)");
    expect(interpolateAnimationValue(red, gradient, 0.5)).toBeUndefined();
  });
});

describe("animation calculation and composition", () => {
  test("applies the specified value-form precedence and retains invalid forms", () => {
    expect(set("pathLength", { base: "0", values: ["1", "2"], from: "3", to: "4", by: "5" }).form).toBe("values");
    expect(set("pathLength", { base: "0", to: "4", by: "5" }).form).toBe("to");
    expect(set("pathLength", { base: "0", from: "3" }).form).toBe("invalid");
  });

  test.each([
    ["from-to", { base: "10", from: "20", to: "40" }, 0.25, 25],
    ["from-by", { base: "10", from: "20", by: "8" }, 0.25, 22],
    ["by", { base: "10", by: "8" }, 0.25, 12],
    ["to", { base: "10", to: "30" }, 0.25, 15],
    ["values", { base: "10", values: ["0", "20", "40"] }, 0.75, 30],
  ])("samples the %s form", (_form, raw, progress, expected) => {
    const result = sampleAnimationValue(set("pathLength", raw), calculation(), progress)!;
    expect(scalar(result.value)).toBeCloseTo(expected);
  });

  test("uses exact discrete keyTimes at and around boundaries", () => {
    const values = set("pathLength", { base: "9", values: ["0", "10", "20"] });
    const discrete = calculation({ calcMode: "discrete", keyTimes: [0, 0.25, 0.75] });
    expect(scalar(sampleAnimationValue(values, discrete, 0.249999)!.value)).toBe(0);
    expect(scalar(sampleAnimationValue(values, discrete, 0.25)!.value)).toBe(10);
    expect(scalar(sampleAnimationValue(values, discrete, 0.749999)!.value)).toBe(10);
    expect(scalar(sampleAnimationValue(values, discrete, 0.75)!.value)).toBe(20);
    expect(scalar(sampleAnimationValue(values, discrete, 1)!.value)).toBe(20);
  });

  test("uses keyTimes for linear segments and preserves exact endpoints", () => {
    const values = set("pathLength", { base: "0", values: ["0", "10", "30"] });
    const linear = calculation({ keyTimes: [0, 0.2, 1] });
    expect(scalar(sampleAnimationValue(values, linear, 0)!.value)).toBe(0);
    expect(scalar(sampleAnimationValue(values, linear, 0.1)!.value)).toBe(5);
    expect(scalar(sampleAnimationValue(values, linear, 0.2)!.value)).toBe(10);
    expect(scalar(sampleAnimationValue(values, linear, 0.6)!.value)).toBe(20);
    expect(scalar(sampleAnimationValue(values, linear, 1)!.value)).toBe(30);
  });

  test("paces segments by family distance", () => {
    const values = set("pathLength", { base: "0", values: ["0", "10", "100"] });
    const paced = calculation({ calcMode: "paced", keyTimes: [0, 0.5, 1] });
    expect(scalar(sampleAnimationValue(values, paced, 0.05)!.value)).toBeCloseTo(5);
    expect(scalar(sampleAnimationValue(values, paced, 0.5)!.value)).toBeCloseTo(50);
    expect(scalar(sampleAnimationValue(values, paced, 0.95)!.value)).toBeCloseTo(95);

    const points = set("points", { base: "0,0", values: ["0,0", "3,4", "3,14"] });
    expect(serializeAnimationValue(sampleAnimationValue(points, paced, 1 / 3)!.value)).toBe("3,4");
    expect(serializeAnimationValue(sampleAnimationValue(points, paced, 0.5)!.value)).toBe("3,6.5");
  });

  test("uses deterministic cubic Bézier inversion at endpoints and interior values", () => {
    expect(cubicBezierProgress(0, { x1: 0.42, y1: 0, x2: 0.58, y2: 1 })).toBe(0);
    expect(cubicBezierProgress(0.5, { x1: 0.42, y1: 0, x2: 0.58, y2: 1 })).toBeCloseTo(0.5, 9);
    expect(cubicBezierProgress(1, { x1: 0.42, y1: 0, x2: 0.58, y2: 1 })).toBe(1);
    const values = set("pathLength", { base: "0", from: "0", to: "100" });
    const spline = calculation({
      calcMode: "spline",
      keyTimes: [0, 1],
      keySplines: [{ x1: 0.42, y1: 0, x2: 1, y2: 1 }],
    });
    expect(scalar(sampleAnimationValue(values, spline, 0.5)!.value)).toBeCloseTo(31.535681, 5);
  });

  test("selects spline segments exactly around every keyframe boundary", () => {
    const values = set("pathLength", { base: "0", values: ["0", "10", "30"] });
    const spline = calculation({
      calcMode: "spline",
      keyTimes: [0, 0.5, 1],
      keySplines: [
        { x1: 0, y1: 0, x2: 1, y2: 1 },
        { x1: 0, y1: 0, x2: 1, y2: 1 },
      ],
    });
    const before = sampleAnimationValue(values, spline, 0.5 - 0.000001)!;
    const boundary = sampleAnimationValue(values, spline, 0.5)!;
    const after = sampleAnimationValue(values, spline, 0.5 + 0.000001)!;
    expect(before.segment).toBe(0);
    expect(scalar(before.value)).toBeLessThan(10);
    expect(boundary).toMatchObject({ segment: 1, segmentProgress: 0 });
    expect(scalar(boundary.value)).toBe(10);
    expect(after.segment).toBe(1);
    expect(scalar(after.value)).toBeGreaterThan(10);
  });

  test("falls back deterministically for incompatible and distance-less families", () => {
    const discrete = set("stroke-linecap", { base: "butt", values: ["round", "square"] });
    expect(sampleAnimationValue(discrete, calculation(), 0.25)).toMatchObject({
      value: { family: "discrete", value: "round" },
      effectiveCalcMode: "discrete",
      fallback: "discrete-only",
    });
    const path = set("d", { base: "M0 0 L10 0", values: ["M0 0 L10 0", "M0 0 C1 2 3 4 5 6"] });
    expect(sampleAnimationValue(path, calculation({ calcMode: "paced" }), 0.75)).toMatchObject({
      effectiveCalcMode: "discrete",
      fallback: "incompatible-values",
    });
  });

  test("validates keyTimes and keySplines structure", () => {
    expect(parseKeyTimes("0; .4; 1")).toEqual([0, 0.4, 1]);
    expect(parseKeyTimes("0; 2")).toBeUndefined();
    expect(parseKeySplines(".42 0 .58 1;0,0,1,1")).toEqual([
      { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
      { x1: 0, y1: 0, x2: 1, y2: 1 },
    ]);
    expect(parseKeySplines("-1 0 1 1")).toBeUndefined();
    expect(validateAnimationCalculation(3, { calcMode: "linear", keyTimes: [0, 0.5] })).toContain("keyTimes-count");
    expect(
      validateAnimationCalculation(3, {
        calcMode: "spline",
        keyTimes: [0, 0.5, 1],
        keySplines: [{ x1: 0, y1: 0, x2: 1, y2: 1 }],
      }),
    ).toContain("keySplines-count");
  });

  test("applies accumulation and additive sandwich layers in document order", () => {
    const base = set("pathLength", { base: "10", from: "0", to: "20" });
    const accumulated = sampleAnimationValue(base, calculation({ accumulate: "sum" }), 0.5, 2)!;
    expect(scalar(accumulated.value)).toBe(50);

    const lower = set("pathLength", { base: "10", from: "0", to: "20" });
    const upper = set("pathLength", { base: "10", by: "8" });
    const composed = composeAnimationSandwich(lower.base, [
      { values: upper, calculation: calculation(), progress: 0.25, repeatIteration: 0, documentOrder: 2 },
      { values: lower, calculation: calculation(), progress: 0.5, repeatIteration: 0, documentOrder: 1 },
    ]);
    expect(scalar(composed)).toBe(12);
  });

  test("uses the lower sandwich result as a to-animation's underlying value", () => {
    const lower = set("pathLength", { base: "10", from: "10", to: "30" });
    const upper = set("pathLength", { base: "10", to: "50" });
    const composed = composeAnimationSandwich(lower.base, [
      { values: lower, calculation: calculation(), progress: 0.5, repeatIteration: 0, documentOrder: 1 },
      {
        values: upper,
        calculation: calculation({ additive: "sum" }),
        progress: 0.5,
        repeatIteration: 0,
        documentOrder: 2,
      },
    ]);
    expect(scalar(composed)).toBe(35);
  });

  test("clamps only the target result while raw interpolation preserves overshoot", () => {
    const opacity = set("opacity", { base: "0.5", from: "-1", to: "2" });
    const raw = interpolateAnimationValue(opacity.from!, opacity.to!, 1.5)!;
    expect(scalar(raw)).toBe(3.5);
    expect(scalar(sampleAnimationValue(opacity, calculation(), 1)!.value)).toBe(1);
    const integer = set("order", { base: "0", from: "0", to: "3" });
    expect(scalar(sampleAnimationValue(integer, calculation(), 0.5)!.value)).toBe(2);
  });
});

describe("shared TypeScript and generated Swift value goldens", () => {
  test("matches every declared cross-runtime sample", () => {
    const golden = JSON.parse(
      readFileSync(resolve(__dirname, "../../animation-tests/animation-value-goldens.json"), "utf8"),
    ) as {
      tolerance: number;
      literalCases: Array<{
        name: string;
        attributeName: string;
        source: string;
        expected: string;
      }>;
      cases: Array<{
        name: string;
        attributeName: string;
        base: number;
        from?: number;
        to?: number;
        by?: number;
        values?: number[];
        calcMode: AnimationCalculation["calcMode"];
        keyTimes?: number[];
        keySplines?: AnimationCalculation["keySplines"];
        progress: number;
        repeatIteration: number;
        underlying?: number;
        additive: boolean;
        accumulate: boolean;
        expected: number;
      }>;
    };
    for (const item of golden.literalCases) {
      const spec = animationAttributeSpec(item.attributeName)!;
      const value = parseAnimationValue(spec, item.source, context)!;
      expect(serializeAnimationValue(normalizeAnimationValue(value, spec))).toBe(item.expected);
      expect(swiftAnimationValueLiteral(value)).toBe(swiftAnimationValueLiteral(value));
      expect(swiftAnimationValueLiteral(value)).toContain("SVGAnimationRuntimeValue(kind: .");
    }
    for (const item of golden.cases) {
      const values = set(item.attributeName, {
        base: String(item.base),
        ...(item.from === undefined ? {} : { from: String(item.from) }),
        ...(item.to === undefined ? {} : { to: String(item.to) }),
        ...(item.by === undefined ? {} : { by: String(item.by) }),
        ...(item.values ? { values: item.values.map(String) } : {}),
      });
      const underlying = parseAnimationValue(
        animationAttributeSpec(item.attributeName)!,
        String(item.underlying ?? item.base),
        context,
      )!;
      const sample = sampleAnimationValue(
        values,
        calculation({
          calcMode: item.calcMode,
          ...(item.keyTimes ? { keyTimes: item.keyTimes } : {}),
          ...(item.keySplines ? { keySplines: item.keySplines } : {}),
          additive: item.additive ? "sum" : "replace",
          accumulate: item.accumulate ? "sum" : "none",
        }),
        item.progress,
        item.repeatIteration,
        underlying,
      );
      expect(sample).toBeDefined();
      expect(Math.abs(scalar(sample!.value) - item.expected)).toBeLessThanOrEqual(golden.tolerance);
    }
  });
});
