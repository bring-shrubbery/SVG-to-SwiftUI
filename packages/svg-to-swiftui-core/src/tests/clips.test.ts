import { __testing, convert } from "../index";
import type { RenderNode } from "../renderTree/types";

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

function nodeById(nodes: RenderNode[], id: string): RenderNode | undefined {
  return flatten(nodes).find((node) => node.source.id === id);
}

describe("SVG clip paths", () => {
  test("retains typed defaults and materializes all graphics children as one target instance", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 50"><defs>
        <clipPath id="clip"><rect width="30" height="50"/><circle cx="50" cy="25" r="20"/></clipPath>
      </defs><rect id="target" width="100" height="50" fill="red" clip-path="url(#clip)"/></svg>
    `);
    const resource = document.resources.clips.get("clip");
    const target = nodeById(document.children, "target");

    expect(resource).toMatchObject({ id: "clip", units: "userSpaceOnUse" });
    expect(resource?.contentElements).toHaveLength(2);
    expect(resource?.children[0]).toMatchObject({ type: "group" });
    expect(target?.clipPath).toMatchObject({
      resource: { id: "clip" },
      contentTransform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      invalid: false,
    });
    expect(target?.clipPath?.children[0]?.type === "group" ? target.clipPath.children[0].children : []).toHaveLength(2);
  });

  test("resolves objectBoundingBox from unclipped geometry without stroke or target transforms", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 200 100"><defs>
        <clipPath id="box" clipPathUnits="objectBoundingBox" transform="translate(.1 .2)">
          <rect x=".1" y=".2" width=".5" height=".5" transform="scale(.8)"/>
        </clipPath>
      </defs>
      <rect id="target" x="20" y="10" width="100" height="40" stroke="black" stroke-width="30"
        transform="translate(30 5)" clip-path="url(#box)"/>
    </svg>`);
    const target = nodeById(document.children, "target");
    expect(target?.clipPath).toMatchObject({
      contentTransform: { a: 100, b: 0, c: 0, d: 40, e: 20, f: 10 },
      invalid: false,
    });
    expect(target?.clipPath?.children[0]?.transform).toMatchObject({ e: 0.1, f: 0.2 });
    const bounds = target && __testing.renderNodeBounds(target);
    expect(bounds?.x).toBeCloseTo(58.1);
    expect(bounds?.y).toBeCloseTo(21.6);
    expect(bounds?.width).toBeCloseTo(40);
    expect(bounds?.height).toBeCloseTo(16);
  });

  test("uses clip-rule independently from fill-rule and ignores clip paint properties", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20"><defs><clipPath id="hole">
        <path id="clip-shape" d="M1 1h18v18H1zM6 6h8v8H6z" fill-rule="nonzero" clip-rule="evenodd"
          fill="none" stroke="red" stroke-width="50" opacity="0"/>
      </clipPath></defs><rect width="20" height="20" fill="blue" clip-path="url(#hole)"/></svg>
    `);
    const shape = nodeById(document.resources.clips.get("hole")?.children ?? [], "clip-shape");
    expect(shape?.style).toMatchObject({ fillRule: "nonzero", clipRule: "evenodd", opacity: 0 });

    const output = convert(`
      <svg viewBox="0 0 20 20"><defs><clipPath id="hole">
        <path d="M1 1h18v18H1zM6 6h8v8H6z" fill="none" stroke="red" opacity="0" clip-rule="evenodd"/>
      </clipPath></defs><rect width="20" height="20" fill="blue" clip-path="url(#hole)"/></svg>
    `);
    expect(output).toContain("ClipCoverage");
    expect(output).toContain(".clipShape(ClipCoverage");
    expect(output).not.toContain("opacity(0)");
  });

  test("intersects nested clips on clipPath roots and individual children", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 40 20"><defs>
        <clipPath id="left"><rect width="20" height="20"/></clipPath>
        <clipPath id="both" clip-path="url(#left)">
          <rect width="40" height="20"/>
          <circle id="nested-child" cx="30" cy="10" r="10" clip-path="url(#left)"/>
        </clipPath>
      </defs><g id="target" clip-path="url(#both)"><rect width="40" height="20" fill="green"/></g></svg>
    `);
    const target = nodeById(document.children, "target");
    const root = target?.clipPath?.children[0];
    const child = nodeById(root ? [root] : [], "nested-child");
    expect(root?.clipPath?.resource?.id).toBe("left");
    expect(child?.clipPath?.resource?.id).toBe("left");
    const output = convert(`
      <svg viewBox="0 0 40 20"><defs>
        <clipPath id="left"><rect width="20" height="20"/></clipPath>
        <clipPath id="both" clip-path="url(#left)"><rect width="40" height="20"/></clipPath>
      </defs><rect width="40" height="20" clip-path="url(#both)"/></svg>
    `);
    expect(output).toContain(".mask {");
    expect(output).toContain("graphics.clip()");
  });

  test("diagnoses malformed resources and follows invalid-reference versus empty/cyclic behavior", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 60 10"><defs>
        <path id="wrong" d="M0 0h1v1z"/>
        <clipPath id="bad-units" clipPathUnits="viewport"><rect width="1" height="1" clip-rule="wat"/></clipPath>
        <clipPath id="a" clip-path="url(#b)"><rect width="10" height="10"/></clipPath>
        <clipPath id="b" clip-path="url(#a)"><rect width="10" height="10"/></clipPath>
      </defs>
      <rect id="missing" width="10" height="10" clip-path="url(#nope)"/>
      <rect id="wrong-target" x="10" width="10" height="10" clip-path="url(#wrong)"/>
      <rect id="basic" x="20" width="10" height="10" clip-path="circle(50%)"/>
      <rect id="external" x="30" width="10" height="10" clip-path="url(other.svg#clip)"/>
      <rect id="cycle" x="40" width="10" height="10" clip-path="url(#a)"/>
      <rect id="bad-unit-target" x="50" width="10" height="10" clip-path="url(#bad-units)"/>
    </svg>`);
    expect(document.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "invalid-clipPathUnits",
        "invalid-clip-rule",
        "missing-clip-path-resource",
        "wrong-clip-path-resource-type",
        "unsupported-clip-path-basic-shape",
        "external-clip-path-reference",
        "cyclic-clip-path-reference",
      ]),
    );
    expect(nodeById(document.children, "missing")?.clipPath).toBeUndefined();
    expect(nodeById(document.children, "wrong-target")?.clipPath).toBeUndefined();
    expect(nodeById(document.children, "cycle")?.clipPath?.invalid).toBe(false);
    expect(() =>
      convert(`<svg><rect width="1" height="1" clip-path="url(#missing)"/></svg>`, { strict: true }),
    ).toThrow("does not resolve");
  });

  test("empty and degenerate objectBoundingBox clips remove all output", () => {
    const empty = convert(
      `<svg viewBox="0 0 10 10"><defs><clipPath id="empty"/></defs><rect width="10" height="10" clip-path="url(#empty)"/></svg>`,
    );
    expect(empty).toContain("Color.clear");

    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 10 10"><defs><clipPath id="box" clipPathUnits="objectBoundingBox"><rect width="1" height="1"/></clipPath></defs>
        <line id="zero" x1="5" y1="1" x2="5" y2="9" stroke="black" clip-path="url(#box)"/>
      </svg>`);
    expect(nodeById(document.children, "zero")?.clipPath?.invalid).toBe(true);
    expect(document.diagnostics.map((item) => item.code)).toContain("degenerate-clip-path-object-bounding-box");
  });

  test("clips the rendered group before mask, opacity, and blend", () => {
    const output = convert(`
      <svg viewBox="0 0 20 20"><defs>
        <clipPath id="clip"><circle cx="10" cy="10" r="8"/></clipPath>
        <mask id="mask" mask-type="alpha"><rect width="20" height="20" fill="white"/></mask>
      </defs><g clip-path="url(#clip)" mask="url(#mask)" opacity=".5" mix-blend-mode="screen">
        <rect width="20" height="20" fill="red"/><circle cx="10" cy="10" r="6" fill="blue"/>
      </g></svg>
    `);
    const clipEffect = output.indexOf(".clipShape(ClipCoverage");
    const svgMask = output.indexOf(".mask {", clipEffect);
    const opacity = output.indexOf(".opacity(0.5)", svgMask);
    const blend = output.indexOf(".blendMode(.screen)", opacity);
    expect(clipEffect).toBeGreaterThan(0);
    expect(svgMask).toBeGreaterThan(clipEffect);
    expect(opacity).toBeGreaterThan(svgMask);
    expect(blend).toBeGreaterThan(opacity);
  });

  test("intersects painted bounds without changing the target object bounding box", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 100 100"><defs><clipPath id="clip"><rect x="25" y="20" width="10" height="15"/></clipPath></defs>
        <rect id="target" x="10" y="10" width="60" height="50" fill="red" stroke="black" stroke-width="10" clip-path="url(#clip)"/>
      </svg>`);
    const target = nodeById(document.children, "target");
    expect(target && __testing.renderNodeBounds(target)).toEqual({ x: 25, y: 20, width: 10, height: 15 });
  });
});
