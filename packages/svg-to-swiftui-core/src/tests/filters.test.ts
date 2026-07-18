import { __testing, convert, convertWithDiagnostics } from "../index";
import type { RenderNode } from "../renderTree/types";

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

function filtered(source: string): RenderNode {
  const node = flatten(__testing.parseRenderDocument(source).children).find((candidate) => candidate.filter);
  if (!node) throw new Error("Expected a filtered render node");
  return node;
}

describe("SVG filter graph and common primitives", () => {
  test("retains Level 1 defaults and materializes a target-specific graph", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 50"><defs><filter id="f">
        <feGaussianBlur stdDeviation="3 2" result="blur"/>
        <feOffset in="blur" dx="4" dy="5" result="shift"/>
        <feFlood flood-color="#336699" flood-opacity=".5" result="paint"/>
        <feMerge><feMergeNode in="paint"/><feMergeNode in="shift"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter></defs><rect x="10" y="5" width="80" height="40" fill="red" filter="url(#f)"/></svg>
    `);
    expect(document.resources.filters.get("f")).toMatchObject({
      units: "objectBoundingBox",
      primitiveUnits: "userSpaceOnUse",
      colorInterpolation: "linearRGB",
      x: { value: -10, unit: "%" },
      y: { value: -10, unit: "%" },
      width: { value: 120, unit: "%" },
      height: { value: 120, unit: "%" },
    });
    const target = flatten(document.children).find((node) => node.filter)!;
    expect(target.filter).toMatchObject({
      region: { x: 2, y: 1, width: 96, height: 48 },
      invalid: false,
      primitives: [
        { type: "gaussianBlur", input: { type: "sourceGraphic" }, stdDeviationX: 3, stdDeviationY: 2 },
        { type: "offset", input: { type: "result", index: 0 }, dx: 4, dy: 5, result: "shift" },
        { type: "flood", color: { red: 0.2, green: 0.4, blue: 0.6, alpha: 0.5 } },
        {
          type: "merge",
          inputs: [{ type: "result", index: 2 }, { type: "result", index: 1 }, { type: "sourceGraphic" }],
        },
      ],
    });
  });

  test("resolves href inheritance, local overrides, and inherited invalidity", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20"><defs>
        <filter id="base" filterUnits="userSpaceOnUse" x="1" y="2" width="18" height="16"><feOffset dx="3"/></filter>
        <filter id="copy" href="#base" y="4"/>
        <filter id="missing" href="#nope"/>
        <filter id="invalid-copy" href="#missing"/>
      </defs><rect width="10" height="10" filter="url(#copy)"/></svg>
    `);
    expect(document.resources.filters.get("copy")).toMatchObject({
      href: "base",
      units: "userSpaceOnUse",
      x: { value: 1 },
      y: { value: 4 },
      width: { value: 18 },
      primitives: [{ type: "offset", dx: 3 }],
      invalid: false,
    });
    expect(document.resources.filters.get("invalid-copy")?.invalid).toBe(true);
    expect(document.diagnostics.map(({ code }) => code)).toContain("missing-filter-href-resource");
  });

  test("resolves primitiveUnits, primitive subregions, and context paints", () => {
    const target = filtered(`
      <svg viewBox="0 0 200 100"><defs><filter id="f" primitiveUnits="objectBoundingBox"
        x="0" y="0" width="100%" height="100%">
        <feOffset in="FillPaint" dx=".1" dy=".2" x="10%" y="20%" width="50%" height="60%"/>
        <feMerge><feMergeNode in="StrokePaint"/><feMergeNode in="SourceAlpha"/></feMerge>
      </filter></defs><rect x="20" y="10" width="100" height="50" fill="#ff0000" fill-opacity=".4"
        stroke="#0000ff" stroke-opacity=".25" filter="url(#f)"/></svg>
    `);
    expect(target.filter).toMatchObject({
      region: { x: 20, y: 10, width: 100, height: 50 },
      fillPaint: { red: 1, green: 0, blue: 0, alpha: 0.4 },
      strokePaint: { red: 0, green: 0, blue: 1, alpha: 0.25 },
      primitives: [
        {
          type: "offset",
          input: { type: "fillPaint" },
          dx: 10,
          dy: 10,
          subregion: { x: 30, y: 20, width: 50, height: 30 },
        },
        { type: "merge", inputs: [{ type: "strokePaint" }, { type: "sourceAlpha" }] },
      ],
    });
  });

  test("uses the closest preceding duplicate result and diagnoses malformed graphs", () => {
    const result = convertWithDiagnostics(`
      <svg viewBox="0 0 20 20"><defs><filter id="f">
        <feOffset result="same"/><feFlood result="same"/>
        <feGaussianBlur in="same" stdDeviation="-2" edgeMode="bad"/>
        <feOffset in="future"/><feOffset in="BackgroundImage"/>
        <feColorMatrix in="SourceGraphic"/>
      </filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>
    `);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "duplicate-filter-result",
        "negative-filter-stddeviation",
        "invalid-filter-edge-mode",
        "unknown-filter-input",
        "unsupported-filter-background-input",
        "unsupported-filter-primitive",
      ]),
    );
    const target = filtered(`
      <svg viewBox="0 0 20 20"><defs><filter id="f"><feOffset result="same"/><feFlood result="same"/><feGaussianBlur in="same"/></filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>
    `);
    expect(target.filter?.primitives[2]).toMatchObject({ input: { type: "result", index: 1 } });
    const binary = filtered(`
      <svg viewBox="0 0 10 10"><defs><filter id="f"><feComposite in="SourceAlpha" in2="FillPaint"/></filter></defs>
      <rect width="10" height="10" filter="url(#f)"/></svg>
    `);
    expect(binary.filter?.primitives[0]).toMatchObject({
      type: "passthrough",
      input: { type: "sourceAlpha" },
      input2: { type: "fillPaint" },
    });
  });

  test("diagnoses cycles, wrong resources, invalid references, and empty object bounds", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20"><defs><path id="shape" d="M0 0h1v1z"/>
        <filter id="wrong" href="#shape"/><filter id="a" href="#b"/><filter id="b" href="#a"/>
      </defs><path d="M0 0" filter="url(#wrong)"/><rect x="2" width="3" height="3" filter="url(#missing)"/>
      <rect x="6" width="3" height="3" filter="none extra"/></svg>
    `);
    expect(document.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "wrong-filter-href-resource-type",
        "cyclic-filter-reference",
        "missing-filter-resource",
        "invalid-filter-reference",
      ]),
    );
  });

  test("emits the reusable premultiplied RGBA runtime and preserves effect order", () => {
    const swift = convert(`
      <svg viewBox="0 0 40 30"><defs><filter id="f"><feDropShadow dx="2" dy="3" stdDeviation="1"/></filter>
      <clipPath id="c"><rect width="20" height="20"/></clipPath><mask id="m"><rect width="40" height="30" fill="white"/></mask></defs>
      <rect width="30" height="20" fill="red" filter="url(#f)" clip-path="url(#c)" mask="url(#m)" opacity=".5"/>
      </svg>
    `);
    expect(swift).toContain("private struct SVGFilterBitmap");
    expect(swift).toContain("case dropShadow");
    expect(swift).toContain("SVGFilteredCanvas(definition:");
    expect(swift.indexOf("SVGFilteredCanvas(definition:")).toBeLessThan(swift.indexOf(".clipShape("));
    expect(swift.indexOf(".clipShape(")).toBeLessThan(swift.indexOf(".mask {"));
    expect(swift.indexOf(".mask {")).toBeLessThan(swift.indexOf(".opacity(0.5)"));
    expect(
      __testing.analyzeCapabilities(
        __testing.parseRenderDocument(
          `<svg viewBox="0 0 10 10"><defs><filter id="f"><feOffset/></filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`,
        ),
      ).reasons,
    ).toContain("document uses an SVG filter graph");
  });

  test("includes transformed filter extents in painted bounds before clipping", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100"><defs><filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feFlood flood-color="red"/></filter>
      <clipPath id="c"><rect x="5" y="5" width="40" height="30"/></clipPath></defs>
      <rect x="10" y="10" width="20" height="10" transform="translate(10 5) scale(2)" filter="url(#f)" clip-path="url(#c)"/>
      </svg>
    `);
    const target = flatten(document.children).find((node) => node.filter)!;
    expect(__testing.renderNodeBounds(target)).toEqual({ x: 20, y: 15, width: 70, height: 40 });
  });
});
