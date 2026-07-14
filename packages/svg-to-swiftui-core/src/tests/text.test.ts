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
