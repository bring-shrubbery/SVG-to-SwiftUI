import type { ElementNode } from "svg-parser";
import { parseOpacity, parseRGBAColor } from "../colorUtils";
import { lengthContext, type ParsedSVGLength, parseSVGLength, resolveSVGLength, SVGLengthError } from "../lengths";
import type { Presentation, SVGStyleResolver } from "../styleCascade";
import { type AffineTransform, IDENTITY_TRANSFORM, multiplyTransforms, parseTransform } from "../transformUtils";
import { geometryBounds } from "./bounds";
import type {
  GradientColorInterpolation,
  GradientPaint,
  GradientSpreadMethod,
  GradientStop,
  GradientUnits,
  InvalidPaintServer,
  PaintServer,
  RenderBounds,
  RenderDiagnostic,
  RenderShape,
  SourceLocation,
} from "./types";

export interface ResolvedLinearGradient {
  type: "linearGradient";
  matrix: AffineTransform;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  startT: number;
  endT: number;
  stops: GradientStop[];
  spreadMethod: GradientSpreadMethod;
  colorInterpolation: GradientColorInterpolation;
}

export interface ResolvedRadialGradient {
  type: "radialGradient";
  matrix: AffineTransform;
  cx: number;
  cy: number;
  r: number;
  fx: number;
  fy: number;
  fr: number;
  startT: number;
  endT: number;
  stops: GradientStop[];
  spreadMethod: GradientSpreadMethod;
  colorInterpolation: GradientColorInterpolation;
}

export type ResolvedGradient = ResolvedLinearGradient | ResolvedRadialGradient;
export type ResolvedGradientPaint = ResolvedGradient | { type: "solid"; stop: GradientStop } | { type: "none" };

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

function containsGradient(element: ElementNode): boolean {
  return (
    element.tagName === "linearGradient" ||
    element.tagName === "radialGradient" ||
    children(element).some(containsGradient)
  );
}

function href(element: ElementNode): string | undefined {
  const raw =
    element.properties?.href ??
    element.properties?.["xlink:href"] ??
    element.properties?.xlinkHref ??
    element.properties?.xLinkHref;
  if (raw === undefined || String(raw).trim() === "") return undefined;
  return String(raw).trim();
}

function invalidServer(element: ElementNode, type: InvalidPaintServer["type"]): InvalidPaintServer {
  return {
    type,
    id: String(element.properties?.id ?? ""),
    element: element.tagName ?? "unknown",
    source: sourceLocation(element),
  };
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
    if (parsed.kind !== "length") throw new SVGLengthError("invalid-gradient-length", `${label} requires a length.`);
    return parsed;
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      error instanceof SVGLengthError ? error.code : "invalid-gradient-length",
      `Invalid ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return parseSVGLength(fallback) as ParsedSVGLength;
  }
}

function stopOffset(raw: unknown, previous: number, element: ElementNode, diagnostics: RenderDiagnostic[]): number {
  const source = String(raw ?? 0).trim();
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(%)?$/.exec(source);
  if (!match) {
    diagnostic(diagnostics, element, "invalid-stop-offset", `Invalid gradient stop offset '${source}'.`);
    return previous;
  }
  const numeric = Number(match[1]);
  const normalized = match[2] ? numeric / 100 : numeric;
  return Math.max(previous, Math.min(1, Math.max(0, normalized)));
}

function stopsFor(
  element: ElementNode,
  presentations: Map<ElementNode, Presentation>,
  diagnostics: RenderDiagnostic[],
): GradientStop[] {
  const result: GradientStop[] = [];
  let previous = 0;
  for (const stop of children(element).filter((child) => child.tagName === "stop")) {
    const style = presentations.get(stop) ?? {};
    const offset = stopOffset(stop.properties?.offset, previous, stop, diagnostics);
    previous = offset;
    const colorSource = String(style["stop-color"] ?? "black");
    const parsed = parseRGBAColor(colorSource);
    if (!parsed) {
      diagnostic(diagnostics, stop, "invalid-stop-color", `Unsupported gradient stop color '${colorSource}'.`);
    }
    const opacitySource = String(style["stop-opacity"] ?? 1).trim();
    if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?%?$/.test(opacitySource)) {
      diagnostic(diagnostics, stop, "invalid-stop-opacity", `Invalid stop-opacity '${opacitySource}'.`);
    }
    const color = parsed ?? { red: 0, green: 0, blue: 0, alpha: 1 };
    result.push({
      offset,
      color: { ...color, alpha: color.alpha * parseOpacity(opacitySource) },
      source: sourceLocation(stop),
    });
  }
  return result;
}

function property(chain: ElementNode[], name: string): unknown {
  for (const element of chain) {
    const value = element.properties?.[name];
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Resolve typed gradient resources, including href attribute and stop inheritance. */
export function resolvePaintServers(
  root: ElementNode,
  paintElements: Map<string, ElementNode>,
  definitions: Map<string, ElementNode>,
  styleResolver: SVGStyleResolver,
  rootPresentation: Presentation,
  diagnostics: RenderDiagnostic[],
): Map<string, PaintServer> {
  const presentations = new Map<ElementNode, Presentation>();

  const walk = (element: ElementNode, inherited: Presentation): void => {
    for (const child of children(element)) {
      const isStop = child.tagName === "stop" && ["linearGradient", "radialGradient"].includes(element.tagName ?? "");
      if (!containsGradient(child) && !isStop) continue;
      const resolved = styleResolver.resolve(child, inherited);
      presentations.set(child, resolved.values);
      if (!isStop) walk(child, resolved.values);
    }
  };
  walk(root, rootPresentation);

  const chains = new Map<string, ElementNode[] | undefined>();
  const chainFor = (id: string, stack: string[] = []): ElementNode[] | undefined => {
    if (chains.has(id)) return chains.get(id);
    const element = paintElements.get(id);
    if (!element || !["linearGradient", "radialGradient"].includes(element.tagName ?? "")) return undefined;
    if (stack.includes(id)) {
      diagnostic(
        diagnostics,
        element,
        "cyclic-gradient-reference",
        `Gradient reference cycle detected: ${[...stack.slice(stack.indexOf(id)), id].map((item) => `#${item}`).join(" -> ")}.`,
      );
      for (const cycleId of stack.slice(stack.indexOf(id))) chains.set(cycleId, undefined);
      chains.set(id, undefined);
      return undefined;
    }
    const reference = href(element);
    if (!reference) {
      const chain = [element];
      chains.set(id, chain);
      return chain;
    }
    if (!reference.startsWith("#")) {
      diagnostic(
        diagnostics,
        element,
        "external-gradient-reference",
        `Only local gradient href references are supported.`,
      );
      chains.set(id, undefined);
      return undefined;
    }
    const parentId = reference.slice(1);
    const referenced = definitions.get(parentId);
    if (!referenced) {
      diagnostic(
        diagnostics,
        element,
        "missing-gradient-template",
        `Gradient #${id} references missing template #${parentId}.`,
      );
      chains.set(id, undefined);
      return undefined;
    }
    if (!["linearGradient", "radialGradient"].includes(referenced.tagName ?? "")) {
      diagnostic(
        diagnostics,
        element,
        "wrong-gradient-template-type",
        `Gradient #${id} references <${referenced.tagName}> instead of a gradient.`,
      );
      chains.set(id, undefined);
      return undefined;
    }
    const parent = chainFor(parentId, [...stack, id]);
    if (!parent) {
      chains.set(id, undefined);
      return undefined;
    }
    const chain = [element, ...parent];
    chains.set(id, chain);
    return chain;
  };

  const result = new Map<string, PaintServer>();
  for (const [id, element] of paintElements) {
    if (element.tagName === "pattern") {
      result.set(id, invalidServer(element, "unsupported"));
      continue;
    }
    const chain = chainFor(id);
    if (!chain) {
      result.set(id, invalidServer(element, "invalid"));
      continue;
    }

    const unitsSource = String(property(chain, "gradientUnits") ?? "objectBoundingBox");
    const units: GradientUnits = unitsSource === "userSpaceOnUse" ? "userSpaceOnUse" : "objectBoundingBox";
    if (!["userSpaceOnUse", "objectBoundingBox"].includes(unitsSource)) {
      diagnostic(diagnostics, element, "invalid-gradient-units", `Invalid gradientUnits '${unitsSource}'.`);
    }

    const spreadSource = String(property(chain, "spreadMethod") ?? "pad").toLowerCase();
    const spreadMethod: GradientSpreadMethod = ["pad", "reflect", "repeat"].includes(spreadSource)
      ? (spreadSource as GradientSpreadMethod)
      : "pad";
    if (spreadMethod !== spreadSource) {
      diagnostic(diagnostics, element, "invalid-gradient-spread", `Invalid spreadMethod '${spreadSource}'.`);
    }

    let transform = IDENTITY_TRANSFORM;
    const transformSource = property(chain, "gradientTransform");
    if (transformSource !== undefined) {
      try {
        transform = parseTransform(transformSource);
      } catch (error) {
        diagnostic(
          diagnostics,
          element,
          "invalid-gradient-transform",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const interpolationSource = String(presentations.get(element)?.["color-interpolation"] ?? "sRGB");
    const colorInterpolation: GradientColorInterpolation =
      interpolationSource.toLowerCase() === "linearrgb" ? "linearRGB" : "sRGB";
    if (!["srgb", "linearrgb", "auto"].includes(interpolationSource.toLowerCase())) {
      diagnostic(
        diagnostics,
        element,
        "invalid-color-interpolation",
        `Invalid color-interpolation '${interpolationSource}'.`,
      );
    }

    const stopOwner = chain.find((candidate) => children(candidate).some((child) => child.tagName === "stop"));
    const stops = stopOwner ? stopsFor(stopOwner, presentations, diagnostics) : [];
    const base = {
      id,
      units,
      transform,
      spreadMethod,
      stops,
      colorInterpolation,
      ...(href(element)?.startsWith("#") ? { href: href(element)!.slice(1) } : {}),
      source: sourceLocation(element),
    };

    let paint: GradientPaint;
    if (element.tagName === "linearGradient") {
      paint = {
        ...base,
        type: "linearGradient",
        x1: parsedLength(property(chain, "x1"), "0%", "linear gradient x1", element, diagnostics),
        y1: parsedLength(property(chain, "y1"), "0%", "linear gradient y1", element, diagnostics),
        x2: parsedLength(property(chain, "x2"), "100%", "linear gradient x2", element, diagnostics),
        y2: parsedLength(property(chain, "y2"), "0%", "linear gradient y2", element, diagnostics),
      };
    } else {
      const cx = parsedLength(property(chain, "cx"), "50%", "radial gradient cx", element, diagnostics);
      const cy = parsedLength(property(chain, "cy"), "50%", "radial gradient cy", element, diagnostics);
      const r = parsedLength(property(chain, "r"), "50%", "radial gradient r", element, diagnostics);
      const fxSource = property(chain, "fx");
      const fySource = property(chain, "fy");
      const fr = parsedLength(property(chain, "fr"), "0%", "radial gradient fr", element, diagnostics);
      if (r.value < 0)
        diagnostic(diagnostics, element, "negative-gradient-radius", "Radial gradient r cannot be negative.");
      if (fr.value < 0)
        diagnostic(diagnostics, element, "negative-gradient-focal-radius", "Radial gradient fr cannot be negative.");
      paint = {
        ...base,
        type: "radialGradient",
        cx,
        cy,
        r: r.value < 0 ? { ...r, value: 0 } : r,
        fx: fxSource === undefined ? cx : parsedLength(fxSource, "50%", "radial gradient fx", element, diagnostics),
        fy: fySource === undefined ? cy : parsedLength(fySource, "50%", "radial gradient fy", element, diagnostics),
        fr: fr.value < 0 ? { ...fr, value: 0 } : fr,
      };
    }
    result.set(id, paint);
  }
  return result;
}

function invert(matrix: AffineTransform): AffineTransform | undefined {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) < 1e-12) return undefined;
  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  };
}

function point(matrix: AffineTransform, x: number, y: number): { x: number; y: number } {
  return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
}

function boundsPoints(bounds: RenderBounds): Array<{ x: number; y: number }> {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: centerX, y: bounds.y },
    { x: centerX, y: bounds.y + bounds.height },
    { x: bounds.x, y: centerY },
    { x: bounds.x + bounds.width, y: centerY },
  ];
}

function localToRoot(shape: RenderShape, ancestors: AffineTransform[]): AffineTransform {
  return [...ancestors, shape.transform].reduce(
    (matrix, transform) => multiplyTransforms(matrix, transform),
    IDENTITY_TRANSFORM,
  );
}

function resolveCoordinate(
  value: ParsedSVGLength,
  axis: "horizontal" | "vertical" | "other",
  units: GradientUnits,
  shape: RenderShape,
): number {
  const viewport = units === "objectBoundingBox" ? { width: 1, height: 1 } : shape.paintContext.viewport;
  const percentageBasis =
    axis === "horizontal" ? "viewport-width" : axis === "vertical" ? "viewport-height" : "viewport-diagonal";
  const resolved = resolveSVGLength(
    value,
    lengthContext(viewport, shape.paintContext.rootViewport, percentageBasis, axis, shape.paintContext.fontMetrics),
  );
  return typeof resolved === "number" ? resolved : 0;
}

function spreadRange(values: number[], spreadMethod: GradientSpreadMethod): { startT: number; endT: number } {
  if (spreadMethod === "pad") return { startT: 0, endT: 1 };
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return { startT: Math.floor(Math.min(0, minimum)), endT: Math.ceil(Math.max(1, maximum)) };
}

function radialParameter(
  x: number,
  y: number,
  fx: number,
  fy: number,
  fr: number,
  cx: number,
  cy: number,
  r: number,
): number | undefined {
  const centerX = cx - fx;
  const centerY = cy - fy;
  const radius = r - fr;
  const px = x - fx;
  const py = y - fy;
  const a = centerX * centerX + centerY * centerY - radius * radius;
  const b = -2 * (px * centerX + py * centerY + fr * radius);
  const c = px * px + py * py - fr * fr;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return undefined;
    const value = -c / b;
    return value >= 0 ? value : undefined;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return undefined;
  const root = Math.sqrt(discriminant);
  const values = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((value) => value >= 0);
  return values.length > 0 ? Math.max(...values) : undefined;
}

/** Resolve one typed gradient against a specific shape's pre-paint bounds and coordinate context. */
export function resolveGradientForShape(
  gradient: GradientPaint,
  shape: RenderShape,
  ancestors: AffineTransform[] = [],
): ResolvedGradientPaint {
  if (gradient.stops.length === 0) return { type: "none" };
  const bounds = geometryBounds(shape.geometry);
  if (!bounds) return { type: "none" };
  if (gradient.units === "objectBoundingBox" && (bounds.width === 0 || bounds.height === 0)) return { type: "none" };

  const unitsMatrix: AffineTransform =
    gradient.units === "objectBoundingBox"
      ? { a: bounds.width, b: 0, c: 0, d: bounds.height, e: bounds.x, f: bounds.y }
      : IDENTITY_TRANSFORM;
  const gradientToLocal = multiplyTransforms(unitsMatrix, gradient.transform);
  const matrix = multiplyTransforms(localToRoot(shape, ancestors), gradientToLocal);
  const localToGradient = invert(gradientToLocal);
  if (!localToGradient) return { type: "none" };
  const targetPoints = boundsPoints(bounds).map((item) => point(localToGradient, item.x, item.y));

  if (gradient.type === "linearGradient") {
    const x1 = resolveCoordinate(gradient.x1, "horizontal", gradient.units, shape);
    const y1 = resolveCoordinate(gradient.y1, "vertical", gradient.units, shape);
    const x2 = resolveCoordinate(gradient.x2, "horizontal", gradient.units, shape);
    const y2 = resolveCoordinate(gradient.y2, "vertical", gradient.units, shape);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 1e-18) return { type: "solid", stop: gradient.stops[gradient.stops.length - 1]! };
    const parameters = targetPoints.map((item) => ((item.x - x1) * dx + (item.y - y1) * dy) / lengthSquared);
    return {
      type: "linearGradient",
      matrix,
      x1,
      y1,
      x2,
      y2,
      ...spreadRange(parameters, gradient.spreadMethod),
      stops: gradient.stops,
      spreadMethod: gradient.spreadMethod,
      colorInterpolation: gradient.colorInterpolation,
    };
  }

  const cx = resolveCoordinate(gradient.cx, "horizontal", gradient.units, shape);
  const cy = resolveCoordinate(gradient.cy, "vertical", gradient.units, shape);
  const r = resolveCoordinate(gradient.r, "other", gradient.units, shape);
  const fx = resolveCoordinate(gradient.fx, "horizontal", gradient.units, shape);
  const fy = resolveCoordinate(gradient.fy, "vertical", gradient.units, shape);
  const fr = resolveCoordinate(gradient.fr, "other", gradient.units, shape);
  if (r === fr && cx === fx && cy === fy) return { type: "none" };
  const parameters = targetPoints
    .map((item) => radialParameter(item.x, item.y, fx, fy, fr, cx, cy, r))
    .filter((value): value is number => value !== undefined);
  const range =
    gradient.spreadMethod === "pad"
      ? { startT: 0, endT: 1 }
      : { startT: 0, endT: Math.max(1, Math.ceil(parameters.length > 0 ? Math.max(...parameters) : 64)) };
  return {
    type: "radialGradient",
    matrix,
    cx,
    cy,
    r,
    fx,
    fy,
    fr,
    ...range,
    stops: gradient.stops,
    spreadMethod: gradient.spreadMethod,
    colorInterpolation: gradient.colorInterpolation,
  };
}
