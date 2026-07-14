import { __testing, convert } from "../index";
import { markerVertices } from "../renderTree/markers";
import type { RenderGroup, RenderNode, RenderShape } from "../renderTree/types";

function shapes(nodes: RenderNode[]): RenderShape[] {
  return nodes.flatMap((node) => (node.type === "shape" ? [node] : node.type === "group" ? shapes(node.children) : []));
}

function markerRoots(shape: RenderShape): RenderGroup[] {
  return shape.markers ?? [];
}

describe("SVG marker rendering", () => {
  test("materializes start, mid, and end shadow trees with automatic bisector orientation", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100"><defs>
        <marker id="dot" markerWidth="10" markerHeight="10" refX="5" refY="5"
          markerUnits="userSpaceOnUse" orient="auto"><circle cx="5" cy="5" r="4"/></marker>
      </defs><polyline id="target" points="10,10 40,10 40,50" fill="none"
        marker-start="url(#dot)" marker-mid="url(#dot)" marker-end="url(#dot)"/>
      </svg>
    `);
    const target = shapes(document.children).find((shape) => shape.source.id === "target")!;
    const markers = markerRoots(target);

    expect(document.resources.markers.get("dot")).toMatchObject({
      units: "userSpaceOnUse",
      orient: { type: "auto" },
      overflow: "hidden",
    });
    expect(markers.map((marker) => marker.markerPlacement?.kind)).toEqual(["start", "mid", "end"]);
    expect(markers.map((marker) => marker.markerPlacement?.x)).toEqual([10, 40, 40]);
    expect(markers.map((marker) => marker.markerPlacement?.y)).toEqual([10, 10, 50]);
    expect(markers.map((marker) => marker.markerPlacement?.angle)).toEqual([0, 45, 90]);
    expect(document.diagnostics).toEqual([]);
  });

  test("uses equivalent path vertices for basic shapes and every path subpath", () => {
    expect(markerVertices({ type: "circle", cx: 10, cy: 10, r: 5 })).toHaveLength(5);
    expect(markerVertices({ type: "ellipse", cx: 10, cy: 10, rx: 8, ry: 4 })).toHaveLength(5);
    expect(markerVertices({ type: "rect", x: 0, y: 0, width: 20, height: 10 })).toHaveLength(5);
    expect(markerVertices({ type: "rect", x: 0, y: 0, width: 20, height: 10, rx: 2, ry: 3 })).toHaveLength(9);
    expect(markerVertices({ type: "polygon", points: "0,0 10,0 10,10" })).toHaveLength(4);

    const vertices = markerVertices({ type: "path", d: "M0 0L10 0M20 20L20 30" });
    expect(vertices.map(({ x, y, angle }) => [x, y, angle])).toEqual([
      [0, 0, 0],
      [10, 0, 0],
      [20, 20, 90],
      [20, 30, 90],
    ]);
  });

  test("resolves coincident curve controls and zero-length segment directions", () => {
    const vertices = markerVertices({
      type: "path",
      d: "M0 0 C0 0 10 0 10 0 L10 0 L10 10",
    });
    expect(vertices).toHaveLength(4);
    expect(vertices[0]!.angle).toBeCloseTo(0);
    expect(vertices[1]!.angle).toBeCloseTo(0);
    expect(vertices[2]!.angle).toBeCloseTo(90);
    expect(vertices[3]!.angle).toBeCloseTo(90);

    const arc = markerVertices({ type: "path", d: "M10 20 A10 10 0 0 1 20 30" });
    expect(arc[0]!.angle).toBeCloseTo(0);
    expect(arc[1]!.angle).toBeCloseTo(90);

    const independentSubpaths = markerVertices({ type: "path", d: "M0 0V10M20 20L20 20H30" });
    expect(independentSubpaths[2]!.angle).toBeCloseTo(0);
    expect(independentSubpaths[3]!.angle).toBeCloseTo(0);
  });

  test("keeps the incoming direction at an exact 180-degree reversal", () => {
    const vertices = markerVertices({ type: "polyline", points: "0,0 10,0 0,0" });
    expect(vertices[1]!.angle).toBeCloseTo(0);
  });

  test("supports auto-start-reverse and explicit deg, rad, grad, and turn angles", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 20"><defs>
        <marker id="auto" orient="auto-start-reverse"><path d="M0 0h3"/></marker>
        <marker id="rad" orient="1.5707963267948966rad"><path d="M0 0h3"/></marker>
        <marker id="grad" orient="100grad"><path d="M0 0h3"/></marker>
        <marker id="turn" orient=".25turn"><path d="M0 0h3"/></marker>
      </defs>
      <line id="auto-line" x1="10" y1="10" x2="20" y2="10" marker-start="url(#auto)"/>
      <line id="rad-line" x1="30" y1="10" x2="40" y2="10" marker-end="url(#rad)"/>
      <line id="grad-line" x1="50" y1="10" x2="60" y2="10" marker-end="url(#grad)"/>
      <line id="turn-line" x1="70" y1="10" x2="80" y2="10" marker-end="url(#turn)"/>
      </svg>
    `);
    const angles = shapes(document.children).map((shape) => markerRoots(shape)[0]!.markerPlacement!.angle);
    expect(angles[0]).toBeCloseTo(180);
    expect(angles.slice(1)).toEqual([90, 90, 90]);
  });

  test("maps ref points through viewBox and clips to the marker viewport", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100"><defs>
        <marker id="m" markerWidth="20" markerHeight="10" viewBox="0 0 10 10"
          refX="50%" refY="50%" preserveAspectRatio="xMidYMid meet"
          markerUnits="userSpaceOnUse"><rect width="10" height="10"/></marker>
        <marker id="keywords" viewBox="-5 -10 10 20" refX="right" refY="bottom"/>
      </defs><line id="target" x1="10" y1="50" x2="50" y2="50" marker-end="url(#m)"/></svg>
    `);
    const marker = markerRoots(shapes(document.children).find((shape) => shape.source.id === "target")!)[0]!;
    const matrix = marker.transform;
    const mappedReference = { x: matrix.a * 5 + matrix.c * 5 + matrix.e, y: matrix.b * 5 + matrix.d * 5 + matrix.f };

    expect(mappedReference.x).toBeCloseTo(50);
    expect(mappedReference.y).toBeCloseTo(50);
    expect(marker.viewport).toMatchObject({
      rect: { x: 0, y: 0, width: 20, height: 10 },
      clip: true,
      preserveAspectRatio: { align: "xMidYMid", meetOrSlice: "meet" },
    });
    expect(marker.markerPlacement).toMatchObject({ refX: 10, refY: 5 });
    expect(document.resources.markers.get("keywords")).toMatchObject({
      refX: { type: "keyword", value: "max" },
      refY: { type: "keyword", value: "max" },
    });
  });

  test("resolves marker dimensions against the marker's computed font size", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 30"><defs>
        <marker id="em" markerWidth="2em" markerHeight="1em" font-size="5"
          markerUnits="userSpaceOnUse"><rect width="10" height="5"/></marker>
      </defs><line x1="10" y1="15" x2="90" y2="15" marker-end="url(#em)"/></svg>
    `);
    expect(markerRoots(shapes(document.children)[0]!)[0]!.viewport?.rect).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 5,
    });
  });

  test("resolves context fill and stroke without inheriting unrelated host styles", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 30"><defs>
        <marker id="m" markerWidth="10" markerHeight="10" refX="5" refY="5" markerUnits="userSpaceOnUse">
          <circle id="context" cx="5" cy="5" r="4" fill="context-stroke" stroke="context-fill"/>
          <circle id="explicit" cx="5" cy="5" r="2" fill="green"/>
        </marker>
      </defs><line id="target" x1="10" y1="15" x2="90" y2="15" fill="red" stroke="blue"
        stroke-width="4" opacity=".5" marker-end="url(#m)"/></svg>
    `);
    const content = shapes(markerRoots(shapes(document.children).find((shape) => shape.source.id === "target")!));
    expect(content.find((shape) => shape.source.id === "context")?.style).toMatchObject({
      fill: { type: "solid", value: "blue" },
      stroke: { type: "solid", value: "red" },
      opacity: 1,
    });
    expect(content.find((shape) => shape.source.id === "explicit")?.style.fill).toEqual({
      type: "solid",
      value: "green",
    });
  });

  test("reports missing, wrong-type, malformed, and cyclic marker references", () => {
    const source = `
      <svg viewBox="0 0 100 30"><defs>
        <path id="wrong" d="M0 0h1"/>
        <marker id="cycle"><path d="M0 0h3" marker-end="url(#cycle)"/></marker>
      </defs>
      <line x1="0" y1="5" x2="10" y2="5" marker-end="url(#missing)"/>
      <line x1="0" y1="15" x2="10" y2="15" marker-end="url(#wrong)"/>
      <line x1="0" y1="25" x2="10" y2="25" marker-start="https://example.test/m.svg#x" marker-end="url(#cycle)"/>
      </svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(document.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "missing-marker-resource",
        "wrong-marker-resource-type",
        "invalid-marker-reference",
        "cyclic-marker-reference",
      ]),
    );
    expect(() => convert(source, { strict: true })).toThrow("Marker reference");
  });

  test("includes marker paint in paint-order, opacity, capability analysis, and painted bounds", () => {
    const source = `
      <svg viewBox="0 0 100 100"><defs>
        <marker id="m" markerWidth="10" markerHeight="10" refX="5" refY="5" markerUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#00ff00"/>
        </marker>
      </defs><line id="target" x1="20" y1="50" x2="80" y2="50" opacity=".4"
        paint-order="markers stroke fill" marker-end="url(#m)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    const target = shapes(document.children).find((shape) => shape.source.id === "target")!;
    const output = convert(source);

    expect(__testing.analyzeCapabilities(document, { preserveColors: false })).toMatchObject({
      mode: "view",
      reasons: expect.arrayContaining(["document uses SVG marker shadow content"]),
    });
    expect(__testing.renderNodeBounds(target)).toEqual({ x: 75, y: 45, width: 10, height: 10 });
    expect(output).toContain("Color(red: 0, green: 1, blue: 0)");
    expect(output).toContain(".opacity(0.4)");
  });

  test("does not render zero-sized markers and diagnoses negative marker dimensions", () => {
    const source = `<svg viewBox="0 0 20 20"><defs>
      <marker id="zero" markerWidth="0"><rect width="3" height="3"/></marker>
      <marker id="negative" markerHeight="-1"><rect width="3" height="3"/></marker>
    </defs><line x1="0" y1="10" x2="20" y2="10" marker-start="url(#zero)" marker-end="url(#negative)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(shapes(document.children)[0]!.markers).toBeUndefined();
    expect(document.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "negative-marker-height" })]),
    );
  });
});
