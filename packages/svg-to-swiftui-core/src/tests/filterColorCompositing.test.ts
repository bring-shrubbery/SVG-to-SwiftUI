import { __testing, convert, convertWithDiagnostics } from "../index";
import {
  blendFilterPixels,
  colorMatrixFilterPixel,
  componentTransferFilterPixel,
  componentTransferValue,
  compositeFilterPixels,
  convertFilterPixel,
  type FilterPixel,
} from "../renderTree/filterMath";
import type { FilterBlendMode, RenderNode } from "../renderTree/types";

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

function primitives(source: string) {
  const document = __testing.parseRenderDocument(source);
  const node = flatten(document.children).find((candidate) => candidate.filter);
  if (!node?.filter) throw new Error("Expected a filter instance");
  return node.filter.primitives;
}

function expectPixel(actual: FilterPixel, expected: FilterPixel, digits = 7): void {
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, digits);
  });
}

describe("filter color and compositing semantics", () => {
  test("retains every feBlend mode as a binary graph primitive", () => {
    const modes: FilterBlendMode[] = [
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
    ];
    const graph = primitives(`<svg viewBox="0 0 10 10"><defs><filter id="f">
      <feFlood flood-color="red" result="paint"/>
      ${modes.map((mode) => `<feBlend in="SourceGraphic" in2="paint" mode="${mode}"/>`).join("")}
    </filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`);
    expect(graph.slice(1).map((primitive) => primitive.type === "blend" && primitive.mode)).toEqual(modes);
    expect(graph[1]).toMatchObject({
      type: "blend",
      input: { type: "sourceGraphic" },
      input2: { type: "result", index: 0 },
    });
  });

  test("expands all feColorMatrix forms and uses identity for malformed value counts", () => {
    const graph = primitives(`<svg viewBox="0 0 10 10"><defs><filter id="f">
      <feColorMatrix type="matrix" values="1, 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 1 0"/>
      <feColorMatrix type="saturate" values="0"/>
      <feColorMatrix type="hueRotate" values="90"/>
      <feColorMatrix type="luminanceToAlpha"/>
      <feColorMatrix type="matrix" values="1 2"/>
    </filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`);
    expect(graph[0]?.type === "colorMatrix" && graph[0].matrix).toEqual([
      1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
    ]);
    expect(graph[1]?.type === "colorMatrix" && graph[1].matrix.slice(0, 8)).toEqual([
      0.213, 0.715, 0.072, 0, 0, 0.213, 0.715, 0.072,
    ]);
    expect(graph[2]?.type === "colorMatrix" && graph[2].matrix).toHaveLength(20);
    expect(graph[3]).toMatchObject({
      type: "colorMatrix",
      matrix: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0],
    });
    expect(graph[4]?.type === "colorMatrix" && graph[4].matrix).toEqual([
      1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
    ]);
  });

  test("parses every component transfer function, last duplicate wins, and missing channels are identity", () => {
    const graph = primitives(`<svg viewBox="0 0 10 10"><defs><filter id="f"><feComponentTransfer>
      <feFuncR type="linear" slope="2" intercept="-.2"/><feFuncR type="table" tableValues="0,.25 1"/>
      <feFuncG type="discrete" tableValues="0 .5 1"/>
      <feFuncB type="gamma" amplitude="2" exponent="3" offset=".1"/>
    </feComponentTransfer></filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`);
    expect(graph[0]).toMatchObject({
      type: "componentTransfer",
      functions: [
        { type: "table", values: [0, 0.25, 1] },
        { type: "discrete", values: [0, 0.5, 1] },
        { type: "gamma", amplitude: 2, exponent: 3, offset: 0.1 },
        { type: "identity" },
      ],
    });
  });

  test("retains every feComposite operator and arithmetic coefficients", () => {
    const operators = ["over", "in", "out", "atop", "xor", "lighter", "arithmetic"];
    const graph = primitives(`<svg viewBox="0 0 10 10"><defs><filter id="f"><feFlood result="paint"/>
      ${operators.map((operator) => `<feComposite in="SourceGraphic" in2="paint" operator="${operator}" k1="1" k2="2" k3="3" k4="4"/>`).join("")}
    </filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`);
    expect(graph.slice(1).map((primitive) => primitive.type === "composite" && primitive.operator)).toEqual(operators);
    expect(graph[graph.length - 1]).toMatchObject({ type: "composite", k1: 1, k2: 2, k3: 3, k4: 4 });
  });

  test("diagnoses invalid enums, lists, numbers, and applies documented fallbacks", () => {
    const result = convertWithDiagnostics(`<svg viewBox="0 0 10 10"><defs><filter id="f">
      <feBlend mode="unknown"/><feColorMatrix type="bad" values="1, ,2"/>
      <feComponentTransfer><feFuncR type="bad"/><feFuncG type="linear" slope="nope"/></feComponentTransfer>
      <feComposite operator="bad" k1="nope"/>
    </filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "invalid-filter-blend-mode",
        "invalid-filter-color-matrix-type",
        "invalid-filter-values",
        "invalid-filter-component-transfer-type",
        "invalid-filter-slope",
        "invalid-filter-composite-operator",
        "invalid-filter-k1",
      ]),
    );
  });

  test("emits typed Swift runtime cases without confusing feBlend with element blend modes", () => {
    const swift = convert(`<svg viewBox="0 0 10 10"><defs><filter id="f">
      <feBlend in2="FillPaint" mode="color-dodge"/><feColorMatrix type="saturate" values=".5"/>
      <feComponentTransfer><feFuncA type="linear" slope=".5"/></feComponentTransfer>
      <feComposite in2="SourceGraphic" operator="arithmetic" k2="1"/>
    </filter></defs><rect width="10" height="10" fill="red" filter="url(#f)"/></svg>`);
    expect(swift).toContain("case blend(input: SVGFilterInput");
    expect(swift).toContain("mode: .colorDodge");
    expect(swift).toContain("case colorMatrix(input: SVGFilterInput");
    expect(swift).toContain("case componentTransfer(input: SVGFilterInput");
    expect(swift).toContain(".linear(slope: 0.5, intercept: 0)");
    expect(swift).toContain("operation: .arithmetic");
    expect(swift).toContain("private static func unpremultiplied");
  });
});

describe("filter color and compositing reference pixels", () => {
  test.each([
    ["normal", [0.9, 0.4, 0.3, 1]],
    ["multiply", [0.18, 0.28, 0.12, 1]],
    ["screen", [0.92, 0.82, 0.58, 1]],
    ["overlay", [0.36, 0.64, 0.24, 1]],
    ["darken", [0.2, 0.4, 0.3, 1]],
    ["lighten", [0.9, 0.7, 0.4, 1]],
    ["color-dodge", [1, 1, 4 / 7, 1]],
    ["color-burn", [1 / 9, 0.25, 0, 1]],
    ["hard-light", [0.84, 0.56, 0.24, 1]],
    ["soft-light", [0.3984, 0.658, 0.304, 1]],
    ["difference", [0.7, 0.3, 0.1, 1]],
    ["exclusion", [0.74, 0.54, 0.46, 1]],
    ["hue", [0.817833333, 0.401166667, 0.317833333, 1]],
    ["saturation", [0.1366, 0.7366, 0.3766, 1]],
    ["color", [0.878, 0.378, 0.278, 1]],
    ["luminosity", [0.222, 0.722, 0.422, 1]],
  ] as const)("computes %s", (mode, expected) => {
    expectPixel(blendFilterPixels([0.9, 0.4, 0.3, 1], [0.2, 0.7, 0.4, 1], mode), expected);
  });

  test("blends half-alpha inputs with source-over and ignores hidden RGB at zero alpha", () => {
    expectPixel(blendFilterPixels([0.4, 0.1, 0.2, 0.5], [0.05, 0.3, 0.1, 0.5], "multiply"), [0.245, 0.23, 0.17, 0.75]);
    expectPixel(blendFilterPixels([1, 0, 1, 0], [0.1, 0.2, 0.3, 0.5], "screen"), [0.1, 0.2, 0.3, 0.5]);
  });

  test("applies matrices to unpremultiplied RGBA then safely repremultiplies", () => {
    const matrix = [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0.5, 0.25];
    expectPixel(colorMatrixFilterPixel([0.1, 0.2, 0.3, 0.5], matrix), [0.5, 0.2, 0, 0.5]);
    expectPixel(colorMatrixFilterPixel([1, 1, 1, 0], matrix), [0.25, 0, 0, 0.25]);
  });

  test("uses exact table and discrete boundaries including empty and single-value tables", () => {
    expect(componentTransferValue(0.25, { type: "table", values: [0, 1] })).toBeCloseTo(0.25);
    expect(componentTransferValue(1, { type: "table", values: [0, 0.5, 0.75] })).toBe(0.75);
    expect(componentTransferValue(0.4999, { type: "discrete", values: [0, 0.5] })).toBe(0);
    expect(componentTransferValue(0.5, { type: "discrete", values: [0, 0.5] })).toBe(0.5);
    expect(componentTransferValue(0.7, { type: "table", values: [] })).toBe(0.7);
    expect(componentTransferValue(0.7, { type: "table", values: [0.2] })).toBe(0.2);
  });

  test("applies identity, table, discrete, linear, and gamma functions with alpha replacement", () => {
    expectPixel(
      componentTransferFilterPixel(
        [0.1, 0.2, 0.3, 0.5],
        [
          { type: "identity" },
          { type: "table", values: [1, 0] },
          { type: "discrete", values: [0, 1] },
          { type: "linear", slope: 0.5, intercept: 0.1 },
        ],
      ),
      [0.07, 0.21, 0.35, 0.35],
    );
    expect(componentTransferValue(0.5, { type: "gamma", amplitude: 2, exponent: 2, offset: -0.1 })).toBeCloseTo(0.4);
    expect(componentTransferValue(0, { type: "gamma", amplitude: 1, exponent: -1, offset: 0 })).toBe(1);
  });

  test.each([
    ["over", [0.45, 0.25, 0.3, 0.75]],
    ["in", [0.2, 0.05, 0.1, 0.25]],
    ["out", [0.2, 0.05, 0.1, 0.25]],
    ["atop", [0.25, 0.2, 0.2, 0.5]],
    ["xor", [0.25, 0.2, 0.2, 0.5]],
    ["lighter", [0.5, 0.4, 0.4, 1]],
  ] as const)("computes Porter-Duff %s", (operator, expected) => {
    expectPixel(compositeFilterPixels([0.4, 0.1, 0.2, 0.5], [0.1, 0.3, 0.2, 0.5], operator), expected);
  });

  test("clamps arithmetic channels and enforces the premultiplied alpha constraint", () => {
    expectPixel(
      compositeFilterPixels([0.4, 0.1, 0.2, 0.5], [0.1, 0.3, 0.2, 0.5], "arithmetic", [0, -1, 0, 0.7]),
      [0.2, 0.2, 0.2, 0.2],
    );
  });

  test("converts premultiplied samples between sRGB and linearRGB without alpha fringes", () => {
    const linear = convertFilterPixel([0.25, 0.1, 0.4, 0.5], true, false);
    expectPixel(convertFilterPixel(linear, true, true), [0.25, 0.1, 0.4, 0.5], 6);
    expectPixel(convertFilterPixel([1, 0, 1, 0], true, false), [0, 0, 0, 0]);
  });
});
