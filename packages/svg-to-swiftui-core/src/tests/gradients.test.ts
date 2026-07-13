import { __testing, convert } from "../index";
import { resolveGradientForShape } from "../renderTree/gradients";
import type { GradientPaint, RenderNode, RenderShape } from "../renderTree/types";

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

function gradient(source: string, id: string): GradientPaint {
  const server = __testing.parseRenderDocument(source).resources.paints.get(id);
  if (server?.type !== "linearGradient" && server?.type !== "radialGradient") throw new Error(`Missing #${id}`);
  return server;
}

describe("typed SVG gradient resources", () => {
  test("retains defaults, coordinate units, transforms, spread, and ordered stops", () => {
    const server = gradient(
      `<svg viewBox="0 0 100 50"><defs><linearGradient id="g" x1="10%" y1="2" x2="90%" gradientTransform="skewX(12)" spreadMethod="reflect">
        <stop offset="-20%" stop-color="red"/><stop offset="70%" stop-color="green"/><stop offset="40%" stop-color="blue"/><stop offset="140%" stop-color="white"/>
      </linearGradient></defs></svg>`,
      "g",
    );
    expect(server).toMatchObject({
      type: "linearGradient",
      units: "objectBoundingBox",
      spreadMethod: "reflect",
      x1: { value: 10, unit: "%" },
      y1: { value: 2, unit: "" },
      x2: { value: 90, unit: "%" },
      y2: { value: 0, unit: "%" },
    });
    expect(server.stops.map((stop) => stop.offset)).toEqual([0, 0.7, 0.7, 1]);
    expect(server.transform.c).not.toBe(0);
  });

  test("computes stop CSS, currentColor, intrinsic alpha, and stop opacity", () => {
    const server = gradient(
      `<svg viewBox="0 0 10 10"><style>.hot { stop-color: currentColor; stop-opacity: 50% }</style><defs>
        <linearGradient id="g" color="#336699"><stop class="hot" offset="0"/><stop offset="1" stop-color="rgba(255,0,0,.4)" stop-opacity=".5"/>
      </linearGradient></defs></svg>`,
      "g",
    );
    expect(server.stops[0]?.color).toEqual({ red: 0.2, green: 0.4, blue: 0.6, alpha: 0.5 });
    expect(server.stops[1]?.color.alpha).toBeCloseTo(0.2);
  });

  test("inherits href attributes and stops, while local stops replace the template", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100"><defs>
        <linearGradient id="base" x1="10%" x2="80%" spreadMethod="repeat"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient>
        <linearGradient id="inherited" href="#base" y2="100%"/>
        <radialGradient id="override" href="#inherited"><stop offset=".25" stop-color="green"/></radialGradient>
      </defs></svg>
    `);
    const inherited = document.resources.paints.get("inherited");
    const override = document.resources.paints.get("override");
    expect(inherited).toMatchObject({ type: "linearGradient", href: "base", spreadMethod: "repeat" });
    if (inherited?.type !== "linearGradient") throw new Error("missing inherited gradient");
    expect(inherited.x1).toMatchObject({ value: 10, unit: "%" });
    expect(inherited.y2).toMatchObject({ value: 100, unit: "%" });
    expect(inherited.stops).toHaveLength(2);
    expect(override).toMatchObject({ type: "radialGradient", href: "inherited", stops: [{ offset: 0.25 }] });
  });

  test("diagnoses missing, wrong-type, cyclic, and malformed gradient resources", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20"><defs>
        <rect id="shape" width="2" height="2"/>
        <linearGradient id="wrong" href="#shape"/>
        <linearGradient id="missing" href="#nope"/>
        <linearGradient id="a" href="#b"/><radialGradient id="b" href="#a"/>
        <linearGradient id="bad" gradientUnits="space" spreadMethod="mirror" gradientTransform="wat(1)"><stop offset="wat" stop-color="no-color"/></linearGradient>
      </defs><rect width="20" height="20" fill="url(#not-there) #f00"/></svg>
    `);
    expect(document.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "wrong-gradient-template-type",
        "missing-gradient-template",
        "cyclic-gradient-reference",
        "invalid-gradient-units",
        "invalid-gradient-spread",
        "invalid-gradient-transform",
        "invalid-stop-offset",
        "invalid-stop-color",
        "missing-paint-server",
      ]),
    );
    expect(
      convert(`<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="url(#missing) red"/></svg>`, {
        preserveColors: true,
      }),
    ).toContain("Color(red: 1, green: 0, blue: 0)");
    const current = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10" color="#123456"><rect width="10" height="10" fill="url(#missing) currentColor"/></svg>`,
    );
    const currentShape = flatten(current.children).find((node): node is RenderShape => node.type === "shape")!;
    expect(currentShape.style.fill).toEqual({ type: "reference", id: "missing", fallback: "#123456" });
  });

  test("resolves object-bounding-box and user-space coordinates against the referencing shape", () => {
    const source = `<svg viewBox="10 20 200 100"><defs>
      <linearGradient id="box"><stop/><stop offset="1" stop-color="white"/></linearGradient>
      <linearGradient id="user" gradientUnits="userSpaceOnUse" x1="25%" y1="50%" x2="75%" y2="50%"><stop/><stop offset="1" stop-color="white"/></linearGradient>
    </defs><rect id="target" x="30" y="40" width="80" height="20" fill="url(#box)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    const shape = flatten(document.children).find((node): node is RenderShape => node.type === "shape")!;
    const box = document.resources.paints.get("box") as GradientPaint;
    const user = document.resources.paints.get("user") as GradientPaint;
    expect(resolveGradientForShape(box, shape)).toMatchObject({
      type: "linearGradient",
      matrix: { a: 80, d: 20, e: 30, f: 40 },
      x1: 0,
      x2: 1,
    });
    expect(resolveGradientForShape(user, shape)).toMatchObject({ x1: 50, y1: 50, x2: 150, y2: 50 });

    const flatDocument = __testing.parseRenderDocument(
      `<svg viewBox="0 0 100 100"><defs><linearGradient id="g"><stop/><stop offset="1" stop-color="white"/></linearGradient></defs><rect id="flat" width="80" height="0" fill="url(#g) red"/></svg>`,
    );
    const flatShape = flatten(flatDocument.children).find(
      (node): node is RenderShape => node.type === "shape" && node.source.id === "flat",
    )!;
    expect(resolveGradientForShape(flatDocument.resources.paints.get("g") as GradientPaint, flatShape)).toEqual({
      type: "none",
    });
  });

  test("forces gradient fills and strokes through the View backend even when tinting was requested", () => {
    const source = `<svg viewBox="0 0 20 20"><defs><linearGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><circle cx="10" cy="10" r="8" fill="url(#g)" stroke="url(#g)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(__testing.analyzeCapabilities(document, { preserveColors: false })).toMatchObject({
      mode: "view",
      reasons: expect.arrayContaining(["document uses an SVG gradient paint server"]),
    });
    const output = convert(source);
    expect(output).toContain("Canvas { context, size in");
    expect(output).toContain("drawLinearGradient");
  });

  test("selects explicit linearRGB sampling and retains radial focal radius", () => {
    const source = `<svg viewBox="0 0 100 100"><defs>
      <linearGradient id="linear" color-interpolation="linearRGB"><stop stop-color="red"/><stop offset="1" stop-color="green"/></linearGradient>
      <radialGradient id="radial" cx="50" cy="50" r="40" fx="35" fy="30" fr="5"><stop/><stop offset="1" stop-color="white"/></radialGradient>
    </defs><rect width="100" height="100" fill="url(#linear)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(document.resources.paints.get("linear")).toMatchObject({ colorInterpolation: "linearRGB" });
    expect(document.resources.paints.get("radial")).toMatchObject({
      type: "radialGradient",
      fx: { value: 35 },
      fy: { value: 30 },
      fr: { value: 5 },
    });
    const output = convert(source);
    expect(output).toContain("linearRGB: true");
    expect(output).toContain("pow((value + 0.055) / 1.055, 2.4)");
  });

  test("keeps SVG 2 focal circles outside the end circle instead of applying SVG 1.1 clamping", () => {
    const source = `<svg viewBox="0 0 100 100"><defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="20" fx="90" fy="50" fr="5"><stop/><stop offset="1" stop-color="white"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    const shape = flatten(document.children).find((node): node is RenderShape => node.type === "shape")!;
    const resolved = resolveGradientForShape(document.resources.paints.get("g") as GradientPaint, shape);
    expect(resolved).toMatchObject({ type: "radialGradient", fx: 90, fy: 50, fr: 5, cx: 50, cy: 50, r: 20 });
  });

  test("handles zero-stop and degenerate gradients deterministically", () => {
    const linear = `<svg viewBox="0 0 10 10"><defs><linearGradient id="g" x1="50%" y1="50%" x2="50%" y2="50%"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`;
    const linearOutput = convert(linear);
    expect(linearOutput).toContain("Color(red: 0, green: 0, blue: 1)");
    expect(linearOutput).not.toContain("drawLinearGradient");

    const radial = `<svg viewBox="0 0 10 10"><defs><radialGradient id="g" cx="50%" cy="50%" r="25%" fx="50%" fy="50%" fr="25%"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></radialGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`;
    expect(convert(radial)).not.toContain("drawRadialGradient");

    const noStops = `<svg viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><rect width="10" height="10" fill="url(#g) red"/></svg>`;
    expect(convert(noStops, { preserveColors: true })).not.toContain("Color(red: 1, green: 0, blue: 0)");
  });
});
