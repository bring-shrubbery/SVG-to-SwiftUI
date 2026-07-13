import { __testing, convert } from "../index";
import { resolvePatternForShape } from "../renderTree/patterns";
import type { PatternPaint, RenderNode, RenderShape } from "../renderTree/types";

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

function pattern(source: string, id: string): PatternPaint {
  const server = __testing.parseRenderDocument(source).resources.paints.get(id);
  if (server?.type !== "pattern") throw new Error(`Missing #${id}`);
  return server;
}

describe("typed SVG pattern resources", () => {
  test("retains coordinate units, transforms, viewBox behavior, overflow, and ordered children", () => {
    const server = pattern(
      `<svg viewBox="0 0 100 50"><defs><pattern id="p" x="10%" y="2" width="25%" height="12" patternUnits="userSpaceOnUse" patternContentUnits="objectBoundingBox" patternTransform="skewX(12)" viewBox="0 0 4 2" preserveAspectRatio="xMaxYMax slice" overflow="visible"><rect width="4" height="2"/><circle cx="2" cy="1" r="1"/></pattern></defs><rect width="100" height="50" fill="url(#p)"/></svg>`,
      "p",
    );
    expect(server).toMatchObject({
      type: "pattern",
      units: "userSpaceOnUse",
      contentUnits: "objectBoundingBox",
      x: { value: 10, unit: "%" },
      y: { value: 2, unit: "" },
      width: { value: 25, unit: "%" },
      height: { value: 12, unit: "" },
      viewBox: { x: 0, y: 0, width: 4, height: 2 },
      preserveAspectRatio: { align: "xMaxYMax", meetOrSlice: "slice" },
      overflow: "visible",
    });
    expect(server.transform.c).not.toBe(0);
    expect(server.children.map((node) => node.source.element)).toEqual(["rect", "circle"]);
  });

  test("inherits each href attribute and shadow content, while local children replace inherited children", () => {
    const document = __testing.parseRenderDocument(`<svg viewBox="0 0 100 100"><defs>
      <pattern id="base" x="5" y="6" width="20" height="25" patternUnits="userSpaceOnUse"><rect id="base-child" width="10" height="10"/></pattern>
      <pattern id="inherited" href="#base" x="8"/>
      <pattern id="override" xlink:href="#inherited"><circle id="local-child" cx="4" cy="4" r="3"/></pattern>
    </defs><rect width="40" height="40" fill="url(#inherited)"/><rect x="50" width="40" height="40" fill="url(#override)"/></svg>`);
    const inherited = document.resources.paints.get("inherited");
    const override = document.resources.paints.get("override");
    expect(inherited).toMatchObject({
      type: "pattern",
      href: "base",
      x: { value: 8 },
      y: { value: 6 },
    });
    expect(inherited?.type === "pattern" ? inherited.contentElements.map((item) => item.properties?.id) : []).toEqual([
      "base-child",
    ]);
    expect(override?.type === "pattern" ? override.contentElements.map((item) => item.properties?.id) : []).toEqual([
      "local-child",
    ]);
  });

  test("materializes user-space percentage content per referencing viewport", () => {
    const document = __testing.parseRenderDocument(`<svg viewBox="0 0 200 100"><defs>
      <pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><rect id="content" width="50%" height="50%"/></pattern>
    </defs><rect id="outer" width="100" height="100" fill="url(#p)"/><svg x="100" width="100" height="100" viewBox="0 0 50 50"><rect id="inner" width="50" height="50" fill="url(#p)"/></svg></svg>`);
    const server = document.resources.paints.get("p");
    if (server?.type !== "pattern") throw new Error("missing pattern");
    const shapes = flatten(document.children).filter((node): node is RenderShape => node.type === "shape");
    const outer = shapes.find((shape) => shape.source.id === "outer")!;
    const inner = shapes.find((shape) => shape.source.id === "inner")!;
    const outerChild = flatten(server.instances.get(outer)!.children).find(
      (node): node is RenderShape => node.type === "shape",
    )!;
    const innerChild = flatten(server.instances.get(inner)!.children).find(
      (node): node is RenderShape => node.type === "shape",
    )!;
    expect(outerChild.geometry).toMatchObject({
      type: "rect",
      width: 100,
      height: 50,
    });
    expect(innerChild.geometry).toMatchObject({
      type: "rect",
      width: 25,
      height: 25,
    });
  });

  test("resolves object bounding box and user-space tiles against the referencing shape", () => {
    const source = `<svg viewBox="0 0 200 100"><defs>
      <pattern id="box" x="10%" y="20%" width="25%" height="50%"><rect width="1" height="1"/></pattern>
      <pattern id="user" x="10%" y="20%" width="25%" height="50%" patternUnits="userSpaceOnUse"><rect width="10" height="10"/></pattern>
      <pattern id="mixed" width="20" height="10" patternUnits="userSpaceOnUse" patternContentUnits="objectBoundingBox"><rect width="1" height="1"/></pattern>
    </defs><rect id="target" x="30" y="40" width="80" height="20" fill="url(#box)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    const shape = flatten(document.children).find((node): node is RenderShape => node.type === "shape")!;
    const box = document.resources.paints.get("box") as PatternPaint;
    const user = document.resources.paints.get("user") as PatternPaint;
    const mixed = document.resources.paints.get("mixed") as PatternPaint;
    expect(resolvePatternForShape(box, shape, "fill")).toMatchObject({
      type: "pattern",
      matrix: { a: 80, d: 20, e: 30, f: 40 },
      tile: { x: 0.1, y: 0.2, width: 0.25, height: 0.5 },
      contentTransform: { a: 0.0125, d: 0.05, e: 0, f: 0 },
    });
    expect(resolvePatternForShape(user, shape, "fill")).toMatchObject({
      type: "pattern",
      matrix: { a: 1, d: 1, e: 0, f: 0 },
      tile: { x: 20, y: 20, width: 50, height: 50 },
    });
    expect(resolvePatternForShape(mixed, shape, "fill")).toMatchObject({
      type: "pattern",
      matrix: { a: 1, d: 1, e: 0, f: 0 },
      contentTransform: { a: 80, d: 20, e: 0, f: 0 },
    });
  });

  test("diagnoses invalid templates, units, dimensions, transforms, and nested paint/use cycles", () => {
    const document = __testing.parseRenderDocument(`<svg viewBox="0 0 20 20"><defs>
      <rect id="shape" width="2" height="2"/>
      <pattern id="wrong" href="#shape"/><pattern id="missing" href="#nope"/>
      <pattern id="a" href="#b"/><pattern id="b" href="#a"/>
      <pattern id="bad" patternUnits="space" patternContentUnits="box" patternTransform="wat(1)" width="-1" height="-2"><rect/></pattern>
      <pattern id="paint-a" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="url(#paint-b)"/></pattern>
      <pattern id="paint-b" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="url(#paint-a)"/></pattern>
      <g id="use-a"><use href="#use-b"/></g><g id="use-b"><use href="#use-a"/></g>
      <pattern id="use-cycle" width="4" height="4" patternUnits="userSpaceOnUse"><use href="#use-a"/></pattern>
    </defs><rect width="10" height="10" fill="url(#paint-a) red"/><rect x="10" width="10" height="10" fill="url(#use-cycle) blue"/></svg>`);
    expect(document.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "wrong-pattern-template-type",
        "missing-pattern-template",
        "cyclic-pattern-reference",
        "invalid-patternUnits",
        "invalid-patternContentUnits",
        "invalid-pattern-transform",
        "negative-pattern-width",
        "negative-pattern-height",
        "cyclic-pattern-content-reference",
        "cyclic-pattern-use-reference",
        "invalid-pattern-paint-server",
      ]),
    );
    const output = convert(
      `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="url(#missing) currentColor" color="#123456"/></svg>`,
      { preserveColors: true },
    );
    expect(output).toContain("Color(red: 0.0706, green: 0.2039, blue: 0.3373)");
  });

  test("uses the View backend and emits direct vector Canvas tiling for pattern fills and strokes", () => {
    const source = `<svg viewBox="0 0 20 20"><defs><pattern id="p" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="3" height="5" fill="red"/><rect x="3" width="2" height="5" fill="blue"/></pattern></defs><circle cx="10" cy="10" r="8" fill="url(#p)" stroke="url(#p)" stroke-width="2"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(__testing.analyzeCapabilities(document, { preserveColors: false })).toMatchObject({
      mode: "view",
      reasons: expect.arrayContaining(["document uses an SVG pattern paint server"]),
    });
    const output = convert(source);
    expect(output).toContain("context.withCGContext");
    expect(output).toContain("for row in");
    expect(output).toContain("CGAffineTransform(translationX:");
    expect(output.match(/context\.withCGContext/g)).toHaveLength(2);
  });

  test("paints nothing for zero dimensions, negative dimensions, singular transforms, and zero object bounds", () => {
    for (const attributes of [
      `width="0" height="5" patternUnits="userSpaceOnUse"`,
      `width="-2" height="5" patternUnits="userSpaceOnUse"`,
      `width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="scale(0)"`,
    ]) {
      const source = `<svg viewBox="0 0 10 10"><defs><pattern id="p" ${attributes}><rect width="5" height="5"/></pattern></defs><rect width="10" height="10" fill="url(#p) red"/></svg>`;
      expect(convert(source, { preserveColors: true })).not.toContain("for row in");
    }

    const document = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><defs><pattern id="p" width="50%" height="50%"><rect width="1" height="1"/></pattern></defs><rect id="flat" width="10" height="0" fill="url(#p)"/></svg>`,
    );
    const shape = flatten(document.children).find(
      (node): node is RenderShape => node.type === "shape" && node.source.id === "flat",
    )!;
    expect(resolvePatternForShape(document.resources.paints.get("p") as PatternPaint, shape, "fill")).toEqual({
      type: "none",
    });
  });
});
