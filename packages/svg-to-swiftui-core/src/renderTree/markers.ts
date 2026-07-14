import type { ElementNode } from "svg-parser";
import { SVGPathData } from "svg-pathdata";
import { type ParsedSVGLength, parseSVGLength, SVGLengthError } from "../lengths";
import type { Presentation, StyleResolution, SVGStyleResolver } from "../styleCascade";
import { DEFAULT_PRESERVE_ASPECT_RATIO, parsePreserveAspectRatio, parseViewBox } from "../viewports";
import type {
  Geometry,
  MarkerOrient,
  MarkerRefCoordinate,
  MarkerResource,
  MarkerUnits,
  RenderDiagnostic,
  SourceLocation,
} from "./types";

type PathCommand = InstanceType<typeof SVGPathData>["commands"][number];

export interface MarkerVertex {
  x: number;
  y: number;
  /** Automatic orientation in SVG user-space degrees. */
  angle: number;
}

interface Point {
  x: number;
  y: number;
}

interface Segment {
  start: Point;
  end: Point;
  nonZero: boolean;
  rawStart?: Point;
  rawEnd?: Point;
  startDirection?: Point;
  endDirection?: Point;
}

interface Subpath {
  vertices: Point[];
  segments: Segment[];
  closed: boolean;
}

const DESCRIPTIVE_ELEMENTS = new Set(["desc", "metadata", "title"]);
const EPSILON = 1e-12;

function sourceLocation(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) };
}

function diagnostic(diagnostics: RenderDiagnostic[], element: ElementNode, code: string, message: string): void {
  diagnostics.push({ code, message, severity: "warning", source: sourceLocation(element) });
}

function children(element: ElementNode): ElementNode[] {
  return element.children.filter(
    (child): child is ElementNode => typeof child !== "string" && child.type === "element",
  );
}

function containsMarker(element: ElementNode): boolean {
  return element.tagName === "marker" || children(element).some(containsMarker);
}

function parsedLength(
  raw: unknown,
  fallback: string,
  label: string,
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): ParsedSVGLength {
  try {
    const parsed = parseSVGLength(raw ?? fallback);
    if (parsed.kind !== "length") throw new SVGLengthError("invalid-marker-length", `${label} requires a length.`);
    return parsed;
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      error instanceof SVGLengthError ? error.code : "invalid-marker-length",
      `Invalid ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return parseSVGLength(fallback) as ParsedSVGLength;
  }
}

function refCoordinate(
  raw: unknown,
  axis: "x" | "y",
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): MarkerRefCoordinate {
  const normalized = String(raw ?? "0")
    .trim()
    .toLowerCase();
  const keywords =
    axis === "x"
      ? ({ left: "min", center: "center", right: "max" } as const)
      : ({ top: "min", center: "center", bottom: "max" } as const);
  if (normalized in keywords) return { type: "keyword", value: keywords[normalized as keyof typeof keywords]! };
  return { type: "length", value: parsedLength(raw, "0", `marker ref${axis.toUpperCase()}`, element, diagnostics) };
}

function markerUnits(raw: unknown, element: ElementNode, diagnostics: RenderDiagnostic[]): MarkerUnits {
  const value = String(raw ?? "strokeWidth");
  if (value === "strokeWidth" || value === "userSpaceOnUse") return value;
  diagnostic(diagnostics, element, "invalid-marker-units", `Invalid markerUnits '${value}'.`);
  return "strokeWidth";
}

function markerOrient(raw: unknown, element: ElementNode, diagnostics: RenderDiagnostic[]): MarkerOrient {
  const normalized = String(raw ?? "0")
    .trim()
    .toLowerCase();
  if (normalized === "auto" || normalized === "auto-start-reverse") return { type: normalized };
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i.exec(normalized);
  if (!match) {
    diagnostic(diagnostics, element, "invalid-marker-orient", `Invalid marker orient '${normalized}'.`);
    return { type: "angle", degrees: 0 };
  }
  const value = Number(match[1]);
  const degrees =
    match[2] === "rad"
      ? (value * 180) / Math.PI
      : match[2] === "grad"
        ? value * 0.9
        : match[2] === "turn"
          ? value * 360
          : value;
  return { type: "angle", degrees };
}

/** Resolve typed marker definitions while retaining their original cascade and shadow content. */
export function resolveMarkerResources(
  root: ElementNode,
  markerElements: Map<string, ElementNode>,
  styleResolver: SVGStyleResolver,
  rootPresentation: Presentation,
  diagnostics: RenderDiagnostic[],
): Map<string, MarkerResource> {
  const resolutions = new Map<ElementNode, StyleResolution>();
  const walk = (element: ElementNode, inherited: Presentation): void => {
    for (const child of children(element)) {
      if (!containsMarker(child)) continue;
      const resolved = styleResolver.resolve(child, inherited);
      resolutions.set(child, resolved);
      walk(child, resolved.values);
    }
  };
  walk(root, rootPresentation);

  const resources = new Map<string, MarkerResource>();
  for (const [id, element] of markerElements) {
    const resolved = resolutions.get(element);
    const markerWidth = parsedLength(element.properties?.markerWidth, "3", "markerWidth", element, diagnostics);
    const markerHeight = parsedLength(element.properties?.markerHeight, "3", "markerHeight", element, diagnostics);
    if (markerWidth.value < 0)
      diagnostic(diagnostics, element, "negative-marker-width", "markerWidth cannot be negative.");
    if (markerHeight.value < 0)
      diagnostic(diagnostics, element, "negative-marker-height", "markerHeight cannot be negative.");

    let viewBox: ReturnType<typeof parseViewBox>;
    try {
      viewBox = parseViewBox(element.properties?.viewBox);
    } catch (error) {
      diagnostic(
        diagnostics,
        element,
        error instanceof SVGLengthError ? error.code : "invalid-marker-viewbox",
        error instanceof Error ? error.message : String(error),
      );
    }

    let preserveAspectRatio = DEFAULT_PRESERVE_ASPECT_RATIO;
    try {
      preserveAspectRatio = parsePreserveAspectRatio(element.properties?.preserveAspectRatio);
    } catch (error) {
      diagnostic(
        diagnostics,
        element,
        error instanceof SVGLengthError ? error.code : "invalid-marker-preserve-aspect-ratio",
        error instanceof Error ? error.message : String(error),
      );
    }

    const authoredOverflow = resolved?.provenance.overflow ? resolved.values.overflow : "hidden";
    resources.set(id, {
      id,
      markerWidth,
      markerHeight,
      refX: refCoordinate(element.properties?.refX, "x", element, diagnostics),
      refY: refCoordinate(element.properties?.refY, "y", element, diagnostics),
      units: markerUnits(element.properties?.markerUnits, element, diagnostics),
      orient: markerOrient(element.properties?.orient, element, diagnostics),
      ...(viewBox ? { viewBox } : {}),
      preserveAspectRatio,
      overflow: String(authoredOverflow ?? "hidden").toLowerCase(),
      source: sourceLocation(element),
      element,
      contentElements: children(element).filter((child) => !DESCRIPTIVE_ELEMENTS.has(child.tagName ?? "")),
      children: [],
      instances: new Map(),
      presentation: resolved?.values ?? rootPresentation,
      provenance: resolved?.provenance ?? {},
    });
  }
  return resources;
}

function samePoint(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON;
}

function vector(from: Point, to: Point): Point | undefined {
  const result = { x: to.x - from.x, y: to.y - from.y };
  return Math.hypot(result.x, result.y) <= EPSILON ? undefined : result;
}

function normalized(value: Point | undefined): Point | undefined {
  if (!value) return undefined;
  const length = Math.hypot(value.x, value.y);
  return length <= EPSILON ? undefined : { x: value.x / length, y: value.y / length };
}

function curveDirection(origin: Point, candidates: Point[]): Point | undefined {
  for (const candidate of candidates) {
    const result = normalized(vector(origin, candidate));
    if (result) return result;
  }
  return undefined;
}

function lineSegment(start: Point, end: Point): Segment {
  const direction = normalized(vector(start, end));
  return { start, end, nonZero: !!direction, ...(direction ? { rawStart: direction, rawEnd: direction } : {}) };
}

function curveSegment(start: Point, end: Point, startControls: Point[], endControls: Point[]): Segment {
  const rawStart = curveDirection(start, [...startControls, end]);
  const reverseEnd = curveDirection(end, [...endControls, start]);
  const rawEnd = reverseEnd ? { x: -reverseEnd.x, y: -reverseEnd.y } : undefined;
  const nonZero =
    !samePoint(start, end) || [...startControls, ...endControls].some((point) => !samePoint(start, point));
  return { start, end, nonZero, ...(rawStart ? { rawStart } : {}), ...(rawEnd ? { rawEnd } : {}) };
}

function arcSegment(start: Point, command: Extract<PathCommand, { type: 512 }>): Segment | undefined {
  const end = { x: command.x, y: command.y };
  // SVG defines a same-endpoint arc as omitted, so it creates no marker vertex.
  if (samePoint(start, end)) return undefined;
  if (command.rX === 0 || command.rY === 0) return lineSegment(start, end);
  const converted = new SVGPathData([
    { type: SVGPathData.MOVE_TO, relative: false, x: start.x, y: start.y },
    { ...command, relative: false },
  ]).aToC().commands;
  const curves = converted.filter(
    (item): item is Extract<PathCommand, { type: 32 }> => item.type === SVGPathData.CURVE_TO,
  );
  if (curves.length === 0) return lineSegment(start, end);
  const first = curves[0]!;
  const last = curves[curves.length - 1]!;
  return curveSegment(
    start,
    end,
    [
      { x: first.x1, y: first.y1 },
      { x: first.x2, y: first.y2 },
    ],
    [
      { x: last.x2, y: last.y2 },
      { x: last.x1, y: last.y1 },
    ],
  );
}

function pathSubpaths(d: string): Subpath[] {
  const commands = new SVGPathData(d).toAbs().normalizeST().commands;
  const subpaths: Subpath[] = [];
  let current: Subpath | undefined;
  let point: Point = { x: 0, y: 0 };

  const finish = () => {
    if (current) subpaths.push(current);
    current = undefined;
  };
  const append = (segment: Segment | undefined) => {
    if (!current || !segment) return;
    current.segments.push(segment);
    current.vertices.push(segment.end);
    point = segment.end;
  };

  for (const command of commands) {
    if (command.type === SVGPathData.MOVE_TO) {
      finish();
      point = { x: command.x, y: command.y };
      current = { vertices: [point], segments: [], closed: false };
      continue;
    }
    if (!current) continue;
    if (command.type === SVGPathData.CLOSE_PATH) {
      append(lineSegment(point, current.vertices[0]!));
      current.closed = true;
      continue;
    }
    if (command.type === SVGPathData.LINE_TO) {
      append(lineSegment(point, { x: command.x, y: command.y }));
      continue;
    }
    if (command.type === SVGPathData.HORIZ_LINE_TO) {
      append(lineSegment(point, { x: command.x, y: point.y }));
      continue;
    }
    if (command.type === SVGPathData.VERT_LINE_TO) {
      append(lineSegment(point, { x: point.x, y: command.y }));
      continue;
    }
    if (command.type === SVGPathData.CURVE_TO) {
      const end = { x: command.x, y: command.y };
      append(
        curveSegment(
          point,
          end,
          [
            { x: command.x1, y: command.y1 },
            { x: command.x2, y: command.y2 },
          ],
          [
            { x: command.x2, y: command.y2 },
            { x: command.x1, y: command.y1 },
          ],
        ),
      );
      continue;
    }
    if (command.type === SVGPathData.QUAD_TO) {
      const end = { x: command.x, y: command.y };
      const control = { x: command.x1, y: command.y1 };
      append(curveSegment(point, end, [control], [control]));
      continue;
    }
    if (command.type === SVGPathData.ARC) append(arcSegment(point, command));
  }
  finish();
  return subpaths;
}

function points(value: string): Point[] {
  const values = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (values.length < 2 || values.some((item) => !Number.isFinite(item))) return [];
  const result: Point[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) result.push({ x: values[index]!, y: values[index + 1]! });
  return result;
}

function polySubpath(value: string, closed: boolean): Subpath[] {
  const vertices = points(value);
  if (vertices.length === 0) return [];
  const segments: Segment[] = [];
  for (let index = 1; index < vertices.length; index++)
    segments.push(lineSegment(vertices[index - 1]!, vertices[index]!));
  const allVertices = [...vertices];
  if (closed) {
    const closing = lineSegment(vertices[vertices.length - 1]!, vertices[0]!);
    segments.push(closing);
    allVertices.push(closing.end);
  }
  return [{ vertices: allVertices, segments, closed }];
}

function equivalentClosedPath(d: string): Subpath[] {
  const subpaths = pathSubpaths(d);
  if (subpaths.length === 1) subpaths[0]!.closed = true;
  return subpaths;
}

function geometrySubpaths(geometry: Geometry): Subpath[] {
  switch (geometry.type) {
    case "path":
      return pathSubpaths(geometry.d);
    case "line":
      return polySubpath(`${geometry.x1},${geometry.y1} ${geometry.x2},${geometry.y2}`, false);
    case "polyline":
      return polySubpath(geometry.points, false);
    case "polygon":
      return polySubpath(geometry.points, true);
    case "circle": {
      if (geometry.r <= 0) return [];
      const { cx, cy, r } = geometry;
      return equivalentClosedPath(
        `M${cx + r},${cy}A${r},${r} 0 0 0 ${cx},${cy + r}A${r},${r} 0 0 0 ${cx - r},${cy}` +
          `A${r},${r} 0 0 0 ${cx},${cy - r}A${r},${r} 0 0 0 ${cx + r},${cy}`,
      );
    }
    case "ellipse": {
      if (geometry.rx <= 0 || geometry.ry <= 0) return [];
      const { cx, cy, rx, ry } = geometry;
      return equivalentClosedPath(
        `M${cx + rx},${cy}A${rx},${ry} 0 0 0 ${cx},${cy + ry}A${rx},${ry} 0 0 0 ${cx - rx},${cy}` +
          `A${rx},${ry} 0 0 0 ${cx},${cy - ry}A${rx},${ry} 0 0 0 ${cx + rx},${cy}`,
      );
    }
    case "rect": {
      if (geometry.width <= 0 || geometry.height <= 0) return [];
      const { x, y, width, height } = geometry;
      const rx = geometry.rx ?? 0;
      const ry = geometry.ry ?? 0;
      if (rx <= 0 || ry <= 0) return equivalentClosedPath(`M${x},${y}H${x + width}V${y + height}H${x}V${y}`);
      return equivalentClosedPath(
        `M${x + rx},${y}H${x + width - rx}A${rx},${ry} 0 0 1 ${x + width},${y + ry}` +
          `V${y + height - ry}A${rx},${ry} 0 0 1 ${x + width - rx},${y + height}H${x + rx}` +
          `A${rx},${ry} 0 0 1 ${x},${y + height - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}`,
      );
    }
  }
}

function resolveSegmentDirections(subpaths: Subpath[]): void {
  for (const { segments } of subpaths) {
    const previousNonZero: Array<Segment | undefined> = [];
    let previous: Segment | undefined;
    for (const segment of segments) {
      previousNonZero.push(previous);
      if (segment.nonZero) previous = segment;
    }
    const nextNonZero: Array<Segment | undefined> = new Array(segments.length);
    let next: Segment | undefined;
    for (let index = segments.length - 1; index >= 0; index--) {
      nextNonZero[index] = next;
      if (segments[index]!.nonZero) next = segments[index];
    }

    for (const [index, segment] of segments.entries()) {
      if (segment.nonZero) {
        segment.startDirection = segment.rawStart ?? segment.rawEnd ?? { x: 1, y: 0 };
        segment.endDirection = segment.rawEnd ?? segment.rawStart ?? { x: 1, y: 0 };
        continue;
      }
      segment.startDirection = previousNonZero[index]?.endDirection ?? nextNonZero[index]?.rawStart ?? { x: 1, y: 0 };
      segment.endDirection = nextNonZero[index]?.startDirection ??
        nextNonZero[index]?.rawStart ??
        previousNonZero[index]?.rawEnd ?? { x: 1, y: 0 };
    }
  }
}

function directionAngle(direction: Point | undefined): number {
  return (Math.atan2(direction?.y ?? 0, direction?.x ?? 1) * 180) / Math.PI;
}

function bisectedAngle(incoming: Point | undefined, outgoing: Point | undefined): number {
  const before = normalized(incoming) ?? { x: 1, y: 0 };
  const after = normalized(outgoing) ?? { x: 1, y: 0 };
  const sum = { x: before.x + after.x, y: before.y + after.y };
  // At an exact 180-degree reversal the bisector sum is zero; SVG keeps the
  // incoming direction rather than selecting an arbitrary perpendicular.
  return directionAngle(Math.hypot(sum.x, sum.y) <= EPSILON ? before : sum);
}

/** Return every equivalent-path vertex and its spec-defined automatic marker orientation. */
export function markerVertices(geometry: Geometry): MarkerVertex[] {
  const subpaths = geometrySubpaths(geometry);
  resolveSegmentDirections(subpaths);
  return subpaths.flatMap((subpath) =>
    subpath.vertices.map((vertex, index) => {
      const first = index === 0;
      const last = index === subpath.vertices.length - 1;
      let angle: number;
      if (!subpath.closed && first) angle = directionAngle(subpath.segments[0]?.startDirection);
      else if (!subpath.closed && last)
        angle = directionAngle(subpath.segments[subpath.segments.length - 1]?.endDirection);
      else {
        const incoming = first
          ? subpath.segments[subpath.segments.length - 1]?.endDirection
          : subpath.segments[index - 1]?.endDirection;
        const outgoing = last ? subpath.segments[0]?.startDirection : subpath.segments[index]?.startDirection;
        angle = bisectedAngle(incoming, outgoing);
      }
      return { ...vertex, angle };
    }),
  );
}

export function orientedMarkerAngle(
  orient: MarkerOrient,
  kind: "start" | "mid" | "end",
  automaticAngle: number,
): number {
  if (orient.type === "angle") return orient.degrees;
  return automaticAngle + (orient.type === "auto-start-reverse" && kind === "start" ? 180 : 0);
}
