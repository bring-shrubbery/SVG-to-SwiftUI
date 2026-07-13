import { SVGPathData } from "svg-pathdata";
import { type AffineTransform, IDENTITY_TRANSFORM, multiplyTransforms } from "../transformUtils";
import type { Geometry, RenderBounds, RenderDocument, RenderNode, RenderShape } from "./types";

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

function localShapeBounds(shape: RenderShape): RenderBounds | undefined {
  if (shape.style.fill.type === "none" && shape.style.stroke.type === "none") return undefined;
  const bounds = geometryBounds(shape.geometry);
  return bounds ? expandForStroke(bounds, shape) : undefined;
}

/** Object bounding box before the target node's own transform. */
export function objectBoundingBox(node: RenderNode): RenderBounds | undefined {
  if (node.type === "shape") return geometryBounds(node.geometry);
  if (node.type === "group") {
    const geometricBounds = (candidate: RenderNode, parent = IDENTITY_TRANSFORM): RenderBounds | undefined => {
      if (candidate.style.display === "none") return undefined;
      const transform = multiplyTransforms(parent, candidate.transform);
      if (candidate.type === "shape") {
        const bounds = geometryBounds(candidate.geometry);
        return bounds ? transformedRect(bounds.x, bounds.y, bounds.width, bounds.height, transform) : undefined;
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
  const bounds = geometryBounds(shape.geometry);
  if (!bounds) return undefined;
  return kind === "stroke" ? expandForStroke(bounds, shape) : bounds;
}

function hidden(visibility: string): boolean {
  return visibility === "hidden" || visibility === "collapse";
}

/** Painted axis-aligned bounds for a node in the generated root coordinate space. */
export function renderNodeBounds(node: RenderNode, parent = IDENTITY_TRANSFORM): RenderBounds | undefined {
  if (node.style.display === "none") return undefined;
  const transform = multiplyTransforms(parent, node.transform);
  if (node.type === "shape") {
    if (hidden(node.style.visibility)) return undefined;
    const bounds = localShapeBounds(node);
    return bounds ? transformedRect(bounds.x, bounds.y, bounds.width, bounds.height, transform) : undefined;
  }
  if (node.type === "group") {
    let bounds = renderNodesBounds(node.children, transform);
    if (node.viewport?.clip) {
      const clip = node.viewport.rect;
      const clipTransform = multiplyTransforms(parent, node.viewport.clipTransform);
      bounds = intersect(bounds, transformedRect(clip.x, clip.y, clip.width, clip.height, clipTransform));
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
