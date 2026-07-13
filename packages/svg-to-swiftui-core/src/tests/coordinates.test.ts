import { __testing, convert } from "../index";
import type { RenderGroup, RenderShape } from "../renderTree/types";

function rootGroup(source: string, config = {}): RenderGroup {
  return __testing.parseRenderDocument(source, config).children[0] as RenderGroup;
}

function firstShape(group: RenderGroup): RenderShape {
  const child = group.children[0];
  if (child?.type === "shape") return child;
  if (child?.type === "group") return firstShape(child);
  throw new Error("Expected a shape.");
}

describe("coordinate resolution", () => {
  test("emits valid Swift literals for normalized values ending in zero", () => {
    const result = convert(`<svg viewBox="100 200 80 40"><polygon points="200,400 280,400 280,440" /></svg>`);
    expect(result).not.toMatch(/\d+\.\*(?:width|height)/);
    expect(result).toContain("1.25*width");
    expect(result).toContain("5*height");
  });

  test("resolves geometry, physical units, font units, and normalized-diagonal percentages", () => {
    const document = __testing.parseRenderDocument(`
      <svg width="200" height="100" viewBox="0 0 200 100" font-size="20">
        <rect x="10%" y="20%" width="1in" height="2.54cm" rx="1em" fill="red" stroke="blue" stroke-width="10%" />
      </svg>
    `);
    const shape = firstShape(document.children[0] as RenderGroup);
    expect(shape.geometry).toMatchObject({ type: "rect", x: 20, y: 20, width: 96, height: 96, rx: 20, ry: 20 });
    expect(shape.style.strokeStyle.width).toBeCloseTo(Math.hypot(200, 100) / Math.SQRT2 / 10);
  });

  test("uses horizontal, vertical, and other percentage bases", () => {
    const group = rootGroup(`
      <svg width="200" height="100" viewBox="0 0 200 100">
        <circle cx="25%" cy="25%" r="25%" />
      </svg>
    `);
    expect(firstShape(group).geometry).toEqual({
      type: "circle",
      cx: 50,
      cy: 25,
      r: Math.hypot(200, 100) / Math.SQRT2 / 4,
    });
  });

  test("creates nested percentage viewports and resolves child percentages in the nearest viewport", () => {
    const root = rootGroup(`
      <svg width="200" height="100" viewBox="0 0 200 100">
        <svg x="10%" y="20%" width="50%" height="50%" viewBox="10 20 20 10" preserveAspectRatio="none">
          <rect width="50%" height="50%" />
        </svg>
      </svg>
    `);
    const nested = root.children[0] as RenderGroup;
    expect(nested.viewport?.rect).toEqual({ x: 20, y: 20, width: 100, height: 50 });
    expect(nested.transform).toEqual({ a: 5, b: 0, c: 0, d: 5, e: -30, f: -80 });
    expect(firstShape(nested).geometry).toMatchObject({ type: "rect", width: 10, height: 5 });
  });

  test("instantiates symbols with use dimensions, aspect ratio, and reference context", () => {
    const root = rootGroup(`
      <svg width="200" height="100" viewBox="0 0 200 100">
        <defs><symbol id="mark" viewBox="0 0 10 20" preserveAspectRatio="xMaxYMax meet"><rect width="100%" height="100%" /></symbol></defs>
        <use href="#mark" x="10%" y="10%" width="50%" height="80%" fill="red" />
      </svg>
    `);
    const instance = root.children[0] as RenderGroup;
    expect(instance.referenceId).toBe("mark");
    expect(instance.viewport?.rect).toEqual({ x: 20, y: 10, width: 100, height: 80 });
    expect(instance.transform).toEqual({ a: 4, b: 0, c: 0, d: 4, e: 80, f: 10 });
    expect(firstShape(instance).style.fill).toEqual({ type: "solid", value: "red" });
  });

  test("supports static view fragments", () => {
    const document = __testing.parseRenderDocument(
      `<svg width="200" height="100" viewBox="0 0 200 100"><view id="detail" viewBox="50 0 50 100" preserveAspectRatio="none"/><rect width="200" height="100"/></svg>`,
      { fragment: "#detail" },
    );
    expect(document.viewport.viewBox).toEqual({ x: 50, y: 0, width: 50, height: 100 });
    expect((document.children[0] as RenderGroup).transform).toEqual({ a: 4, b: 0, c: 0, d: 1, e: -200, f: 0 });
  });

  test("documents root percentage fallback and accepts an explicit outer viewport", () => {
    const source = `<svg width="50%" height="25%" viewBox="0 0 100 80"><rect width="100%" height="100%"/></svg>`;
    const fallback = __testing.parseRenderDocument(source);
    expect(fallback.viewport.width).toBe(50);
    expect(fallback.viewport.height).toBe(20);
    expect(fallback.diagnostics.map(({ code }) => code)).toContain("root-relative-viewport-fallback");
    expect(() => convert(source, { strict: true })).toThrow("without outerViewport");

    const configured = __testing.parseRenderDocument(source, { outerViewport: { width: 400, height: 200 } });
    expect(configured.viewport.width).toBe(200);
    expect(configured.viewport.height).toBe(50);
    expect(configured.diagnostics).toEqual([]);
  });

  test("infers missing root dimensions from viewBox and converts absolute units at 96px/in", () => {
    const inferred = __testing.parseRenderDocument(`<svg viewBox="-10 -20 40 50"><rect width="40" height="50"/></svg>`);
    expect(inferred.viewport).toMatchObject({
      width: 40,
      height: 50,
      viewBox: { x: -10, y: -20, width: 40, height: 50 },
    });
    const physical = __testing.parseRenderDocument(
      `<svg width="1in" height="25.4mm"><rect width="100%" height="100%"/></svg>`,
    );
    expect(physical.viewport.width).toBeCloseTo(96);
    expect(physical.viewport.height).toBeCloseTo(96);
  });

  test("renders zero viewports as empty and diagnoses invalid negatives per consumer", () => {
    expect(rootGroup(`<svg width="0" height="10"><rect width="10" height="10"/></svg>`).children).toEqual([]);
    const invalid = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><rect width="-1" height="2"/><line x1="-2" y1="0" x2="2" y2="2" stroke="black"/></svg>`,
    );
    const root = invalid.children[0] as RenderGroup;
    expect(root.children).toHaveLength(1);
    expect(firstShape(root).geometry).toMatchObject({ type: "line", x1: -2 });
    expect(invalid.diagnostics.map(({ code }) => code)).toContain("negative-width");
  });

  test("retains transforms above and below nested viewport mappings", () => {
    const root = rootGroup(`
      <svg width="100" height="100" viewBox="0 0 100 100">
        <g transform="translate(5 6)"><svg x="10" y="20" width="40" height="40" viewBox="0 0 20 20" transform="scale(2)">
          <rect width="10" height="10" transform="translate(3 4)" />
        </svg></g>
      </svg>
    `);
    const parent = root.children[0] as RenderGroup;
    const nested = parent.children[0] as RenderGroup;
    expect(parent.transform.e).toBe(5);
    expect(parent.transform.f).toBe(6);
    expect(nested.transform).toEqual({ a: 4, b: 0, c: 0, d: 4, e: 20, f: 40 });
    expect(firstShape(nested).transform).toMatchObject({ e: 3, f: 4 });
  });

  test("selects View for clipped nested viewports and Shape for explicit overflow visible", () => {
    const hidden = `<svg viewBox="0 0 100 50"><svg x="10" width="20" height="20" viewBox="0 0 10 10"><rect width="20" height="10" fill="red"/></svg></svg>`;
    const visible = hidden.replace('viewBox="0 0 10 10"', 'overflow="visible" viewBox="0 0 10 10"');
    expect(convert(hidden, { structName: "Hidden" })).toContain("struct Hidden: View");
    expect(convert(hidden, { structName: "Hidden" })).toContain(".clipShape(");
    expect(convert(visible, { structName: "Visible" })).toContain("struct Visible: Shape");
  });
});
