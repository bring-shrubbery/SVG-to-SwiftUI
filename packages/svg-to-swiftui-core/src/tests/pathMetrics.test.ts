import { measureGeometryPath } from "../renderTree/pathMetrics";

describe("text path metrics", () => {
  test("measures lines exactly and keeps disconnected subpaths discontinuous", () => {
    const metrics = measureGeometryPath({ type: "path", d: "M0 0L30 40M100 100L103 104" });
    expect(metrics.length).toBeCloseTo(55);
    expect(metrics.closed).toBe(false);
    expect(metrics.points.filter((point) => point.move)).toHaveLength(2);
    expect(metrics.points[metrics.points.length - 1]?.distance).toBeCloseTo(55);
  });

  test("adaptively subdivides curves after transforms and retains pathLength calibration", () => {
    const metrics = measureGeometryPath(
      { type: "path", d: "M0 0C0 100 100 100 100 0", pathLength: "50" },
      { a: 2, b: 0, c: 0, d: 0.5, e: 10, f: -4 },
    );
    expect(metrics.points.length).toBeGreaterThan(20);
    expect(metrics.length).toBeGreaterThan(200);
    expect(metrics.authoredLength).toBe(50);
  });

  test("converts basic shapes, rounded rectangles, and closed paths", () => {
    const circle = measureGeometryPath({ type: "circle", cx: 20, cy: 20, r: 10 });
    const rounded = measureGeometryPath({ type: "rect", x: 0, y: 0, width: 40, height: 20, rx: 4, ry: 6 });
    expect(circle.closed).toBe(true);
    expect(circle.length).toBeCloseTo(2 * Math.PI * 10, 1);
    expect(rounded.closed).toBe(true);
    expect(rounded.points.length).toBeGreaterThan(10);
  });
});
