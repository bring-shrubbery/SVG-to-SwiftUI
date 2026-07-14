import { SVGPathData } from "svg-pathdata";
import { type AffineTransform, IDENTITY_TRANSFORM, multiplyTransforms } from "../transformUtils";
import type { ClipPathInstance, Geometry, RenderBounds, RenderDocument, RenderNode, RenderShape } from "./types";

function union(left: RenderBounds | undefined, right: RenderBounds | undefined): RenderBounds | undefined {
  if (!left) return right;
  if (!right) return left;
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: maxX - x, height: maxY - y };
}

function intersect(left: RenderBounds | undefined, right: RenderBounds): RenderBounds | undefined {
  if (!left) return undefined;
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const maxX = Math.min(left.x + left.width, right.x + right.width);
  const maxY = Math.min(left.y + left.height, right.y + right.height);
  return maxX < x || maxY < y ? undefined : { x, y, width: maxX - x, height: maxY - y };
}

function transformedRect(x: number, y: number, width: number, height: number, matrix: AffineTransform): RenderBounds {
  const points = [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ].map(([px, py]) => ({
    x: matrix.a * px! + matrix.c * py! + matrix.e,
    y: matrix.b * px! + matrix.d * py! + matrix.f,
  }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function transformedGeometryBounds(geometry: Geometry, matrix: AffineTransform): RenderBounds | undefined {
  const transformedPoint = (x: number, y: number) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  });
  const boundsForPoints = (points: Array<{ x: number; y: number }>): RenderBounds | undefined => {
    if (points.length === 0) return undefined;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  };

  switch (geometry.type) {
    case "rect":
      return transformedRect(geometry.x, geometry.y, geometry.width, geometry.height, matrix);
    case "circle":
    case "ellipse": {
      const cx = geometry.cx;
      const cy = geometry.cy;
      const rx = geometry.type === "circle" ? geometry.r : geometry.rx;
      const ry = geometry.type === "circle" ? geometry.r : geometry.ry;
      const center = transformedPoint(cx, cy);
      const radiusX = Math.hypot(matrix.a * rx, matrix.c * ry);
      const radiusY = Math.hypot(matrix.b * rx, matrix.d * ry);
      return { x: center.x - radiusX, y: center.y - radiusY, width: 2 * radiusX, height: 2 * radiusY };
    }
    case "line":
      return boundsForPoints([transformedPoint(geometry.x1, geometry.y1), transformedPoint(geometry.x2, geometry.y2)]);
    case "polyline":
    case "polygon": {
      const values = geometry.points
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return undefined;
      const points: Array<{ x: number; y: number }> = [];
      for (let index = 0; index + 1 < values.length; index += 2)
        points.push(transformedPoint(values[index]!, values[index + 1]!));
      return boundsForPoints(points);
    }
    case "path": {
      try {
        const bounds = new SVGPathData(geometry.d)
          .toAbs()
          .matrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f)
          .getBounds();
        return { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
      } catch {
        return undefined;
      }
    }
  }
}

function pointsBounds(points: string): RenderBounds | undefined {
  const values = points
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return undefined;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    xs.push(values[index]!);
    ys.push(values[index + 1]!);
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Untransformed geometry bounds, excluding stroke expansion and paint effects. */
export function geometryBounds(geometry: Geometry): RenderBounds | undefined {
  switch (geometry.type) {
    case "rect":
      return { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height };
    case "circle":
      return {
        x: geometry.cx - geometry.r,
        y: geometry.cy - geometry.r,
        width: 2 * geometry.r,
        height: 2 * geometry.r,
      };
    case "ellipse":
      return {
        x: geometry.cx - geometry.rx,
        y: geometry.cy - geometry.ry,
        width: 2 * geometry.rx,
        height: 2 * geometry.ry,
      };
    case "line": {
      const x = Math.min(geometry.x1, geometry.x2);
      const y = Math.min(geometry.y1, geometry.y2);
      return { x, y, width: Math.abs(geometry.x2 - geometry.x1), height: Math.abs(geometry.y2 - geometry.y1) };
    }
    case "polyline":
    case "polygon":
      return pointsBounds(geometry.points);
    case "path": {
      try {
        const bounds = new SVGPathData(geometry.d).getBounds();
        return { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
      } catch {
        return undefined;
      }
    }
  }
}

function expandForStroke(bounds: RenderBounds, shape: RenderShape): RenderBounds {
  if (shape.style.stroke.type === "none" || shape.style.strokeStyle.width <= 0) return bounds;
  const half = shape.style.strokeStyle.width / 2;
  const factor =
    (shape.geometry.type === "path" || shape.geometry.type === "polyline" || shape.geometry.type === "polygon") &&
    shape.style.strokeStyle.lineJoin === "miter"
      ? Math.max(1, shape.style.strokeStyle.miterLimit)
      : 1;
  const expansion = half * factor;
  return {
    x: bounds.x - expansion,
    y: bounds.y - expansion,
    width: bounds.width + 2 * expansion,
    height: bounds.height + 2 * expansion,
  };
}

function transformedShapeBounds(shape: RenderShape, transform: AffineTransform): RenderBounds | undefined {
  const hasFill = shape.geometry.type !== "line" && shape.style.fill.type !== "none";
  const hasStroke = shape.style.stroke.type !== "none" && shape.style.strokeStyle.width > 0;
  if (!hasFill && !hasStroke) return undefined;
  const bounds = transformedGeometryBounds(shape.geometry, transform);
  if (!bounds || !hasStroke) return bounds;

  const half = shape.style.strokeStyle.width / 2;
  if (shape.geometry.type === "line" && !shape.style.strokeStyle.dashArray) {
    const point = (x: number, y: number) => ({
      x: transform.a * x + transform.c * y + transform.e,
      y: transform.b * x + transform.d * y + transform.f,
    });
    const localStart = { x: shape.geometry.x1, y: shape.geometry.y1 };
    const localEnd = { x: shape.geometry.x2, y: shape.geometry.y2 };
    const start = point(localStart.x, localStart.y);
    const end = point(localEnd.x, localEnd.y);
    const nonScaling = shape.style.strokeStyle.vectorEffect === "non-scaling-stroke";
    const dx = nonScaling ? end.x - start.x : localEnd.x - localStart.x;
    const dy = nonScaling ? end.y - start.y : localEnd.y - localStart.y;
    const length = Math.hypot(dx, dy);
    if (length === 0 && shape.style.strokeStyle.lineCap === "butt") return undefined;

    if (shape.style.strokeStyle.lineCap === "round") {
      const expansionX = half * (nonScaling ? 1 : Math.hypot(transform.a, transform.c));
      const expansionY = half * (nonScaling ? 1 : Math.hypot(transform.b, transform.d));
      return {
        x: bounds.x - expansionX,
        y: bounds.y - expansionY,
        width: bounds.width + 2 * expansionX,
        height: bounds.height + 2 * expansionY,
      };
    }

    const tangent = length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
    const normal = { x: -tangent.y, y: tangent.x };
    const cap = shape.style.strokeStyle.lineCap === "square" ? half : 0;
    const strokePoints = [
      { x: -cap, y: -half },
      { x: -cap, y: half },
      { x: length + cap, y: -half },
      { x: length + cap, y: half },
    ].map(({ x, y }) => {
      if (nonScaling) {
        return { x: start.x + tangent.x * x + normal.x * y, y: start.y + tangent.y * x + normal.y * y };
      }
      return point(localStart.x + tangent.x * x + normal.x * y, localStart.y + tangent.y * x + normal.y * y);
    });
    const xs = strokePoints.map((item) => item.x);
    const ys = strokePoints.map((item) => item.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }

  const miterFactor =
    (shape.geometry.type === "path" || shape.geometry.type === "polyline" || shape.geometry.type === "polygon") &&
    shape.style.strokeStyle.lineJoin === "miter"
      ? Math.max(1, shape.style.strokeStyle.miterLimit)
      : 1;
  const nonScaling = shape.style.strokeStyle.vectorEffect === "non-scaling-stroke";
  const expansionX = half * miterFactor * (nonScaling ? 1 : Math.hypot(transform.a, transform.c));
  const expansionY = half * miterFactor * (nonScaling ? 1 : Math.hypot(transform.b, transform.d));
  return {
    x: bounds.x - expansionX,
    y: bounds.y - expansionY,
    width: bounds.width + 2 * expansionX,
    height: bounds.height + 2 * expansionY,
  };
}

/** Object bounding box before the target node's own transform. */
export function objectBoundingBox(node: RenderNode): RenderBounds | undefined {
  if (node.type === "shape") return geometryBounds(node.geometry);
  if (node.type === "image") return node.viewport;
  if (node.type === "group") {
    const geometricBounds = (candidate: RenderNode, parent = IDENTITY_TRANSFORM): RenderBounds | undefined => {
      if (candidate.style.display === "none") return undefined;
      const transform = multiplyTransforms(parent, candidate.transform);
      if (candidate.type === "shape") {
        const bounds = geometryBounds(candidate.geometry);
        return bounds ? transformedRect(bounds.x, bounds.y, bounds.width, bounds.height, transform) : undefined;
      }
      if (candidate.type === "image") {
        const bounds = candidate.viewport;
        return transformedRect(bounds.x, bounds.y, bounds.width, bounds.height, transform);
      }
      if (candidate.type === "group")
        return candidate.children.reduce<RenderBounds | undefined>(
          (bounds, child) => union(bounds, geometricBounds(child, transform)),
          undefined,
        );
      return undefined;
    };
    return node.children.reduce<RenderBounds | undefined>(
      (bounds, child) => union(bounds, geometricBounds(child)),
      undefined,
    );
  }
  return undefined;
}

/** Local bounds for one paint phase, including stroke expansion when requested. */
export function shapePaintBounds(shape: RenderShape, kind: "fill" | "stroke"): RenderBounds | undefined {
  if (kind === "stroke" && (shape.style.stroke.type === "none" || shape.style.strokeStyle.width <= 0)) return undefined;
  if (kind === "fill" && (shape.geometry.type === "line" || shape.style.fill.type === "none")) return undefined;
  const bounds = geometryBounds(shape.geometry);
  if (!bounds) return undefined;
  return kind === "stroke" ? expandForStroke(bounds, shape) : bounds;
}

function hidden(visibility: string): boolean {
  return visibility === "hidden" || visibility === "collapse";
}

/** Raw clip geometry bounds. Paint, stroke, opacity, masks, and filters do not contribute. */
function clipNodesBounds(nodes: RenderNode[], parent: AffineTransform): RenderBounds | undefined {
  let bounds: RenderBounds | undefined;
  for (const node of nodes) {
    if (node.style.display === "none") continue;
    const transform = multiplyTransforms(parent, node.transform);
    let candidate: RenderBounds | undefined;
    if (node.type === "shape") {
      if (hidden(node.style.visibility)) continue;
      const geometry = geometryBounds(node.geometry);
      candidate = geometry
        ? transformedRect(geometry.x, geometry.y, geometry.width, geometry.height, transform)
        : undefined;
    } else if (node.type === "group") {
      candidate = clipNodesBounds(node.children, transform);
    }
    if (node.clipPath) {
      const nested = clipPathInstanceBounds(node.clipPath, transform);
      candidate = nested ? intersect(candidate, nested) : undefined;
    }
    bounds = union(bounds, candidate);
  }
  return bounds;
}

function clipPathInstanceBounds(
  instance: ClipPathInstance,
  targetTransform: AffineTransform,
): RenderBounds | undefined {
  if (instance.invalid || instance.children.length === 0) return undefined;
  const content = instance.children.map((node) =>
    node.type === "group"
      ? { ...node, transform: multiplyTransforms(node.transform, instance.contentTransform) }
      : node,
  );
  return clipNodesBounds(content, targetTransform);
}

/** Painted axis-aligned bounds for a node in the generated root coordinate space. */
export function renderNodeBounds(node: RenderNode, parent = IDENTITY_TRANSFORM): RenderBounds | undefined {
  if (node.style.display === "none") return undefined;
  const transform = multiplyTransforms(parent, node.transform);
  if (node.type === "shape") {
    if (hidden(node.style.visibility)) return undefined;
    let painted = transformedShapeBounds(node, transform);
    if (node.markers) painted = union(painted, renderNodesBounds(node.markers, transform));
    if (node.clipPath) {
      const clip = clipPathInstanceBounds(node.clipPath, transform);
      painted = clip ? intersect(painted, clip) : undefined;
    }
    return painted;
  }
  if (node.type === "group") {
    let bounds = renderNodesBounds(node.children, transform);
    if (node.viewport?.clip) {
      const clip = node.viewport.rect;
      const clipTransform = multiplyTransforms(parent, node.viewport.clipTransform);
      bounds = intersect(bounds, transformedRect(clip.x, clip.y, clip.width, clip.height, clipTransform));
    }
    if (node.clipPath) {
      const clip = clipPathInstanceBounds(node.clipPath, transform);
      bounds = clip ? intersect(bounds, clip) : undefined;
    }
    return bounds;
  }
  if (node.type === "image") {
    if (hidden(node.style.visibility) || !node.resource || node.viewport.width <= 0 || node.viewport.height <= 0)
      return undefined;
    let bounds: RenderBounds | undefined = transformedRect(
      node.viewport.x,
      node.viewport.y,
      node.viewport.width,
      node.viewport.height,
      transform,
    );
    if (node.clipPath) {
      const clip = clipPathInstanceBounds(node.clipPath, transform);
      bounds = clip ? intersect(bounds, clip) : undefined;
    }
    return bounds;
  }
  return undefined;
}

/** Union painted bounds for sibling render nodes. */
export function renderNodesBounds(nodes: RenderNode[], parent = IDENTITY_TRANSFORM): RenderBounds | undefined {
  return nodes.reduce<RenderBounds | undefined>(
    (bounds, node) => union(bounds, renderNodeBounds(node, parent)),
    undefined,
  );
}

/** Painted bounds for a complete SVG document, including root viewBox mapping. */
export function renderDocumentBounds(document: RenderDocument): RenderBounds | undefined {
  return renderNodesBounds(document.children);
}
