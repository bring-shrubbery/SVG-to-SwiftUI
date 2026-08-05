import { measureGeometryPath, samplePathMetrics } from "../renderTree/pathMetrics";

describe("text path metrics", () => {
  test("measures lines exactly and keeps disconnected subpaths discontinuous", () => {
    const metrics = measureGeometryPath({ type: "path", d: "M0 0L30 40M100 100L103 104" });
    expect(metrics.length).toBeCloseTo(55);
    expect(metrics.closed).toBe(false);
    expect(metrics.points.filter((point) => point.move)).toHaveLength(2);
    expect(metrics.points[metrics.points.length - 1]?.distance).toBeCloseTo(55);
    expect(metrics.keyDistances).toEqual([0, 50, 55]);
  });

  test("adaptively subdivides curves after transforms and retains pathLength calibration", () => {
    const metrics = measureGeometryPath(
      { type: "path", d: "M0 0C0 100 100 100 100 0", pathLength: "50" },
      { a: 2, b: 0, c: 0, d: 0.5, e: 10, f: -4 },
    );
    expect(metrics.points.length).toBeGreaterThan(20);
    expect(metrics.length).toBeGreaterThan(200);
    expect(metrics.authoredLength).toBe(50);
    expect(metrics.keyDistances).toHaveLength(2);
  });

  test("converts basic shapes, rounded rectangles, and closed paths", () => {
    const circle = measureGeometryPath({ type: "circle", cx: 20, cy: 20, r: 10 });
    const rounded = measureGeometryPath({ type: "rect", x: 0, y: 0, width: 40, height: 20, rx: 4, ry: 6 });
    expect(circle.closed).toBe(true);
    expect(circle.length).toBeCloseTo(2 * Math.PI * 10, 1);
    expect(rounded.closed).toBe(true);
    expect(rounded.points.length).toBeGreaterThan(10);
  });

  test("samples joins, discontinuities, endpoints, and degenerate neighborhoods deterministically", () => {
    const metrics = measureGeometryPath({ type: "path", d: "M0 0L10 0L10 10M30 30L30 30L40 30" });
    expect(samplePathMetrics(metrics, 0)).toMatchObject({ point: { x: 0, y: 0 }, angle: 0 });
    expect(samplePathMetrics(metrics, 15)?.point).toEqual({ x: 10, y: 5 });
    expect(samplePathMetrics(metrics, 10)?.angle).toBeCloseTo(Math.PI / 2);
    expect(samplePathMetrics(metrics, 20)).toMatchObject({ point: { x: 30, y: 30 }, angle: 0 });
    expect(samplePathMetrics(metrics, 30)?.point).toEqual({ x: 40, y: 30 });
    expect(samplePathMetrics(metrics, 15)).toEqual(samplePathMetrics(metrics, 15));
  });

  test("calibrates authored pathLength distances", () => {
    const metrics = measureGeometryPath({ type: "line", x1: 0, y1: 0, x2: 100, y2: 0, pathLength: "10" });
    expect(samplePathMetrics(metrics, 2.5)?.point.x).toBeCloseTo(25);
  });
});
