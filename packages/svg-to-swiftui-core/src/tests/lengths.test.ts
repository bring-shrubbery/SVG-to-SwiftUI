import {
  defaultFontMetrics,
  lengthContext,
  normalizedViewportDiagonal,
  parseSVGLength,
  resolveSVGLength,
} from "../lengths";

const viewport = { width: 200, height: 100 };
const rootViewport = { width: 300, height: 150 };
const fontMetrics = { fontSize: 20, rootFontSize: 16, xHeight: 9, zeroAdvance: 11 };

function resolve(value: string, basis: Parameters<typeof lengthContext>[2] = "viewport-width") {
  return resolveSVGLength(parseSVGLength(value), lengthContext(viewport, rootViewport, basis, "other", fontMetrics));
}

describe("typed SVG lengths", () => {
  test.each([
    ["12", 12],
    ["12px", 12],
    ["1in", 96],
    ["2.54cm", 96],
    ["25.4mm", 96],
    ["101.6q", 96],
    ["72pt", 96],
    ["6pc", 96],
    ["2em", 40],
    ["2ex", 18],
    ["2ch", 22],
    ["2rem", 32],
    ["10vw", 30],
    ["10vh", 15],
    ["10vmin", 15],
    ["10vmax", 30],
    ["1e2px", 100],
  ])("resolves %s without discarding its unit", (source, expected) => {
    expect(resolve(source)).toBeCloseTo(expected);
  });

  test("uses the consuming attribute's explicit percentage basis", () => {
    expect(resolve("25%", "viewport-width")).toBe(50);
    expect(resolve("25%", "viewport-height")).toBe(25);
    expect(resolve("25%", "viewport-diagonal")).toBeCloseTo(normalizedViewportDiagonal(viewport) / 4);
    expect(resolve("25%", "root-width")).toBe(75);
    expect(resolve("25%", 80)).toBe(20);
  });

  test("retains missing and allowed auto values", () => {
    expect(parseSVGLength(undefined)).toEqual({ kind: "missing" });
    expect(parseSVGLength("auto", { allowAuto: true })).toEqual({ kind: "auto" });
    expect(() => parseSVGLength("auto")).toThrow("auto is not allowed");
  });

  test.each(["NaN", "Infinity", "1foo", "1 px", "calc(1px)"])("rejects invalid length %s", (source) => {
    expect(() => parseSVGLength(source)).toThrow();
  });

  test("parsing retains negative values for the consuming attribute to validate", () => {
    expect(parseSVGLength("-2cm")).toEqual({ kind: "length", value: -2, unit: "cm" });
  });

  test("provides deterministic initial font metrics", () => {
    expect(defaultFontMetrics(18, 16)).toEqual({ fontSize: 18, rootFontSize: 16, xHeight: 9, zeroAdvance: 9 });
  });
});
