import type { ElementNode } from "svg-parser";
import { parseOpacity, parseRGBAColor, type RGBAColor } from "../colorUtils";
import {
  lengthContext,
  type ParsedSVGLength,
  parsePlainNumber,
  parseSVGLength,
  resolveSVGLength,
  SVGLengthError,
} from "../lengths";
import type { Presentation, StyleResolution, SVGStyleResolver } from "../styleCascade";
import { objectBoundingBox } from "./bounds";
import type {
  FilterColorInterpolation,
  FilterInput,
  FilterInstance,
  FilterPrimitive,
  FilterPrimitiveRegionSpec,
  FilterPrimitiveSpec,
  FilterResource,
  FilterUnits,
  Paint,
  RenderBounds,
  RenderDiagnostic,
  RenderNode,
  SourceLocation,
} from "./types";

const CLEAR: RGBAColor = { red: 0, green: 0, blue: 0, alpha: 0 };
const RESERVED_INPUTS: Readonly<Record<string, FilterInput["type"]>> = {
  SourceGraphic: "sourceGraphic",
  SourceAlpha: "sourceAlpha",
  BackgroundImage: "backgroundImage",
  BackgroundAlpha: "backgroundAlpha",
  FillPaint: "fillPaint",
  StrokePaint: "strokePaint",
};

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

function containsFilter(element: ElementNode): boolean {
  return element.tagName?.toLowerCase() === "filter" || children(element).some(containsFilter);
}

function hasAttribute(element: ElementNode, name: string): boolean {
  return Object.keys(element.properties ?? {}).some((key) => key.toLowerCase() === name.toLowerCase());
}

function attribute(element: ElementNode, name: string): unknown {
  return Object.entries(element.properties ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
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
    if (parsed.kind !== "length") throw new SVGLengthError("invalid-filter-length", `${label} requires a length.`);
    return parsed;
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      error instanceof SVGLengthError ? error.code : "invalid-filter-length",
      `Invalid ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return parseSVGLength(fallback) as ParsedSVGLength;
  }
}

function optionalLength(
  element: ElementNode,
  name: "x" | "y" | "width" | "height",
  diagnostics: RenderDiagnostic[],
): ParsedSVGLength | undefined {
  if (!hasAttribute(element, name)) return undefined;
  return parsedLength(
    attribute(element, name),
    name === "width" || name === "height" ? "100%" : "0%",
    name,
    element,
    diagnostics,
  );
}

function units(
  raw: unknown,
  fallback: FilterUnits,
  label: "filterUnits" | "primitiveUnits",
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): FilterUnits {
  const value = String(raw ?? fallback).trim();
  if (value === "objectBoundingBox" || value === "userSpaceOnUse") return value;
  diagnostic(diagnostics, element, `invalid-${label}`, `Invalid ${label} '${value}'.`);
  return fallback;
}

function colorInterpolation(
  raw: unknown,
  element: ElementNode,
  diagnostics: RenderDiagnostic[],
): FilterColorInterpolation {
  const value = String(raw ?? "linearRGB").trim();
  if (value === "sRGB" || value === "linearRGB") return value;
  if (value === "auto") return "linearRGB";
  diagnostic(
    diagnostics,
    element,
    "invalid-color-interpolation-filters",
    `Invalid color-interpolation-filters '${value}'; using linearRGB.`,
  );
  return "linearRGB";
}

function numberValue(element: ElementNode, name: string, fallback: number, diagnostics: RenderDiagnostic[]): number {
  const raw = attribute(element, name);
  if (raw === undefined || String(raw).trim() === "") return fallback;
  try {
    return parsePlainNumber(raw, name);
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      `invalid-filter-${name.toLowerCase()}`,
      error instanceof Error ? error.message : String(error),
    );
    return fallback;
  }
}

function numberPair(
  element: ElementNode,
  name: string,
  fallback: number,
  diagnostics: RenderDiagnostic[],
): [number, number] {
  const raw = attribute(element, name);
  if (raw === undefined || String(raw).trim() === "") return [fallback, fallback];
  const tokens = String(raw).trim().split(/\s+/);
  if (tokens.length < 1 || tokens.length > 2) {
    diagnostic(diagnostics, element, `invalid-filter-${name.toLowerCase()}`, `${name} requires one or two numbers.`);
    return [fallback, fallback];
  }
  try {
    const first = parsePlainNumber(tokens[0], name);
    const second = tokens.length === 2 ? parsePlainNumber(tokens[1], name) : first;
    if (first < 0 || second < 0) {
      diagnostic(diagnostics, element, `negative-filter-${name.toLowerCase()}`, `${name} cannot be negative.`);
      return [0, 0];
    }
    return [first, second];
  } catch (error) {
    diagnostic(
      diagnostics,
      element,
      `invalid-filter-${name.toLowerCase()}`,
      error instanceof Error ? error.message : String(error),
    );
    return [fallback, fallback];
  }
}

function regionSpec(element: ElementNode, diagnostics: RenderDiagnostic[]): FilterPrimitiveRegionSpec {
  const x = optionalLength(element, "x", diagnostics);
  const y = optionalLength(element, "y", diagnostics);
  const width = optionalLength(element, "width", diagnostics);
  const height = optionalLength(element, "height", diagnostics);
  return {
    ...(x ? { x } : {}),
    ...(y ? { y } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

function floodColor(element: ElementNode, presentation: Presentation, diagnostics: RenderDiagnostic[]): RGBAColor {
  const rawColor = String(presentation["flood-color"] ?? "black").trim();
  const colorSource = rawColor.toLowerCase() === "currentcolor" ? String(presentation.color ?? "black") : rawColor;
  const parsed = parseRGBAColor(colorSource);
  if (!parsed) {
    diagnostic(diagnostics, element, "invalid-flood-color", `Invalid flood-color '${rawColor}'; using black.`);
  }
  const color = parsed ?? { red: 0, green: 0, blue: 0, alpha: 1 };
  const rawOpacity = presentation["flood-opacity"] ?? 1;
  const opacitySource = String(rawOpacity).trim();
  if (
    opacitySource === "" ||
    !Number.isFinite(Number(opacitySource.endsWith("%") ? opacitySource.slice(0, -1) : opacitySource))
  ) {
    diagnostic(diagnostics, element, "invalid-flood-opacity", `Invalid flood-opacity '${opacitySource}'; using 1.`);
  }
  return { ...color, alpha: color.alpha * parseOpacity(rawOpacity) };
}

function localHref(element: ElementNode, diagnostics: RenderDiagnostic[]): string | undefined {
  const raw = attribute(element, "href") ?? attribute(element, "xlink:href");
  if (raw === undefined || String(raw).trim() === "") return undefined;
  const value = String(raw).trim();
  const match = /^#([^\s]+)$/.exec(value);
  if (match) return match[1];
  diagnostic(
    diagnostics,
    element,
    "external-filter-href",
    `Only local filter href references are supported; received '${value}'.`,
  );
  return undefined;
}

function buildPrimitiveSpecs(
  filter: ElementNode,
  filterPresentation: Presentation,
  styleResolver: SVGStyleResolver,
  diagnostics: RenderDiagnostic[],
): FilterPrimitiveSpec[] {
  const specs: FilterPrimitiveSpec[] = [];
  const named = new Map<string, number>();
  const previousInput = (): FilterInput =>
    specs.length === 0 ? { type: "sourceGraphic" } : { type: "result", index: specs.length - 1 };
  const resolveInput = (element: ElementNode, raw: unknown): FilterInput => {
    if (raw === undefined || String(raw).trim() === "") return previousInput();
    const value = String(raw).trim();
    const reserved = RESERVED_INPUTS[value];
    if (reserved) {
      if (reserved === "backgroundImage" || reserved === "backgroundAlpha")
        diagnostic(
          diagnostics,
          element,
          "unsupported-filter-background-input",
          `${value} is unavailable in the current static compositing context and resolves to transparent black.`,
        );
      return { type: reserved } as FilterInput;
    }
    const index = named.get(value);
    if (index !== undefined) return { type: "result", index };
    diagnostic(
      diagnostics,
      element,
      "unknown-filter-input",
      `Filter input '${value}' does not name a preceding result; using the default input.`,
    );
    return previousInput();
  };

  for (const element of children(filter)) {
    const tag = (element.tagName ?? "").toLowerCase();
    if (["title", "desc", "metadata", "script", "animate", "set"].includes(tag)) continue;
    if (!tag.startsWith("fe") || tag === "femergenode") continue;
    const resolved = styleResolver.resolve(element, filterPresentation).values;
    const input = resolveInput(element, attribute(element, "in"));
    const input2 = hasAttribute(element, "in2") ? resolveInput(element, attribute(element, "in2")) : undefined;
    const common = {
      region: regionSpec(element, diagnostics),
      colorInterpolation: colorInterpolation(resolved["color-interpolation-filters"], element, diagnostics),
      source: sourceLocation(element),
      ...(input2 ? { input2 } : {}),
    };
    let spec: FilterPrimitiveSpec;
    if (tag === "fegaussianblur") {
      const [stdDeviationX, stdDeviationY] = numberPair(element, "stdDeviation", 0, diagnostics);
      const rawEdge = String(attribute(element, "edgeMode") ?? "none")
        .trim()
        .toLowerCase();
      const edgeMode = rawEdge === "duplicate" || rawEdge === "wrap" || rawEdge === "none" ? rawEdge : "none";
      if (edgeMode !== rawEdge)
        diagnostic(diagnostics, element, "invalid-filter-edge-mode", `Invalid edgeMode '${rawEdge}'; using none.`);
      spec = { type: "gaussianBlur", input, stdDeviationX, stdDeviationY, edgeMode, ...common };
    } else if (tag === "feoffset") {
      spec = {
        type: "offset",
        input,
        dx: numberValue(element, "dx", 0, diagnostics),
        dy: numberValue(element, "dy", 0, diagnostics),
        ...common,
      };
    } else if (tag === "feflood") {
      spec = { type: "flood", color: floodColor(element, resolved, diagnostics), ...common };
    } else if (tag === "femerge") {
      const inputs = children(element)
        .filter((child) => child.tagName?.toLowerCase() === "femergenode")
        .map((child) => resolveInput(child, attribute(child, "in")));
      spec = { type: "merge", inputs, ...common };
    } else if (tag === "fedropshadow") {
      const [stdDeviationX, stdDeviationY] = numberPair(element, "stdDeviation", 2, diagnostics);
      spec = {
        type: "dropShadow",
        input,
        stdDeviationX,
        stdDeviationY,
        dx: numberValue(element, "dx", 2, diagnostics),
        dy: numberValue(element, "dy", 2, diagnostics),
        color: floodColor(element, resolved, diagnostics),
        ...common,
      };
    } else {
      diagnostic(
        diagnostics,
        element,
        "unsupported-filter-primitive",
        `<${element.tagName}> is retained as a pass-through operation until its filter primitive ticket lands.`,
      );
      spec = { type: "passthrough", input, element: element.tagName ?? "unknown", ...common };
    }

    const result = String(attribute(element, "result") ?? "").trim();
    if (result) {
      if (RESERVED_INPUTS[result])
        diagnostic(diagnostics, element, "invalid-filter-result-name", `Filter result '${result}' is reserved.`);
      if (named.has(result))
        diagnostic(
          diagnostics,
          element,
          "duplicate-filter-result",
          `Filter result '${result}' is duplicated; later inputs use the closest preceding result.`,
        );
      spec.result = result;
      named.set(result, specs.length);
    }
    specs.push(spec);
  }
  return specs;
}

/** Resolve local filter definitions, href inheritance, graph names, and primitive presentation. */
export function resolveFilterResources(
  root: ElementNode,
  filterElements: Map<string, ElementNode>,
  definitions: Map<string, ElementNode>,
  styleResolver: SVGStyleResolver,
  rootPresentation: Presentation,
  diagnostics: RenderDiagnostic[],
): Map<string, FilterResource> {
  const resolutions = new Map<ElementNode, StyleResolution>();
  const walk = (element: ElementNode, inherited: Presentation): void => {
    for (const child of children(element)) {
      if (!containsFilter(child)) continue;
      const resolved = styleResolver.resolve(child, inherited);
      resolutions.set(child, resolved);
      walk(child, resolved.values);
    }
  };
  walk(root, rootPresentation);

  const resources = new Map<string, FilterResource>();
  const resolving: string[] = [];
  const resolveOne = (id: string): FilterResource | undefined => {
    const cached = resources.get(id);
    if (cached) return cached;
    const element = filterElements.get(id);
    if (!element) return undefined;
    const cycleIndex = resolving.indexOf(id);
    if (cycleIndex >= 0) {
      const cycle = [...resolving.slice(cycleIndex), id];
      diagnostic(
        diagnostics,
        element,
        "cyclic-filter-reference",
        `Filter href cycle detected: ${cycle.map((item) => `#${item}`).join(" -> ")}.`,
      );
      return undefined;
    }
    resolving.push(id);
    const presentation = resolutions.get(element)?.values ?? rootPresentation;
    const href = localHref(element, diagnostics);
    let base: FilterResource | undefined;
    if (href) {
      const target = definitions.get(href);
      if (!target || target.tagName?.toLowerCase() !== "filter") {
        diagnostic(
          diagnostics,
          element,
          target ? "wrong-filter-href-resource-type" : "missing-filter-href-resource",
          target
            ? `Filter href #${href} targets <${target.tagName}> instead of a filter.`
            : `Filter href #${href} does not resolve to a local filter.`,
        );
      } else {
        base = resolveOne(href);
      }
    }
    const primitiveElements = children(element).filter((child) => (child.tagName ?? "").toLowerCase().startsWith("fe"));
    const width = hasAttribute(element, "width")
      ? parsedLength(attribute(element, "width"), "120%", "filter width", element, diagnostics)
      : (base?.width ?? parsedLength(undefined, "120%", "filter width", element, diagnostics));
    const height = hasAttribute(element, "height")
      ? parsedLength(attribute(element, "height"), "120%", "filter height", element, diagnostics)
      : (base?.height ?? parsedLength(undefined, "120%", "filter height", element, diagnostics));
    if (width.value < 0) diagnostic(diagnostics, element, "negative-filter-width", "Filter width cannot be negative.");
    if (height.value < 0)
      diagnostic(diagnostics, element, "negative-filter-height", "Filter height cannot be negative.");
    const resource: FilterResource = {
      id,
      x: hasAttribute(element, "x")
        ? parsedLength(attribute(element, "x"), "-10%", "filter x", element, diagnostics)
        : (base?.x ?? parsedLength(undefined, "-10%", "filter x", element, diagnostics)),
      y: hasAttribute(element, "y")
        ? parsedLength(attribute(element, "y"), "-10%", "filter y", element, diagnostics)
        : (base?.y ?? parsedLength(undefined, "-10%", "filter y", element, diagnostics)),
      width,
      height,
      units: hasAttribute(element, "filterUnits")
        ? units(attribute(element, "filterUnits"), "objectBoundingBox", "filterUnits", element, diagnostics)
        : (base?.units ?? "objectBoundingBox"),
      primitiveUnits: hasAttribute(element, "primitiveUnits")
        ? units(attribute(element, "primitiveUnits"), "userSpaceOnUse", "primitiveUnits", element, diagnostics)
        : (base?.primitiveUnits ?? "userSpaceOnUse"),
      colorInterpolation: colorInterpolation(presentation["color-interpolation-filters"], element, diagnostics),
      ...(href ? { href } : {}),
      source: sourceLocation(element),
      element,
      primitives:
        primitiveElements.length > 0
          ? buildPrimitiveSpecs(element, presentation, styleResolver, diagnostics)
          : (base?.primitives ?? []),
      instances: new Map(),
      invalid: href !== undefined && (!base || base.invalid),
    };
    resources.set(id, resource);
    resolving.pop();
    return resource;
  };
  for (const id of filterElements.keys()) resolveOne(id);
  return resources;
}

function resolvedLength(
  value: ParsedSVGLength,
  axis: "horizontal" | "vertical",
  unitsValue: FilterUnits,
  node: RenderNode,
) {
  const viewport = unitsValue === "objectBoundingBox" ? { width: 1, height: 1 } : node.paintContext.viewport;
  const result = resolveSVGLength(
    value,
    lengthContext(
      viewport,
      node.paintContext.rootViewport,
      axis === "horizontal" ? "viewport-width" : "viewport-height",
      axis,
      node.paintContext.fontMetrics,
    ),
  );
  return typeof result === "number" ? result : 0;
}

function coordinate(
  value: ParsedSVGLength,
  axis: "horizontal" | "vertical",
  unitsValue: FilterUnits,
  node: RenderNode,
  bounds: RenderBounds | undefined,
  size = false,
): number {
  const resolved = resolvedLength(value, axis, unitsValue, node);
  if (unitsValue !== "objectBoundingBox" || !bounds) return resolved;
  const extent = axis === "horizontal" ? bounds.width : bounds.height;
  if (size) return resolved * extent;
  return (axis === "horizontal" ? bounds.x : bounds.y) + resolved * extent;
}

function intersect(left: RenderBounds, right: RenderBounds): RenderBounds {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const maxX = Math.min(left.x + left.width, right.x + right.width);
  const maxY = Math.min(left.y + left.height, right.y + right.height);
  return maxX <= x || maxY <= y ? { x, y, width: 0, height: 0 } : { x, y, width: maxX - x, height: maxY - y };
}

function union(bounds: RenderBounds[]): RenderBounds | undefined {
  if (bounds.length === 0) return undefined;
  const x = Math.min(...bounds.map((item) => item.x));
  const y = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return { x, y, width: maxX - x, height: maxY - y };
}

function inputRegion(input: FilterInput, previous: FilterPrimitive[], filterRegion: RenderBounds): RenderBounds {
  return input.type === "result" ? (previous[input.index]?.subregion ?? filterRegion) : filterRegion;
}

function subregion(
  spec: FilterPrimitiveSpec,
  previous: FilterPrimitive[],
  filterRegion: RenderBounds,
  resource: FilterResource,
  node: RenderNode,
  bounds: RenderBounds | undefined,
): RenderBounds {
  const inputs = spec.type === "merge" ? spec.inputs : [spec.input, spec.input2].filter((input) => input !== undefined);
  const defaults = union(inputs.map((input) => inputRegion(input, previous, filterRegion))) ?? filterRegion;
  const x = spec.region.x ? coordinate(spec.region.x, "horizontal", resource.primitiveUnits, node, bounds) : defaults.x;
  const y = spec.region.y ? coordinate(spec.region.y, "vertical", resource.primitiveUnits, node, bounds) : defaults.y;
  const width = spec.region.width
    ? coordinate(spec.region.width, "horizontal", resource.primitiveUnits, node, bounds, true)
    : defaults.width;
  const height = spec.region.height
    ? coordinate(spec.region.height, "vertical", resource.primitiveUnits, node, bounds, true)
    : defaults.height;
  return intersect({ x, y, width: Math.max(0, width), height: Math.max(0, height) }, filterRegion);
}

function paintColor(paint: Paint, opacity: number): RGBAColor {
  const source = paint.type === "solid" ? paint.value : paint.type === "reference" ? paint.fallback : undefined;
  const color = source ? parseRGBAColor(source) : undefined;
  return color ? { ...color, alpha: color.alpha * opacity } : CLEAR;
}

/** Resolve filter regions and primitive-unit parameters for one referencing render node. */
export function resolveFilterInstance(resource: FilterResource, node: RenderNode): FilterInstance {
  const bounds = objectBoundingBox(node);
  const needsBounds = resource.units === "objectBoundingBox" || resource.primitiveUnits === "objectBoundingBox";
  if (resource.invalid || (needsBounds && (!bounds || bounds.width === 0 || bounds.height === 0))) {
    return {
      resource,
      region: { x: 0, y: 0, width: 0, height: 0 },
      primitives: [],
      fillPaint: CLEAR,
      strokePaint: CLEAR,
      invalid: true,
    };
  }
  const region = {
    x: coordinate(resource.x, "horizontal", resource.units, node, bounds),
    y: coordinate(resource.y, "vertical", resource.units, node, bounds),
    width: coordinate(resource.width, "horizontal", resource.units, node, bounds, true),
    height: coordinate(resource.height, "vertical", resource.units, node, bounds, true),
  };
  const scaleX = resource.primitiveUnits === "objectBoundingBox" ? (bounds?.width ?? 0) : 1;
  const scaleY = resource.primitiveUnits === "objectBoundingBox" ? (bounds?.height ?? 0) : 1;
  const primitives: FilterPrimitive[] = [];
  for (const spec of resource.primitives) {
    const common = {
      ...(spec.result ? { result: spec.result } : {}),
      subregion: subregion(spec, primitives, region, resource, node, bounds),
      colorInterpolation: spec.colorInterpolation,
      source: spec.source,
    };
    if (spec.type === "gaussianBlur")
      primitives.push({
        ...spec,
        stdDeviationX: spec.stdDeviationX * scaleX,
        stdDeviationY: spec.stdDeviationY * scaleY,
        ...common,
      });
    else if (spec.type === "offset")
      primitives.push({ ...spec, dx: spec.dx * scaleX, dy: spec.dy * scaleY, ...common });
    else if (spec.type === "dropShadow")
      primitives.push({
        ...spec,
        stdDeviationX: spec.stdDeviationX * scaleX,
        stdDeviationY: spec.stdDeviationY * scaleY,
        dx: spec.dx * scaleX,
        dy: spec.dy * scaleY,
        ...common,
      });
    else primitives.push({ ...spec, ...common });
  }
  return {
    resource,
    region,
    primitives,
    fillPaint: paintColor(node.style.contextFill ?? node.style.fill, node.style.fillOpacity),
    strokePaint: paintColor(node.style.stroke, node.style.strokeOpacity),
    invalid: region.width <= 0 || region.height <= 0,
  };
}
