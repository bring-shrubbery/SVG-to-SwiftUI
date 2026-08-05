import { parseAnimationShorthand, parseCSSAnimationInstances, parseCSSTimingFunction } from "../cssAnimations";
import { __testing, convert, convertWithDiagnostics } from "../index";

describe("CSS animation syntax", () => {
  test("expands shorthand lists and applies CSS list matching", () => {
    const shorthand = parseAnimationShorthand(
      "slide 2s ease-in -250ms 2.5 alternate both paused, pulse 500ms steps(4, jump-both)",
    );
    expect(shorthand).toMatchObject({
      "animation-name": "slide, pulse",
      "animation-duration": "2s, 500ms",
      "animation-delay": "-250ms, 0s",
      "animation-iteration-count": "2.5, 1",
      "animation-direction": "alternate, normal",
      "animation-fill-mode": "both, none",
      "animation-play-state": "paused, running",
    });
    const parsed = parseCSSAnimationInstances({
      ...shorthand!,
      "animation-duration": "1s",
      "animation-delay": "0s, -500ms",
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.instances).toMatchObject([
      { name: "slide", duration: 1, delay: 0, iterationCount: 2.5, direction: "alternate" },
      { name: "pulse", duration: 1, delay: -0.5, timingFunction: { type: "steps", count: 4 } },
    ]);
  });

  test("validates cubic and step timing functions", () => {
    expect(parseCSSTimingFunction("cubic-bezier(.2, -1, .8, 2)")).toEqual({
      type: "cubic",
      x1: 0.2,
      y1: -1,
      x2: 0.8,
      y2: 2,
    });
    expect(parseCSSTimingFunction("steps(1, jump-none)")).toBeUndefined();
    expect(parseCSSTimingFunction("cubic-bezier(-.1, 0, 1, 1)")).toBeUndefined();
  });
});

describe("compiled CSS keyframes", () => {
  const source = `
    <svg viewBox="0 0 100 40"><style>
      :root { --end-x: 80; }
      @keyframes move { from { cx: 10; fill: red; } 50% { cx: var(--end-x); animation-timing-function: steps(2, end); } to { cx: 20; fill: blue; } }
      @keyframes move { from { cx: 12; fill: #ff0000; } 50% { cx: var(--end-x); animation-timing-function: steps(2, end); } to { cx: 24; fill: #0000ff; } }
      #dot { animation: move 2s cubic-bezier(.2, 0, .8, 1) -250ms 2 alternate both; }
    </style><circle id="dot" cx="8" cy="20" r="6"/>
    </svg>`;

  test("uses the last keyframes rule, resolves variables, and builds typed property effects", () => {
    const document = __testing.parseRenderDocument(source);
    const animations = document.animationProgram.animations.filter((item) => item.kind === "cssAnimation");
    expect(animations).toHaveLength(2);
    expect(animations.map((item) => item.attributeName).sort()).toEqual(["cx", "fill"]);
    const cx = animations.find((item) => item.attributeName === "cx")!;
    expect(cx).toMatchObject({
      target: { key: "id:dot" },
      value: {
        family: "length",
        values: [{ value: 12 }, { value: 80 }, { value: 24 }],
      },
      composition: { keyTimes: [0, 0.5, 1] },
      cssAnimation: {
        duration: 2,
        delay: -0.25,
        iterationCount: 2,
        direction: "alternate",
        fillMode: "both",
        segmentTimingFunctions: [{ type: "cubic" }, { type: "steps", count: 2 }],
      },
      runtimeSupport: "typed",
    });
  });

  test("lets important declarations beat animations and diagnoses malformed rules", () => {
    const importantSource = `
      <svg viewBox="0 0 20 20"><style>
        @keyframes bad { 120% { opacity: .5 } from { opacity: .2 !important } }
        #box { opacity: 0.75 !important; animation: bad 1s; }
      </style><rect id="box" width="20" height="20"/></svg>`;
    const result = convertWithDiagnostics(importantSource);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["invalid-css-keyframe-selector", "ignored-keyframe-important"]),
    );
    expect(__testing.parseRenderDocument(importantSource).animationProgram.animations).toHaveLength(0);
  });

  test("emits the native CSS timing runtime", () => {
    const swift = convert(source, { structName: "CSSKeyframes", strict: true });
    expect(swift).toContain("svgCSSAnimatedValue(documentTime: documentTime");
    expect(swift).toContain("direction: .alternate");
    expect(swift).toContain("SVGCSSTimingFunction(kind: .steps, count: 2, position: .jumpEnd)");
    expect(swift).toContain("private static func svgCSSTimingProgress");
  });

  test("cascades stylesheet longhands against inline shorthand and preserves paused state", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20"><style>
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
        #box { animation-name: fade; animation-duration: 8s; animation-play-state: running; }
      </style><rect id="box" width="20" height="20" style="animation: fade 3s linear -1s infinite reverse both paused"/></svg>`);
    expect(document.animationProgram.animations).toHaveLength(1);
    expect(document.animationProgram.animations[0]?.cssAnimation).toMatchObject({
      duration: 3,
      delay: -1,
      iterationCount: Number.POSITIVE_INFINITY,
      direction: "reverse",
      fillMode: "both",
      playState: "paused",
    });
  });

  test("reports invalid shorthand without compiling a guessed effect", () => {
    const result = convertWithDiagnostics(`
      <svg viewBox="0 0 20 20"><style>@keyframes fade { to { opacity: 0 } }</style>
      <rect id="box" width="20" height="20" style="animation: fade 1s 2s 3s"/></svg>`);
    expect(result.diagnostics.map((item) => item.code)).toContain("invalid-css-animation-shorthand");
  });
});
