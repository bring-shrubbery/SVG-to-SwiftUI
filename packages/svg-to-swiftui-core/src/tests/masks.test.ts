import { __testing, convert } from "../index";
import type { RenderNode } from "../renderTree/types";

function firstMasked(nodes: RenderNode[]): RenderNode | undefined {
  for (const node of nodes) {
    if (node.mask) return node;
    if (node.type === "group") {
      const result = firstMasked(node.children);
      if (result) return result;
    }
  }
  return undefined;
}

describe("SVG masks and compositing", () => {
  test("retains typed mask defaults, CSS mask type, content, and expanded object-bounding-box region", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 50"><style>#m { mask-type: alpha }</style><defs>
        <mask id="m"><rect width="50%" height="100%" fill="white"/></mask>
      </defs><rect x="10" y="5" width="80" height="40" fill="red" mask="url(#m)"/></svg>
    `);
    const resource = document.resources.masks.get("m");
    expect(resource).toMatchObject({
      id: "m",
      units: "objectBoundingBox",
      contentUnits: "userSpaceOnUse",
      maskType: "alpha",
      x: { value: -10, unit: "%" },
      y: { value: -10, unit: "%" },
      width: { value: 120, unit: "%" },
      height: { value: 120, unit: "%" },
    });
    expect(resource?.children).toHaveLength(1);
    expect(firstMasked(document.children)?.mask).toMatchObject({
      maskType: "alpha",
      region: { x: 2, y: 1, width: 96, height: 48 },
      invalid: false,
    });
  });

  test("resolves all mask unit combinations against the target context", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 200 100"><defs>
        <mask id="box" x="10%" y="20%" width="50%" height="60%" maskContentUnits="objectBoundingBox">
          <rect x=".25" width=".5" height="1" fill="white"/>
        </mask>
        <mask id="user" x="10%" y="20%" width="50%" height="60%" maskUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="white"/>
        </mask>
      </defs>
      <rect x="20" y="10" width="100" height="50" mask="url(#box)"/>
      <rect x="20" y="10" width="100" height="50" mask="url(#user)"/>
      </svg>
    `);
    const targets =
      document.children[0]?.type === "group" ? document.children[0].children.filter((node) => node.mask) : [];
    expect(targets[0]?.mask).toMatchObject({
      region: { x: 30, y: 20, width: 50, height: 30 },
      contentTransform: { a: 100, d: 50, e: 20, f: 10 },
    });
    expect(targets[1]?.mask).toMatchObject({
      region: { x: 20, y: 20, width: 100, height: 60 },
      contentTransform: { a: 1, d: 1, e: 0, f: 0 },
    });
  });

  test("uses transformed geometry, not stroke expansion, for a group object bounding box", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100"><defs>
        <mask id="m" maskContentUnits="objectBoundingBox" mask-type="alpha"><rect width="1" height="1" fill="white"/></mask>
      </defs><g mask="url(#m)"><rect x="10" y="20" width="20" height="30" stroke="red" stroke-width="10"/></g></svg>
    `);
    expect(firstMasked(document.children)?.mask).toMatchObject({
      region: { x: 8, y: 17, width: 24, height: 36 },
      contentTransform: { a: 20, d: 30, e: 10, f: 20 },
    });
  });

  test("diagnoses invalid, missing, wrong-type, empty, and cyclic masks", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20"><defs>
        <path id="wrong" d="M0 0h1v1z"/>
        <mask id="bad" maskUnits="wat" maskContentUnits="nope" width="-1" mask-type="gray"/>
        <mask id="a"><rect width="20" height="20" mask="url(#b)"/></mask>
        <mask id="b"><rect width="20" height="20" mask="url(#a)"/></mask>
      </defs>
      <rect width="4" height="4" mask="url(#missing)"/>
      <rect x="5" width="4" height="4" mask="url(#wrong)"/>
      <rect x="10" width="4" height="4" mask="url(#bad)"/>
      <rect x="15" width="4" height="4" mask="url(#a)"/>
      </svg>
    `);
    expect(document.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "invalid-maskUnits",
        "invalid-maskContentUnits",
        "negative-mask-width",
        "invalid-mask-type",
        "missing-mask-resource",
        "wrong-mask-resource-type",
        "cyclic-mask-reference",
      ]),
    );
    expect(
      convert(
        `<svg viewBox="0 0 10 10"><defs><mask id="empty"/></defs><rect width="10" height="10" mask="url(#empty)"/></svg>`,
      ),
    ).toContain("Color.clear");
  });

  test("emits every Level 1 blend mode and preserves mask, opacity, then blend order", () => {
    const modes = [
      "normal",
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
      "color-dodge",
      "color-burn",
      "hard-light",
      "soft-light",
      "difference",
      "exclusion",
      "hue",
      "saturation",
      "color",
      "luminosity",
    ];
    const output = convert(
      `<svg viewBox="0 0 160 10"><defs><mask id="m" mask-type="alpha"><rect width="160" height="10" fill="white"/></mask></defs>${modes
        .map((mode, index) => `<rect x="${index * 10}" width="10" height="10" fill="red" mix-blend-mode="${mode}"/>`)
        .join("")}<g mask="url(#m)" opacity=".5" mix-blend-mode="multiply"><rect width="10" height="10"/></g></svg>`,
    );
    for (const mode of modes.filter((item) => item !== "normal")) {
      const swift = mode.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
      expect(output).toContain(`.blendMode(.${swift})`);
    }
    const mask = output.lastIndexOf(".mask {");
    const opacity = output.indexOf(".opacity(0.5)", mask);
    const blend = output.indexOf(".blendMode(.multiply)", opacity);
    expect(mask).toBeGreaterThan(0);
    expect(opacity).toBeGreaterThan(mask);
    expect(blend).toBeGreaterThan(opacity);
    expect(
      convert(
        `<svg viewBox="0 0 10 10"><defs><mask id="m"><rect width="10" height="10" fill="white"/></mask></defs><rect width="10" height="10" mask="url(#m)"/></svg>`,
      ),
    ).toContain("matrix.a1 = 0.2125");
  });

  test("applies viewport clipping before mask, post-group opacity, and blending", () => {
    const output = convert(`
      <svg viewBox="0 0 20 20"><defs><mask id="m" mask-type="alpha"><rect width="20" height="20" fill="white"/></mask></defs>
        <svg x="2" y="2" width="16" height="16" overflow="hidden" mask="url(#m)" opacity=".6" style="mix-blend-mode:screen">
          <rect width="20" height="20" fill="red"/>
        </svg>
      </svg>
    `);
    const clip = output.indexOf(".clipShape(Clip");
    const mask = output.indexOf(".mask {", clip);
    const opacity = output.indexOf(".opacity(0.6)", mask);
    const blend = output.indexOf(".blendMode(.screen)", opacity);
    expect(clip).toBeGreaterThan(0);
    expect(mask).toBeGreaterThan(clip);
    expect(opacity).toBeGreaterThan(mask);
    expect(blend).toBeGreaterThan(opacity);
  });
});
