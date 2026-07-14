import { __testing, convert } from "../index";
import type { RenderNode, RenderShape } from "../renderTree/types";

function shapes(nodes: RenderNode[]): RenderShape[] {
  return nodes.flatMap((node) => (node.type === "shape" ? [node] : node.type === "group" ? shapes(node.children) : []));
}

describe("advanced SVG strokes", () => {
  test("resolves percentages, duplicates odd dash lists, and preserves negative offsets", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 200 100">
        <path id="target" d="M0 50h200" fill="none" stroke="black"
          stroke-width="10%" stroke-dasharray="5%, 10% 2px" stroke-dashoffset="-3%"/>
      </svg>
    `);
    const style = shapes(document.children)[0]!.style.strokeStyle;
    const diagonal = Math.hypot(200, 100) / Math.SQRT2;

    expect(style.width).toBeCloseTo(diagonal * 0.1);
    expect(style.dashArray).toEqual([diagonal * 0.05, diagonal * 0.1, 2, diagonal * 0.05, diagonal * 0.1, 2]);
    expect(style.dashOffset).toBeCloseTo(-diagonal * 0.03);
    expect(document.diagnostics).toEqual([]);
  });

  test("treats none and all-zero dash arrays as solid, and rejects invalid arrays", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 40 20">
        <path id="none" d="M0 2h40" stroke="black" stroke-dasharray="none"/>
        <path id="zero" d="M0 6h40" stroke="black" stroke-dasharray="0 0 0"/>
        <path id="negative" d="M0 10h40" stroke="black" stroke-dasharray="4 -1"/>
        <path id="syntax" d="M0 14h40" stroke="black" stroke-dasharray="4,,2"/>
      </svg>
    `);
    expect(shapes(document.children).map((shape) => shape.style.strokeStyle.dashArray)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(document.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["negative-stroke-dasharray", "invalid-stroke-dasharray"]),
    );
  });

  test("validates caps, joins, miter limits, and vector effects", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20"><path d="M1 10h18" stroke="black"
        stroke-linecap="triangle" stroke-linejoin="miter-clip" stroke-miterlimit="0.5"
        vector-effect="non-rotation"/></svg>
    `);
    expect(shapes(document.children)[0]!.style.strokeStyle).toMatchObject({
      lineCap: "butt",
      lineJoin: "miter",
      miterLimit: 4,
      vectorEffect: "none",
    });
    expect(document.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "invalid-stroke-linecap",
        "unsupported-stroke-linejoin",
        "invalid-stroke-miterlimit",
        "unsupported-vector-effect",
      ]),
    );
    expect(() =>
      convert(`<svg><path d="M0 0h1" stroke="black" stroke-linejoin="arcs"/></svg>`, { strict: true }),
    ).toThrow("not representable");
  });

  test("emits a complete SwiftUI StrokeStyle including normalized dash phase", () => {
    const output = convert(
      `<svg viewBox="0 0 100 20"><path d="M0 10h100" fill="none" stroke="black"
        stroke-width="4" stroke-linecap="round" stroke-linejoin="bevel"
        stroke-miterlimit="7" stroke-dasharray="10 5" stroke-dashoffset="-5"/></svg>`,
      { preserveColors: false },
    );
    expect(output).toContain(
      "StrokeStyle(lineWidth: 0.04*width, lineCap: .round, lineJoin: .bevel, miterLimit: 7, dash: [0.1*width, 0.05*width], dashPhase: 0.1*width)",
    );
  });

  test("constructs non-scaling strokes after the complete geometry transform", () => {
    const source = `<svg viewBox="0 0 100 100"><g transform="scale(3 2)">
      <path d="M10 10L20 30" fill="none" stroke="black" stroke-width="4"
        stroke-dasharray="8 4" vector-effect="non-scaling-stroke" transform="rotate(15)"/>
    </g></svg>`;
    const document = __testing.parseRenderDocument(source);
    const output = convert(source, { preserveColors: false });

    expect(__testing.analyzeCapabilities(document, { preserveColors: false })).toMatchObject({
      mode: "view",
      reasons: expect.arrayContaining(["document uses non-scaling stroke geometry"]),
    });
    expect(output.indexOf(".applying(CGAffineTransform")).toBeLessThan(output.indexOf(".strokedPath(StrokeStyle"));
    expect(output.match(/\.strokedPath\(StrokeStyle/g)).toHaveLength(1);
  });

  test("keeps ordinary strokes in local geometry and scales their outlines", () => {
    const output = convert(
      `<svg viewBox="0 0 100 100"><path d="M10 10h20" fill="none" stroke="black" stroke-width="4" transform="scale(2)"/></svg>`,
      { preserveColors: false },
    );
    expect(output.indexOf(".strokedPath(StrokeStyle")).toBeLessThan(output.indexOf(".applying(CGAffineTransform"));
  });

  test("reports transformed stroke bounds without scaling non-scaling widths", () => {
    const normal = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100"><line x1="10" y1="10" x2="20" y2="10"
        stroke="black" stroke-width="4" transform="scale(2)"/></svg>
    `);
    const nonScaling = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100"><line x1="10" y1="10" x2="20" y2="10"
        stroke="black" stroke-width="4" transform="scale(2)" vector-effect="non-scaling-stroke"/></svg>
    `);
    expect(__testing.renderNodeBounds(shapes(normal.children)[0]!)).toEqual({ x: 20, y: 16, width: 20, height: 8 });
    expect(__testing.renderNodeBounds(shapes(nonScaling.children)[0]!)).toEqual({
      x: 20,
      y: 18,
      width: 20,
      height: 4,
    });
  });

  test("bounds line cap outlines exactly and excludes zero-width strokes", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 30">
        <line id="square" x1="10" y1="10" x2="30" y2="10" stroke="black" stroke-width="4" stroke-linecap="square"/>
        <line id="round" x1="50" y1="10" x2="70" y2="10" stroke="black" stroke-width="4" stroke-linecap="round"/>
        <line id="zero" x1="10" y1="20" x2="90" y2="20" stroke="black" stroke-width="0"/>
      </svg>
    `);
    const [square, round, zero] = shapes(document.children);
    expect(__testing.renderNodeBounds(square!)).toEqual({ x: 8, y: 8, width: 24, height: 4 });
    expect(__testing.renderNodeBounds(round!)).toEqual({ x: 48, y: 8, width: 24, height: 4 });
    expect(__testing.renderNodeBounds(zero!)).toBeUndefined();
  });
});
