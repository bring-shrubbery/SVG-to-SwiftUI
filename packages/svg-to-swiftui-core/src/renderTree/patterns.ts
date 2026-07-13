import type { ElementNode } from "svg-parser";
import { lengthContext, type ParsedSVGLength, parseSVGLength, resolveSVGLength, SVGLengthError } from "../lengths";
import type { Presentation, StyleResolution, SVGStyleResolver } from "../styleCascade";
import { type AffineTransform, IDENTITY_TRANSFORM, multiplyTransforms, parseTransform } from "../transformUtils";
import { DEFAULT_PRESERVE_ASPECT_RATIO, parsePreserveAspectRatio, parseViewBox, viewBoxTransform } from "../viewports";
import { geometryBounds, shapePaintBounds } from "./bounds";
import type {
  InvalidPaintServer,
  PaintServer,
  PatternPaint,
  PatternUnits,
  RenderBounds,
  RenderDiagnostic,
  RenderNode,
  RenderShape,
  SourceLocation,
} from "./types";

export interface ResolvedPattern {
  type: "pattern";
  matrix: AffineTransform;
  tile: RenderBounds;
  contentTransform: AffineTransform;
  children: RenderNode[];
  minColumn: number;
  maxColumn: number;
  minRow: number;
  maxRow: number;
  clipTile: boolean;
}

export type ResolvedPatternPaint = ResolvedPattern | { type: "none" };

const DESCRIPTIVE_ELEMENTS = new Set(["desc", "metadata", "title"]);

function sourceLocation(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return {
    element: element.tagName ?? "unknown",
    ...(id === undefined ? {} : { id: String(id) }),
  };
}

function diagnostic(diagnostics: RenderDiagnostic[], element: ElementNode, code: string, message: string): void {
  diagnostics.push({
    code,
    message,
    severity: "warning",
    source: sourceLocation(element),
  });
}

function children(element: ElementNode): ElementNode[] {
  return element.children.filter(
    (child): child is ElementNode => typeof child !== "string" && child.type === "element",
  );
}

function containsPattern(element: ElementNode): boolean {
  return element.tagName === "pattern" || children(element).some(containsPattern);
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

function invalidServer(element: ElementNode): InvalidPaintServer {
  return {
    type: "invalid",
    id: String(element.properties?.id ?? ""),
    element: element.tagName ?? "unknown",
    source: sourceLocation(element),
  };
}

function property(chain: ElementNode[], name: string): unknown {
  for (const element of chain) {
    const value = element.properties?.[name];
    if (value !== undefined) return value;
  }
  return undefined;
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
    if (parsed.kind !== "length") throw new SVGLengthError("invalid-pattern-length", `${label} requires a length.`);
    return parsed;
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      error instanceof SVGLengthError ? error.code : "invalid-pattern-length",
      `Invalid ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return parseSVGLength(fallback) as ParsedSVGLength;
  }
}

function units(
  raw: unknown,
  fallback: PatternUnits,
  label: "patternUnits" | "patternContentUnits",
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): PatternUnits {
  const source = String(raw ?? fallback);
  if (source === "objectBoundingBox" || source === "userSpaceOnUse") return source;
  diagnostic(diagnostics, element, `invalid-${label}`, `Invalid ${label} '${source}'.`);
  return fallback;
}

/** Resolve typed pattern resources, including recursive per-attribute and shadow-content inheritance. */
export function resolvePatternPaintServers(
  root: ElementNode,
  paintElements: Map<string, ElementNode>,
  definitions: Map<string, ElementNode>,
  styleResolver: SVGStyleResolver,
  rootPresentation: Presentation,
  diagnostics: RenderDiagnostic[],
): Map<string, PaintServer> {
  const resolutions = new Map<ElementNode, StyleResolution>();
  const walk = (element: ElementNode, inherited: Presentation): void => {
    for (const child of children(element)) {
      if (!containsPattern(child)) continue;
      const resolved = styleResolver.resolve(child, inherited);
      resolutions.set(child, resolved);
      walk(child, resolved.values);
    }
  };
  walk(root, rootPresentation);

  const chains = new Map<string, ElementNode[] | undefined>();
  const chainFor = (id: string, stack: string[] = []): ElementNode[] | undefined => {
    if (chains.has(id)) return chains.get(id);
    const element = paintElements.get(id);
    if (!element || element.tagName !== "pattern") return undefined;
    if (stack.includes(id)) {
      const cycle = [...stack.slice(stack.indexOf(id)), id];
      diagnostic(
        diagnostics,
        element,
        "cyclic-pattern-reference",
        `Pattern reference cycle detected: ${cycle.map((item) => `#${item}`).join(" -> ")}.`,
      );
      for (const cycleId of cycle) chains.set(cycleId, undefined);
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
        "external-pattern-reference",
        "Only local pattern href references are supported.",
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
        "missing-pattern-template",
        `Pattern #${id} references missing template #${parentId}.`,
      );
      chains.set(id, undefined);
      return undefined;
    }
    if (referenced.tagName !== "pattern") {
      diagnostic(
        diagnostics,
        element,
        "wrong-pattern-template-type",
        `Pattern #${id} references <${referenced.tagName}> instead of a pattern.`,
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
    if (element.tagName !== "pattern") continue;
    const chain = chainFor(id);
    if (!chain) {
      result.set(id, invalidServer(element));
      continue;
    }

    const resolved = resolutions.get(element);
    const patternUnits = units(
      property(chain, "patternUnits"),
      "objectBoundingBox",
      "patternUnits",
      element,
      diagnostics,
    );
    const contentUnits = units(
      property(chain, "patternContentUnits"),
      "userSpaceOnUse",
      "patternContentUnits",
      element,
      diagnostics,
    );

    let transform = IDENTITY_TRANSFORM;
    const cssTransform = resolved?.provenance.transform ? resolved.values.transform : undefined;
    const transformSource = cssTransform ?? property(chain, "patternTransform");
    if (transformSource !== undefined) {
      try {
        transform = parseTransform(transformSource);
      } catch (error) {
        diagnostic(
          diagnostics,
          element,
          "invalid-pattern-transform",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    let viewBox: ReturnType<typeof parseViewBox>;
    const viewBoxSource = property(chain, "viewBox");
    if (viewBoxSource !== undefined) {
      try {
        viewBox = parseViewBox(viewBoxSource);
      } catch (error) {
        diagnostic(
          diagnostics,
          element,
          error instanceof SVGLengthError ? error.code : "invalid-pattern-viewbox",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    let preserveAspectRatio = DEFAULT_PRESERVE_ASPECT_RATIO;
    const aspectSource = property(chain, "preserveAspectRatio");
    if (aspectSource !== undefined) {
      try {
        preserveAspectRatio = parsePreserveAspectRatio(aspectSource);
      } catch (error) {
        diagnostic(
          diagnostics,
          element,
          error instanceof SVGLengthError ? error.code : "invalid-pattern-preserve-aspect-ratio",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const contentOwner = chain.find((candidate) =>
      children(candidate).some((child) => !DESCRIPTIVE_ELEMENTS.has(child.tagName ?? "")),
    );
    const width = parsedLength(property(chain, "width"), "0", "pattern width", element, diagnostics);
    const height = parsedLength(property(chain, "height"), "0", "pattern height", element, diagnostics);
    if (width.value < 0)
      diagnostic(diagnostics, element, "negative-pattern-width", "Pattern width cannot be negative.");
    if (height.value < 0)
      diagnostic(diagnostics, element, "negative-pattern-height", "Pattern height cannot be negative.");

    const authoredOverflow = resolved?.provenance.overflow ? resolved.values.overflow : "hidden";
    const paint: PatternPaint = {
      type: "pattern",
      id,
      x: parsedLength(property(chain, "x"), "0", "pattern x", element, diagnostics),
      y: parsedLength(property(chain, "y"), "0", "pattern y", element, diagnostics),
      width,
      height,
      units: patternUnits,
      contentUnits,
      transform,
      ...(viewBox ? { viewBox } : {}),
      preserveAspectRatio,
      overflow: String(authoredOverflow ?? "hidden").toLowerCase(),
      ...(href(element)?.startsWith("#") ? { href: href(element)!.slice(1) } : {}),
      source: sourceLocation(element),
      contentElements: contentOwner ? children(contentOwner) : [],
      children: [],
      instances: new Map(),
      presentation: resolved?.values ?? rootPresentation,
      invalid: false,
    };
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
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function localToRoot(shape: RenderShape, ancestors: AffineTransform[]): AffineTransform {
  return [...ancestors, shape.transform].reduce(
    (matrix, transform) => multiplyTransforms(matrix, transform),
    IDENTITY_TRANSFORM,
  );
}

function coordinate(
  value: ParsedSVGLength,
  axis: "horizontal" | "vertical",
  unitsValue: PatternUnits,
  shape: RenderShape,
): number {
  const viewport = unitsValue === "objectBoundingBox" ? { width: 1, height: 1 } : shape.paintContext.viewport;
  const resolved = resolveSVGLength(
    value,
    lengthContext(
      viewport,
      shape.paintContext.rootViewport,
      axis === "horizontal" ? "viewport-width" : "viewport-height",
      axis,
      shape.paintContext.fontMetrics,
    ),
  );
  return typeof resolved === "number" ? resolved : 0;
}

function transformedBounds(bounds: RenderBounds, matrix: AffineTransform): RenderBounds {
  const points = [
    point(matrix, bounds.x, bounds.y),
    point(matrix, bounds.x + bounds.width, bounds.y),
    point(matrix, bounds.x, bounds.y + bounds.height),
    point(matrix, bounds.x + bounds.width, bounds.y + bounds.height),
  ];
  const xs = points.map((item) => item.x);
  const ys = points.map((item) => item.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Resolve one pattern against the referencing shape and its current ancestor coordinate system. */
export function resolvePatternForShape(
  pattern: PatternPaint,
  shape: RenderShape,
  kind: "fill" | "stroke",
  ancestors: AffineTransform[] = [],
): ResolvedPatternPaint {
  if (pattern.invalid || pattern.contentElements.length === 0) return { type: "none" };
  const geometry = geometryBounds(shape.geometry);
  const paintBounds = shapePaintBounds(shape, kind);
  if (!geometry || !paintBounds || paintBounds.width === 0 || paintBounds.height === 0) return { type: "none" };
  const needsObjectBounds =
    pattern.units === "objectBoundingBox" || (!pattern.viewBox && pattern.contentUnits === "objectBoundingBox");
  if (needsObjectBounds && (geometry.width === 0 || geometry.height === 0)) return { type: "none" };

  const x = coordinate(pattern.x, "horizontal", pattern.units, shape);
  const y = coordinate(pattern.y, "vertical", pattern.units, shape);
  const width = coordinate(pattern.width, "horizontal", pattern.units, shape);
  const height = coordinate(pattern.height, "vertical", pattern.units, shape);
  if (width <= 0 || height <= 0 || pattern.viewBox?.width === 0 || pattern.viewBox?.height === 0)
    return { type: "none" };
  const tile = { x, y, width, height };

  const boundsMatrix: AffineTransform = {
    a: geometry.width,
    b: 0,
    c: 0,
    d: geometry.height,
    e: geometry.x,
    f: geometry.y,
  };
  const unitsMatrix = pattern.units === "objectBoundingBox" ? boundsMatrix : IDENTITY_TRANSFORM;
  const patternToLocal = multiplyTransforms(unitsMatrix, pattern.transform);
  const inversePattern = invert(patternToLocal);
  if (!inversePattern) return { type: "none" };

  // Pattern content starts at the tile origin. Convert only the relative scale
  // between patternContentUnits and patternUnits; bounding-box translations do
  // not move the content away from its tile.
  const patternScaleX = pattern.units === "objectBoundingBox" ? geometry.width : 1;
  const patternScaleY = pattern.units === "objectBoundingBox" ? geometry.height : 1;
  const contentScaleX = pattern.contentUnits === "objectBoundingBox" ? geometry.width : 1;
  const contentScaleY = pattern.contentUnits === "objectBoundingBox" ? geometry.height : 1;
  const contentTransform = pattern.viewBox
    ? viewBoxTransform(
        pattern.viewBox,
        { x: 0, y: 0, width: tile.width, height: tile.height },
        pattern.preserveAspectRatio,
      )
    : {
        a: contentScaleX / patternScaleX,
        b: 0,
        c: 0,
        d: contentScaleY / patternScaleY,
        e: 0,
        f: 0,
      };
  const covered = transformedBounds(paintBounds, inversePattern);
  const minColumn = Math.floor((covered.x - x) / width);
  const maxColumn = Math.ceil((covered.x + covered.width - x) / width) - 1;
  const minRow = Math.floor((covered.y - y) / height);
  const maxRow = Math.ceil((covered.y + covered.height - y) / height) - 1;
  if (maxColumn < minColumn || maxRow < minRow) return { type: "none" };

  return {
    type: "pattern",
    matrix: multiplyTransforms(localToRoot(shape, ancestors), patternToLocal),
    tile,
    contentTransform,
    children: pattern.instances.get(shape)?.children ?? pattern.children,
    minColumn,
    maxColumn,
    minRow,
    maxRow,
    clipTile: pattern.overflow !== "visible",
  };
}
