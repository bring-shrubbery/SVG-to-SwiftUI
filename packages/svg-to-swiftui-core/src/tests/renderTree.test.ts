import { __testing, convert } from "../index";

type Document = ReturnType<typeof __testing.parseRenderDocument>;
type Node = Document["children"][number];

function flatten(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

describe("typed SVG render tree", () => {
  test("represents every supported geometry and structural element", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100">
        <defs><path id="mark" d="M0 0L1 1" /></defs>
        <g id="geometry" transform="translate(1 2)">
          <path d="M0 0L10 10" />
          <circle cx="10" cy="10" r="5" />
          <ellipse cx="20" cy="20" rx="5" ry="3" />
          <rect x="30" y="30" width="10" height="10" />
          <line x1="0" y1="50" x2="10" y2="50" stroke="black" />
          <polyline points="0,60 5,65 10,60" fill="none" stroke="black" />
          <polygon points="0,70 5,75 10,70" />
        </g>
        <a href="/example"><use href="#mark" x="80" y="80" /></a>
        <switch><rect width="2" height="2" /><circle cx="2" cy="2" r="1" /></switch>
      </svg>
    `);

    const nodes = flatten(document.children);
    const geometries = nodes
      .filter((node): node is Extract<Node, { type: "shape" }> => node.type === "shape")
      .map((node) => node.geometry.type);

    expect(geometries).toEqual(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "path", "rect"]);
    expect(nodes.filter((node) => node.type === "group").map((node) => node.source.element)).toEqual([
      "svg",
      "g",
      "a",
      "use",
      "switch",
    ]);
    expect(nodes.find((node) => node.type === "group" && node.referenceId === "mark")).toBeDefined();
    expect(document.resources.definitions.get("mark")?.tagName).toBe("path");
    expect(document.diagnostics).toEqual([]);
  });

  test("stores computed inherited styles and semantic paints", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20" color="#123456">
        <g fill="red" stroke-width="3" opacity="0.5">
          <rect id="target" width="20" height="20" fill="blue" style="fill: currentColor; stroke: #fff" />
        </g>
      </svg>
    `);
    const target = flatten(document.children).find(
      (node): node is Extract<Node, { type: "shape" }> => node.type === "shape" && node.source.id === "target",
    );

    expect(target?.style).toMatchObject({
      fill: { type: "solid", value: "#123456" },
      stroke: { type: "solid", value: "#fff" },
      strokeStyle: { width: 3 },
    });
    const group = flatten(document.children).find(
      (node): node is Extract<Node, { type: "group" }> => node.type === "group" && node.source.element === "g",
    );
    expect(group?.style.opacity).toBe(0.5);
  });

  test("indexes future resource categories", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 10 10"><defs>
        <symbol id="symbol" />
        <linearGradient id="paint" />
        <clipPath id="clip" />
        <mask id="mask" />
        <marker id="marker" />
        <filter id="filter" />
      </defs></svg>
    `);

    expect(document.resources.symbols.has("symbol")).toBe(true);
    expect(document.resources.paints.has("paint")).toBe(true);
    expect(document.resources.clips.has("clip")).toBe(true);
    expect(document.resources.masks.has("mask")).toBe(true);
    expect(document.resources.markers.has("marker")).toBe(true);
    expect(document.resources.filters.has("filter")).toBe(true);
  });
});

describe("output capability analysis", () => {
  test("selects Shape for tintable geometry and View for source paints", () => {
    const tintable = __testing.parseRenderDocument(`<svg viewBox="0 0 10 10"><rect width="10" height="10" /></svg>`);
    const multicolor = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/><circle cx="5" cy="5" r="2" fill="blue"/></svg>`,
    );

    expect(__testing.analyzeCapabilities(tintable)).toEqual({
      mode: "shape",
      reasons: ["all visible geometry is representable as one tintable path"],
      paintCount: 1,
    });
    expect(__testing.analyzeCapabilities(multicolor)).toMatchObject({
      mode: "view",
      reasons: ["document contains multiple distinct source paints"],
    });
    expect(__testing.analyzeCapabilities(multicolor, { preserveColors: false }).mode).toBe("shape");
  });

  test("selects View for independent opacity", () => {
    const document = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><g opacity="0.5"><rect width="10" height="10" fill="red"/></g></svg>`,
    );
    expect(__testing.analyzeCapabilities(document)).toMatchObject({
      mode: "view",
      reasons: ["document uses independent paint or group opacity"],
    });
    expect(__testing.analyzeCapabilities(document, { preserveColors: false }).mode).toBe("view");
  });

  test("emits an explicit compositing boundary for isolation", () => {
    const source = `<svg viewBox="0 0 10 10"><g style="isolation: isolate"><rect width="10" height="10" fill="red"/></g></svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(__testing.analyzeCapabilities(document, { preserveColors: false }).mode).toBe("view");
    expect(convert(source)).toContain(".compositingGroup()");
    expect(convert(source)).not.toContain(".drawingGroup()");
  });

  test("keeps intrinsic transparent paint on the View backend", () => {
    const document = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="rgba(255, 0, 0, 0.4)"/></svg>`,
    );
    expect(__testing.analyzeCapabilities(document).mode).toBe("view");
    expect(__testing.analyzeCapabilities(document, { preserveColors: false }).mode).toBe("view");
  });

  test("keeps visible descendants of hidden groups and zero-opacity paints semantic", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20"><g visibility="hidden">
        <rect width="20" height="20" fill="red" />
        <circle cx="10" cy="10" r="5" fill="blue" visibility="visible" opacity="0" />
      </g></svg>
    `);
    expect(__testing.analyzeCapabilities(document)).toMatchObject({ mode: "view", paintCount: 1 });
    const result = convert(`
      <svg viewBox="0 0 20 20"><g visibility="hidden">
        <rect width="20" height="20" fill="red" />
        <circle cx="10" cy="10" r="5" fill="blue" visibility="visible" opacity="0" />
      </g></svg>
    `);
    expect(result).toContain("Color(red: 0, green: 0, blue: 1)");
    expect(result).not.toContain("Color(red: 1, green: 0, blue: 0)");
    expect(result).toContain(".opacity(0)");
  });

  test("generates fill and stroke in computed paint order", () => {
    const source = `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="red" stroke="blue" paint-order="stroke"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    const shape = flatten(document.children).find((node) => node.type === "shape");
    expect(shape?.style.paintOrder).toEqual(["stroke", "fill", "markers"]);
    const result = convert(source);
    expect(result.indexOf("Layer0().fill(Color(red: 0, green: 0, blue: 1))")).toBeLessThan(
      result.indexOf("Layer1().fill(Color(red: 1, green: 0, blue: 0))"),
    );
  });

  test("reports invalid paint order and opacity with CSS provenance", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 10 10"><style>#target { paint-order: fill fill; opacity: nope }</style>
        <rect id="target" width="10" height="10" />
      </svg>
    `);
    expect(document.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-paint-order", css: expect.objectContaining({ selector: "#target" }) }),
        expect.objectContaining({ code: "invalid-opacity", css: expect.objectContaining({ selector: "#target" }) }),
      ]),
    );
  });

  test("computes transformed painted bounds, skipping display but retaining zero opacity", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100">
        <g transform="translate(5 7)"><rect x="10" y="20" width="30" height="10" fill="red" stroke="blue" stroke-width="4"/></g>
        <rect x="90" y="90" width="5" height="5" display="none"/>
        <rect x="50" y="50" width="10" height="10" opacity="0"/>
      </svg>
    `);
    expect(__testing.renderDocumentBounds(document)).toEqual({ x: 13, y: 25, width: 47, height: 35 });
  });

  test("reports future content and strict mode refuses to drop it", () => {
    const raw = `<svg viewBox="0 0 10 10"><text x="0" y="5">Hello</text></svg>`;
    const document = __testing.parseRenderDocument(raw);

    expect(flatten(document.children)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text", text: "Hello" })]),
    );
    expect(document.diagnostics).toEqual([
      expect.objectContaining({ code: "unsupported-text-rendering", source: { element: "text" } }),
    ]);
    expect(() => convert(raw, { strict: true })).toThrow("Text is represented in the render tree");
  });

  test("conversion is byte-identical across repeated runs", () => {
    const raw = `<svg viewBox="0 0 20 20"><g transform="translate(2 3)"><rect width="20" height="20" fill="red"/><circle cx="10" cy="10" r="5" fill="blue"/></g></svg>`;
    const first = convert(raw, { structName: "StableIcon", precision: 4 });
    expect(convert(raw, { structName: "StableIcon", precision: 4 })).toBe(first);
  });
});
