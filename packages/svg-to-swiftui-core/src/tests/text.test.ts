import { __testing, convert } from "../index";
import type { RenderNode, RenderText } from "../renderTree/types";

function textNode(nodes: RenderNode[]): RenderText {
  for (const node of nodes) {
    if (node.type === "text") return node;
    if (node.type === "group") {
      try {
        return textNode(node.children);
      } catch {}
    }
  }
  throw new Error("text node not found");
}

describe("static SVG text", () => {
  test("preserves nested tspan runs, inherited styles, positioning, whitespace, and decoded Unicode", () => {
    const document = __testing.parseRenderDocument(
      `<svg viewBox="0 0 200 80"><text x="10" y="30" font-family="Test Sans, sans-serif" font-size="20" fill="red">  A &amp; <tspan dx="4" dy="-2" font-weight="700" fill="blue">B&#x301;</tspan>  C </text></svg>`,
      { fonts: { availableFamilies: ["Test Sans"], fallbackFamily: "Test Sans" } },
    );
    const text = textNode(document.children);

    expect(text.text).toBe("  A & B́  C ");
    expect(text.chunks).toHaveLength(1);
    expect(text.chunks[0]).toMatchObject({ x: 10, y: 30, anchor: "start" });
    expect(text.chunks[0]!.runs.map((run) => run.text).join("")).toBe("A & B́ C");
    expect(text.chunks[0]!.runs[1]).toMatchObject({
      dx: 4,
      dy: -2,
      font: { family: "Test Sans", size: 20, weight: 700 },
      style: { fill: { type: "solid", value: "blue" } },
      source: { element: "tspan" },
    });
  });

  test("preserves xml:space and creates a new anchored chunk for absolute tspan positioning", () => {
    const text = textNode(
      __testing.parseRenderDocument(
        `<svg viewBox="0 0 200 80"><text x="20" y="30" text-anchor="middle" xml:space="preserve">A   <tspan x="100" y="60"> B </tspan></text></svg>`,
      ).children,
    );

    expect(text.chunks).toHaveLength(2);
    expect(text.chunks[0]).toMatchObject({ x: 20, y: 30, anchor: "middle" });
    expect(text.chunks[0]!.runs[0]!.text).toBe("A   ");
    expect(text.chunks[1]).toMatchObject({ x: 100, y: 60, anchor: "middle" });
    expect(text.chunks[1]!.runs[0]!.text).toBe(" B ");
  });

  test("emits scalable CoreText glyph paths, paint order, gradients, and accessibility", () => {
    const swift = convert(
      `<svg viewBox="0 0 200 80"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x2="200"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><text x="100" y="55" text-anchor="middle" font-family="Poppins" font-size="32" fill="url(#g)" stroke="black" paint-order="stroke fill">Hello</text></svg>`,
      { structName: "TextGraphic", fonts: { availableFamilies: ["Poppins"] } },
    );

    expect(swift).toContain("import CoreText");
    expect(swift).toContain("CTFontCreatePathForGlyph");
    expect(swift).toContain("SVGTextSource.linear");
    expect(swift).toContain("paintOrder: [.stroke, .fill]");
    expect(swift).toContain('.accessibilityLabel("Hello")');
    expect(swift).toContain("size.width / 200");
  });

  test("resolves nested position lists by grapheme cluster and repeats the final rotation", () => {
    const text = textNode(
      __testing.parseRenderDocument(
        `<svg viewBox="0 0 200 80"><text x="10 40" y="25" dx="1 2 3" rotate="5 10"><tspan dx="7">A&#x301;</tspan>B💡</text></svg>`,
      ).children,
    );

    expect(text.chunks).toHaveLength(2);
    expect(text.chunks[0]).toMatchObject({ x: 10, y: 25 });
    expect(text.chunks[0]!.runs[0]!.characters).toEqual([{ text: "Á", dx: 7, dy: 0, rotate: 5 }]);
    expect(text.chunks[1]).toMatchObject({ x: 40 });
    expect(text.chunks[1]!.runs[0]!.characters).toEqual([
      { text: "B", dx: 2, dy: 0, rotate: 10 },
      { text: "💡", dx: 3, dy: 0, rotate: 10 },
    ]);
  });

  test("retains nested textLength constraints, bidi, and vertical writing metadata", () => {
    const text = textNode(
      __testing.parseRenderDocument(
        `<svg viewBox="0 0 200 120"><text x="30" y="10" writing-mode="vertical-rl" direction="rtl" unicode-bidi="embed" textLength="100"><tspan unicode-bidi="embed" textLength="35" lengthAdjust="spacingAndGlyphs">אב</tspan>CD</text></svg>`,
      ).children,
    );

    expect(text.chunks[0]).toMatchObject({
      direction: "rtl",
      writingMode: "vertical-rl",
      lengthAdjustments: [
        { start: 0, end: 4, target: 100, mode: "spacing" },
        { start: 0, end: 2, target: 35, mode: "spacingAndGlyphs" },
      ],
    });
    expect(text.chunks[0]!.runs[0]).toMatchObject({ direction: "rtl", unicodeBidi: "embed" });
  });

  test("measures referenced shapes for textPath and emits path-aware CoreText placement", () => {
    const raw = `<svg viewBox="0 0 240 100"><defs><path id="curve" d="M20 70 Q120 0 220 70" pathLength="100"/></defs><text font-family="Poppins"><textPath href="#curve" startOffset="50%" method="stretch" spacing="auto" side="right">Along</textPath></text></svg>`;
    const document = __testing.parseRenderDocument(raw, { fonts: { availableFamilies: ["Poppins"] } });
    const path = textNode(document.children).chunks[0]!.textPath;

    expect(document.diagnostics).toEqual([]);
    expect(path).toMatchObject({
      closed: false,
      method: "stretch",
      spacing: "auto",
      side: "right",
    });
    expect(path!.points.length).toBeGreaterThan(10);
    expect(path!.startOffset).toBeCloseTo(path!.length / 2);
    expect(path!.distanceScale).toBeCloseTo(path!.length / 100);

    const swift = convert(raw, { fonts: { availableFamilies: ["Poppins"] } });
    expect(swift).toContain("CTRunGetStringIndices");
    expect(swift).toContain("naturallyUpright");
    expect(swift).toContain("SVGTextPathMethod");
    expect(swift).toContain("mappedPath");
  });

  test("diagnoses missing, invalid, and non-geometry textPath references", () => {
    const document = __testing.parseRenderDocument(
      `<svg><defs><g id="group"/></defs><text><textPath>missing</textPath><textPath href="#absent">absent</textPath><textPath href="#group">wrong</textPath></text></svg>`,
    );
    expect(document.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["missing-text-path-reference", "missing-text-path-target", "invalid-text-path-target"]),
    );
  });

  test("applies referenced ancestor transforms and diagnoses textPath cycles", () => {
    const transformed = textNode(
      __testing.parseRenderDocument(
        `<svg viewBox="0 0 100 100"><defs><g transform="translate(10 20) scale(2)"><line id="line" x1="0" y1="0" x2="20" y2="0"/></g></defs><text><textPath href="#line">path</textPath></text></svg>`,
      ).children,
    ).chunks[0]!.textPath!;
    expect(transformed.points[0]).toMatchObject({ x: 10, y: 20 });
    expect(transformed.points[transformed.points.length - 1]).toMatchObject({ x: 50, y: 20 });

    const cyclic = __testing.parseRenderDocument(
      `<svg><defs><textPath id="a" href="#b"/><textPath id="b" href="#a"/></defs><text><textPath href="#a">cycle</textPath></text></svg>`,
    );
    expect(cyclic.diagnostics).toEqual([expect.objectContaining({ code: "cyclic-text-path-reference" })]);
  });

  test("uses configured substitutions and reports deterministic missing-font behavior", () => {
    const raw = `<svg viewBox="0 0 100 40"><text font-family="Missing">Hello</text></svg>`;
    const permissive = __testing.parseRenderDocument(raw, {
      fonts: { availableFamilies: ["Fixture Sans"], fallbackFamily: "Fixture Sans" },
    });
    expect(permissive.diagnostics).toEqual([
      expect.objectContaining({ code: "missing-font-family", severity: "warning" }),
    ]);
    expect(textNode(permissive.children).chunks[0]!.runs[0]!.font.family).toBe("Fixture Sans");

    expect(() =>
      convert(raw, {
        fonts: { availableFamilies: ["Fixture Sans"], fallbackFamily: "Fixture Sans", strict: true },
      }),
    ).toThrow("None of the requested font families");

    const substituted = textNode(
      __testing.parseRenderDocument(raw, {
        fonts: {
          availableFamilies: ["Fixture Sans"],
          substitutions: { Missing: "Fixture Sans" },
          fallbackFamily: "Fixture Sans",
        },
      }).children,
    );
    expect(substituted.chunks[0]!.runs[0]!.font.family).toBe("Fixture Sans");
  });

  test("empty text produces no visible layer while retaining its source node", () => {
    const document = __testing.parseRenderDocument(`<svg viewBox="0 0 20 20"><text id="empty" x="2" y="3"/></svg>`);
    expect(textNode(document.children)).toMatchObject({ text: "", source: { element: "text", id: "empty" } });
    expect(convert(`<svg viewBox="0 0 20 20"><text id="empty" x="2" y="3"/></svg>`)).not.toContain("TextLayer0");
  });
});
