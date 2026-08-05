import type { ElementNode } from "svg-parser";
import { parseSVGLength, resolveSVGLength } from "../lengths";
import type { AnimationValueContext } from "./animationValues";
import { measureGeometryPath } from "./pathMetrics";
import type { Geometry, RenderDiagnostic, RenderTextPathPoint, SourceLocation } from "./types";

export type MotionRotate = { type: "auto"; reverse: boolean } | { type: "angle"; degrees: number };

export interface MotionDefinition {
  points: readonly RenderTextPathPoint[];
  keyDistances: readonly number[];
  length: number;
  authoredLength?: number;
  rotate: MotionRotate;
  source: "mpath" | "path" | "points";
  referenceChain?: readonly string[];
}

const GEOMETRY_TAGS = new Set(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);

function property(element: ElementNode, name: string): string | undefined {
  const value = element.properties?.[name];
  return value === undefined || value === null ? undefined : String(value).trim();
}

function source(element: ElementNode): SourceLocation {
  const id = property(element, "id");
  return { element: element.tagName ?? "unknown", ...(id ? { id } : {}) };
}

function warning(
  element: ElementNode,
  code: string,
  message: string,
  attribute?: string,
  chain?: readonly string[],
): RenderDiagnostic {
  return {
    code,
    message,
    severity: "warning",
    source: source(element),
    ...(attribute ? { attribute } : {}),
    ...(chain ? { referenceChain: chain } : {}),
  };
}

function coordinate(raw: string, axis: "horizontal" | "vertical", context: AnimationValueContext): number | undefined {
  try {
    const value = parseSVGLength(raw);
    const resolved = resolveSVGLength(value, {
      ...context.length,
      axis,
      percentageBasis: axis === "horizontal" ? "viewport-width" : "viewport-height",
    });
    return typeof resolved === "number" && Number.isFinite(resolved) ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function pair(raw: string, context: AnimationValueContext): { x: number; y: number } | undefined {
  const normalized = raw
    .trim()
    .replace(/^\(\s*/, "")
    .replace(/\s*\)$/, "");
  const tokens = normalized.split(/(?:\s*,\s*|\s+)/).filter(Boolean);
  if (tokens.length !== 2) return undefined;
  const x = coordinate(tokens[0]!, "horizontal", context);
  const y = coordinate(tokens[1]!, "vertical", context);
  return x === undefined || y === undefined ? undefined : { x, y };
}

function rawLength(
  element: ElementNode,
  name: string,
  axis: "horizontal" | "vertical",
  context: AnimationValueContext,
  fallback = 0,
): number | undefined {
  const value = property(element, name);
  return value === undefined ? fallback : coordinate(value, axis, context);
}

function geometryFor(element: ElementNode, context: AnimationValueContext): Geometry | undefined {
  const pathLength = property(element, "pathLength");
  const calibrated = pathLength === undefined ? {} : { pathLength };
  switch ((element.tagName ?? "").toLowerCase()) {
    case "path":
      return { type: "path", d: property(element, "d") ?? "", ...calibrated };
    case "line": {
      const x1 = rawLength(element, "x1", "horizontal", context);
      const y1 = rawLength(element, "y1", "vertical", context);
      const x2 = rawLength(element, "x2", "horizontal", context);
      const y2 = rawLength(element, "y2", "vertical", context);
      return x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined
        ? undefined
        : { type: "line", x1, y1, x2, y2, ...calibrated };
    }
    case "circle": {
      const cx = rawLength(element, "cx", "horizontal", context);
      const cy = rawLength(element, "cy", "vertical", context);
      const r = rawLength(element, "r", "horizontal", context);
      return cx === undefined || cy === undefined || r === undefined || r < 0
        ? undefined
        : { type: "circle", cx, cy, r, ...calibrated };
    }
    case "ellipse": {
      const cx = rawLength(element, "cx", "horizontal", context);
      const cy = rawLength(element, "cy", "vertical", context);
      const rx = rawLength(element, "rx", "horizontal", context);
      const ry = rawLength(element, "ry", "vertical", context);
      return cx === undefined || cy === undefined || rx === undefined || ry === undefined || rx < 0 || ry < 0
        ? undefined
        : { type: "ellipse", cx, cy, rx, ry, ...calibrated };
    }
    case "rect": {
      const x = rawLength(element, "x", "horizontal", context);
      const y = rawLength(element, "y", "vertical", context);
      const width = rawLength(element, "width", "horizontal", context);
      const height = rawLength(element, "height", "vertical", context);
      const rx = property(element, "rx") === undefined ? undefined : rawLength(element, "rx", "horizontal", context);
      const ry = property(element, "ry") === undefined ? undefined : rawLength(element, "ry", "vertical", context);
      return x === undefined ||
        y === undefined ||
        width === undefined ||
        height === undefined ||
        width < 0 ||
        height < 0
        ? undefined
        : {
            type: "rect",
            x,
            y,
            width,
            height,
            ...(rx === undefined ? {} : { rx }),
            ...(ry === undefined ? {} : { ry }),
            ...calibrated,
          };
    }
    case "polyline":
    case "polygon":
      return {
        type: element.tagName!.toLowerCase() as "polyline" | "polygon",
        points: property(element, "points") ?? "",
        ...calibrated,
      };
    default:
      return undefined;
  }
}

function parseRotate(raw: string | undefined): MotionRotate | undefined {
  if (raw === undefined || raw === "") return { type: "angle", degrees: 0 };
  if (raw === "auto") return { type: "auto", reverse: false };
  if (raw === "auto-reverse") return { type: "auto", reverse: true };
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i.exec(raw);
  if (!match) return undefined;
  const value = Number(match[1]);
  const degrees =
    match[2]?.toLowerCase() === "rad"
      ? (value * 180) / Math.PI
      : match[2]?.toLowerCase() === "grad"
        ? value * 0.9
        : match[2]?.toLowerCase() === "turn"
          ? value * 360
          : value;
  return Number.isFinite(degrees) ? { type: "angle", degrees } : undefined;
}

function pointsGeometry(element: ElementNode, context: AnimationValueContext): Geometry | undefined {
  const values = property(element, "values")
    ?.split(";")
    .map((item) => pair(item, context));
  let points: Array<{ x: number; y: number }> | undefined;
  if (values) {
    if (values.some((item) => item === undefined)) return undefined;
    points = values as Array<{ x: number; y: number }>;
  } else {
    const from = property(element, "from") === undefined ? undefined : pair(property(element, "from")!, context);
    const to = property(element, "to") === undefined ? undefined : pair(property(element, "to")!, context);
    const by = property(element, "by") === undefined ? undefined : pair(property(element, "by")!, context);
    if (
      (property(element, "from") !== undefined && !from) ||
      (property(element, "to") !== undefined && !to) ||
      (property(element, "by") !== undefined && !by)
    )
      return undefined;
    if (from && to) points = [from, to];
    else if (from && by) points = [from, { x: from.x + by.x, y: from.y + by.y }];
    else if (to) points = [{ x: 0, y: 0 }, to];
    else if (by) points = [{ x: 0, y: 0 }, by];
  }
  if (!points || points.length === 0) return undefined;
  return { type: "polyline", points: points.map(({ x, y }) => `${x},${y}`).join(" ") };
}

export function parseMotionDefinition(
  element: ElementNode,
  definitions: ReadonlyMap<string, ElementNode>,
  duplicateIds: ReadonlySet<string>,
  context: AnimationValueContext,
): { motion?: MotionDefinition; diagnostics: RenderDiagnostic[] } {
  const diagnostics: RenderDiagnostic[] = [];
  const rotate = parseRotate(property(element, "rotate"));
  if (!rotate)
    diagnostics.push(
      warning(
        element,
        "invalid-animation-motion-rotate",
        `Invalid animateMotion rotate value '${property(element, "rotate")}'.`,
        "rotate",
      ),
    );
  const origin = property(element, "origin");
  if (origin !== undefined && origin !== "default")
    diagnostics.push(
      warning(
        element,
        "unsupported-animation-motion-origin",
        `SVG only defines origin="default"; '${origin}' is a host/CSS interpretation and is ignored.`,
        "origin",
      ),
    );

  let geometry: Geometry | undefined;
  let motionSource: MotionDefinition["source"] = "points";
  let referenceChain: string[] | undefined;
  const mpath = element.children.find(
    (child): child is ElementNode =>
      typeof child !== "string" && child.type === "element" && child.tagName?.toLowerCase() === "mpath",
  );
  if (mpath) {
    motionSource = "mpath";
    const visited = new Set<string>();
    referenceChain = [];
    let cursor: ElementNode | undefined = mpath;
    while (cursor?.tagName?.toLowerCase() === "mpath") {
      const href = property(cursor, "href") ?? property(cursor, "xlink:href");
      const match = href ? /^#([^\s]+)$/.exec(href) : undefined;
      if (!href || !match) {
        diagnostics.push(
          warning(
            element,
            href ? "external-animation-motion-path" : "missing-animation-motion-path-reference",
            href ? `mpath reference '${href}' must be a local #id.` : "mpath requires href or xlink:href.",
            "href",
            referenceChain,
          ),
        );
        cursor = undefined;
        break;
      }
      const id = match[1]!;
      referenceChain.push(`#${id}`);
      if (visited.has(id)) {
        diagnostics.push(
          warning(
            element,
            "cyclic-animation-motion-path-reference",
            `Cyclic mpath reference: ${referenceChain.join(" -> ")}.`,
            "href",
            referenceChain,
          ),
        );
        cursor = undefined;
        break;
      }
      visited.add(id);
      if (duplicateIds.has(id)) {
        diagnostics.push(
          warning(
            element,
            "duplicate-animation-motion-path-id",
            `mpath reference #${id} is ambiguous.`,
            "href",
            referenceChain,
          ),
        );
        cursor = undefined;
        break;
      }
      cursor = definitions.get(id);
      if (!cursor) {
        diagnostics.push(
          warning(
            element,
            "missing-animation-motion-path-target",
            `mpath references missing element #${id}.`,
            "href",
            referenceChain,
          ),
        );
        break;
      }
    }
    if (cursor && !GEOMETRY_TAGS.has(cursor.tagName?.toLowerCase() ?? ""))
      diagnostics.push(
        warning(
          element,
          "invalid-animation-motion-path-target",
          `mpath target <${cursor.tagName}> is not a geometry element.`,
          "href",
          referenceChain,
        ),
      );
    else if (cursor) geometry = geometryFor(cursor, context);
  } else if (property(element, "path") !== undefined) {
    motionSource = "path";
    geometry = { type: "path", d: property(element, "path")! };
  } else geometry = pointsGeometry(element, context);

  if (!geometry) {
    if (diagnostics.length === 0)
      diagnostics.push(
        warning(
          element,
          "missing-animation-motion-values",
          "animateMotion requires mpath, path, values, from/to, from/by, to, or by.",
        ),
      );
    return { diagnostics };
  }
  try {
    const metrics = measureGeometryPath(geometry);
    if (metrics.points.length === 0 || metrics.length <= 1e-12) {
      diagnostics.push(
        warning(
          element,
          "empty-animation-motion-path",
          "The resolved motion path has zero length; the animation has no effect.",
        ),
      );
      return { diagnostics };
    }
    return {
      motion: {
        points: metrics.points,
        keyDistances: metrics.keyDistances,
        length: metrics.length,
        ...(metrics.authoredLength ? { authoredLength: metrics.authoredLength } : {}),
        rotate: rotate ?? { type: "angle", degrees: 0 },
        source: motionSource,
        ...(referenceChain ? { referenceChain } : {}),
      },
      diagnostics,
    };
  } catch (error) {
    diagnostics.push(
      warning(
        element,
        "invalid-animation-motion-path",
        `Invalid motion path: ${error instanceof Error ? error.message : String(error)}.`,
        motionSource === "path" ? "path" : "href",
        referenceChain,
      ),
    );
    return { diagnostics };
  }
}
