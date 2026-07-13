import { parseSVGTransform } from "../transformUtils";

test("parse SVG transform functions", () => {
  expect(parseSVGTransform("translate(-106, -5)")).toEqual({ a: 1, b: 0, c: 0, d: 1, e: -106, f: -5 });
  expect(parseSVGTransform("matrix(1 2 3 4 5 6)")).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
});

test("apply SVG transform lists in declaration order", () => {
  expect(parseSVGTransform("translate(10 20) scale(2)")).toEqual({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 });
});

test("parse rotation around a center", () => {
  const transform = parseSVGTransform("rotate(90 10 20)");

  expect(transform.a).toBeCloseTo(0);
  expect(transform.b).toBeCloseTo(1);
  expect(transform.c).toBeCloseTo(-1);
  expect(transform.d).toBeCloseTo(0);
  expect(transform.e).toBeCloseTo(30);
  expect(transform.f).toBeCloseTo(10);
});
