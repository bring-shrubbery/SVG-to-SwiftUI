import { parsePreserveAspectRatio, parseViewBox, viewBoxTransform } from "../viewports";

const alignments = [
  "xMinYMin",
  "xMidYMin",
  "xMaxYMin",
  "xMinYMid",
  "xMidYMid",
  "xMaxYMid",
  "xMinYMax",
  "xMidYMax",
  "xMaxYMax",
] as const;

describe("SVG viewports", () => {
  test.each(alignments)("implements meet alignment %s", (align) => {
    const horizontal = viewBoxTransform(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 100 },
      { defer: false, align, meetOrSlice: "meet" },
    );
    const vertical = viewBoxTransform(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 100, height: 200 },
      { defer: false, align, meetOrSlice: "meet" },
    );
    expect(horizontal.a).toBe(1);
    expect(horizontal.d).toBe(1);
    expect(horizontal.e).toBe(align.includes("xMin") ? 0 : align.includes("xMax") ? 100 : 50);
    expect(vertical.f).toBe(align.includes("YMin") ? 0 : align.includes("YMax") ? 100 : 50);
  });

  test.each(alignments)("implements slice alignment %s", (align) => {
    const transform = viewBoxTransform(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 100 },
      { defer: false, align, meetOrSlice: "slice" },
    );
    expect(transform.a).toBe(2);
    expect(transform.d).toBe(2);
    expect(transform.e).toBe(0);
    expect(transform.f).toBe(align.includes("YMin") ? 0 : align.includes("YMax") ? -100 : -50);
  });

  test("implements none with non-uniform scaling and a non-zero viewBox origin", () => {
    expect(
      viewBoxTransform(
        { x: -10, y: 20, width: 100, height: 50 },
        { x: 5, y: 7, width: 200, height: 150 },
        { defer: false, align: "none", meetOrSlice: "meet" },
      ),
    ).toEqual({ a: 2, b: 0, c: 0, d: 3, e: 25, f: -53 });
  });

  test("parses default, defer, comma-wsp viewBox, and rejects invalid values", () => {
    expect(parsePreserveAspectRatio(undefined)).toEqual({ defer: false, align: "xMidYMid", meetOrSlice: "meet" });
    expect(parsePreserveAspectRatio("defer xMaxYMin slice")).toEqual({
      defer: true,
      align: "xMaxYMin",
      meetOrSlice: "slice",
    });
    expect(parseViewBox("-10, 20, 30,40")).toEqual({ x: -10, y: 20, width: 30, height: 40 });
    expect(() => parseViewBox("0 0 -1 10")).toThrow("cannot be negative");
    expect(() => parseViewBox("0 0 10")).toThrow("exactly four");
    expect(() => parsePreserveAspectRatio("middle meet")).toThrow();
  });

  test("zero-sized viewports do not divide by zero", () => {
    expect(viewBoxTransform({ x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 100, height: 100 })).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    });
  });
});
