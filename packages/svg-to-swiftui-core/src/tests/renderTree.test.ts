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
