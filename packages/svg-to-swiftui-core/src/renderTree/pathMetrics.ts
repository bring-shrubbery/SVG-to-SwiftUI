import { SVGPathData } from "svg-pathdata";
import type { SVGCommand } from "svg-pathdata/lib/types";
import type { AffineTransform } from "../transformUtils";
import type { Geometry, RenderTextPathPoint } from "./types";

interface Point {
  x: number;
  y: number;
}

export interface PathMetrics {
  points: RenderTextPathPoint[];
  /** Distances at authored segment endpoints; internal move commands are excluded. */
  keyDistances: number[];
  length: number;
  closed: boolean;
  authoredLength?: number;
}

export interface PathMetricSample {
  point: Point;
  /** Directional tangent in radians in the path's user coordinate system. */
  angle: number;
  /** Index of the flattened segment used for the sample. */
  segment: number;
}

export const PATH_METRIC_MAX_DEPTH = 18;
export const PATH_METRIC_MAX_POINTS = 131_072;

const IDENTITY: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function transformed(point: Point, matrix: AffineTransform): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

function pointLineDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  if (denominator === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator;
  const x = start.x + projection * dx;
  const y = start.y + projection * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function flattenQuadratic(
  start: Point,
  control: Point,
  end: Point,
  tolerance: number,
  output: Point[],
  depth = 0,
): void {
  if (depth >= PATH_METRIC_MAX_DEPTH || pointLineDistance(control, start, end) <= tolerance) {
    output.push(end);
    return;
  }
  const leftControl = midpoint(start, control);
  const rightControl = midpoint(control, end);
  const split = midpoint(leftControl, rightControl);
  flattenQuadratic(start, leftControl, split, tolerance, output, depth + 1);
  flattenQuadratic(split, rightControl, end, tolerance, output, depth + 1);
}

function flattenCubic(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  tolerance: number,
  output: Point[],
  depth = 0,
): void {
  const flatness = Math.max(pointLineDistance(control1, start, end), pointLineDistance(control2, start, end));
  if (depth >= PATH_METRIC_MAX_DEPTH || flatness <= tolerance) {
    output.push(end);
    return;
  }
  const p01 = midpoint(start, control1);
  const p12 = midpoint(control1, control2);
  const p23 = midpoint(control2, end);
  const p012 = midpoint(p01, p12);
  const p123 = midpoint(p12, p23);
  const split = midpoint(p012, p123);
  flattenCubic(start, p01, p012, split, tolerance, output, depth + 1);
  flattenCubic(split, p123, p23, end, tolerance, output, depth + 1);
}

function pathData(geometry: Geometry): string {
  switch (geometry.type) {
    case "path":
      return geometry.d;
    case "line":
      return `M${geometry.x1} ${geometry.y1}L${geometry.x2} ${geometry.y2}`;
    case "polyline":
      return `M${geometry.points.trim().replace(/^\s+/, "")}`;
    case "polygon":
      return `M${geometry.points.trim().replace(/^\s+/, "")}Z`;
    case "circle":
      return `M${geometry.cx + geometry.r} ${geometry.cy}A${geometry.r} ${geometry.r} 0 1 1 ${geometry.cx - geometry.r} ${geometry.cy}A${geometry.r} ${geometry.r} 0 1 1 ${geometry.cx + geometry.r} ${geometry.cy}Z`;
    case "ellipse":
      return `M${geometry.cx + geometry.rx} ${geometry.cy}A${geometry.rx} ${geometry.ry} 0 1 1 ${geometry.cx - geometry.rx} ${geometry.cy}A${geometry.rx} ${geometry.ry} 0 1 1 ${geometry.cx + geometry.rx} ${geometry.cy}Z`;
    case "rect": {
      const rx = Math.max(0, Math.min(geometry.rx ?? 0, geometry.width / 2));
      const ry = Math.max(0, Math.min(geometry.ry ?? 0, geometry.height / 2));
      if (rx === 0 || ry === 0)
        return `M${geometry.x} ${geometry.y}H${geometry.x + geometry.width}V${geometry.y + geometry.height}H${geometry.x}Z`;
      return `M${geometry.x + rx} ${geometry.y}H${geometry.x + geometry.width - rx}A${rx} ${ry} 0 0 1 ${geometry.x + geometry.width} ${geometry.y + ry}V${geometry.y + geometry.height - ry}A${rx} ${ry} 0 0 1 ${geometry.x + geometry.width - rx} ${geometry.y + geometry.height}H${geometry.x + rx}A${rx} ${ry} 0 0 1 ${geometry.x} ${geometry.y + geometry.height - ry}V${geometry.y + ry}A${rx} ${ry} 0 0 1 ${geometry.x + rx} ${geometry.y}Z`;
    }
  }
}

/**
 * Build deterministic distance-along-a-path metrics. Curves are subdivided
 * until their transformed control points are within `tolerance` user units of
 * the chord. Disconnected subpaths share one cumulative distance without an
 * artificial joining segment.
 */
export function measureGeometryPath(
  geometry: Geometry,
  matrix: AffineTransform = IDENTITY,
  tolerance = 0.02,
): PathMetrics {
  const commands = new SVGPathData(pathData(geometry)).toAbs().normalizeHVZ(false, true, true).normalizeST().aToC()
    .commands as SVGCommand[];
  const sampled: Array<{ point: Point; move: boolean }> = [];
  const authoredPointIndexes: number[] = [];
  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = current;
  let subpaths = 0;
  let allClosed = true;
  let currentClosed = false;

  const begin = (point: Point) => {
    if (subpaths > 0 && !currentClosed) allClosed = false;
    subpaths += 1;
    currentClosed = false;
    current = point;
    subpathStart = point;
    if (sampled.length >= PATH_METRIC_MAX_POINTS) throw new Error("SVG path metric point limit exceeded.");
    sampled.push({ point, move: true });
    if (subpaths === 1) authoredPointIndexes.push(sampled.length - 1);
  };
  const append = (points: Point[]) => {
    for (const point of points) {
      if (sampled.length >= PATH_METRIC_MAX_POINTS) throw new Error("SVG path metric point limit exceeded.");
      sampled.push({ point, move: false });
    }
    if (points.length > 0) current = points[points.length - 1]!;
  };

  for (const command of commands) {
    switch (command.type) {
      case SVGPathData.MOVE_TO:
        begin(transformed({ x: command.x, y: command.y }, matrix));
        break;
      case SVGPathData.LINE_TO:
        append([transformed({ x: command.x, y: command.y }, matrix)]);
        authoredPointIndexes.push(sampled.length - 1);
        break;
      case SVGPathData.QUAD_TO: {
        const points: Point[] = [];
        flattenQuadratic(
          current,
          transformed({ x: command.x1, y: command.y1 }, matrix),
          transformed({ x: command.x, y: command.y }, matrix),
          tolerance,
          points,
        );
        append(points);
        authoredPointIndexes.push(sampled.length - 1);
        break;
      }
      case SVGPathData.CURVE_TO: {
        const points: Point[] = [];
        flattenCubic(
          current,
          transformed({ x: command.x1, y: command.y1 }, matrix),
          transformed({ x: command.x2, y: command.y2 }, matrix),
          transformed({ x: command.x, y: command.y }, matrix),
          tolerance,
          points,
        );
        append(points);
        authoredPointIndexes.push(sampled.length - 1);
        break;
      }
      case SVGPathData.CLOSE_PATH:
        if (Math.hypot(current.x - subpathStart.x, current.y - subpathStart.y) > 1e-12) append([subpathStart]);
        if (sampled.length > 0) authoredPointIndexes.push(sampled.length - 1);
        currentClosed = true;
        break;
    }
  }
  if (subpaths > 0 && !currentClosed) allClosed = false;

  let length = 0;
  let previous: Point | undefined;
  const points = sampled.map((item) => {
    if (!item.move && previous) length += Math.hypot(item.point.x - previous.x, item.point.y - previous.y);
    previous = item.point;
    return { ...item.point, distance: length, move: item.move };
  });
  const authored = Number(geometry.pathLength);
  return {
    points,
    keyDistances: authoredPointIndexes.map((index) => points[index]?.distance ?? 0),
    length,
    closed: subpaths === 1 && allClosed,
    ...(Number.isFinite(authored) && authored > 0 ? { authoredLength: authored } : {}),
  };
}

function nonZeroSegment(points: readonly RenderTextPathPoint[], start: number, direction: -1 | 1): number | undefined {
  let index = start;
  while (index >= 1 && index < points.length) {
    const current = points[index]!;
    const previous = points[index - 1]!;
    if (!current.move && Math.hypot(current.x - previous.x, current.y - previous.y) > 1e-12) return index;
    index += direction;
  }
  return undefined;
}

/**
 * Sample flattened metrics without mutable cursors, so random-access frame
 * rendering is bit-for-bit stable. At discontinuities the outgoing subpath is
 * selected; a zero-length neighborhood searches forward, then backward.
 */
export function samplePathMetrics(metrics: PathMetrics, authoredDistance: number): PathMetricSample | undefined {
  const { points } = metrics;
  if (points.length === 0) return undefined;
  const scale = metrics.authoredLength ? metrics.length / metrics.authoredLength : 1;
  const distance = Math.min(metrics.length, Math.max(0, authoredDistance * scale));
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle]!.distance < distance - 1e-12) low = middle + 1;
    else high = middle;
  }
  let upper = low;
  while (upper + 1 < points.length && points[upper + 1]!.distance <= distance + 1e-12) upper += 1;
  const forwardStart = points[upper]!.distance <= distance + 1e-12 ? upper + 1 : upper;
  let segment = nonZeroSegment(points, Math.max(1, forwardStart), 1);
  if (segment === undefined) segment = nonZeroSegment(points, Math.min(points.length - 1, low), -1);
  if (segment === undefined) return { point: { x: points[upper]!.x, y: points[upper]!.y }, angle: 0, segment: upper };
  const end = points[segment]!;
  const start = points[segment - 1]!;
  const span = end.distance - start.distance;
  const progress = span <= 1e-12 ? 0 : Math.min(1, Math.max(0, (distance - start.distance) / span));
  return {
    point: { x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress },
    angle: Math.atan2(end.y - start.y, end.x - start.x),
    segment,
  };
}
