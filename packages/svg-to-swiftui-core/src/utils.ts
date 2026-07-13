import type { ElementNode, RootNode, TextNode } from "svg-parser";

import { defaultFontMetrics, lengthContext, parseSVGLength, resolveSVGLength, SVGLengthError } from "./lengths";
import type { RenderDiagnostic } from "./renderTree/types";
import type { SVGElementProperties, SwiftUIGeneratorConfig, ViewBoxData } from "./types";
import { DEFAULT_PRESERVE_ASPECT_RATIO, parsePreserveAspectRatio, parseViewBox, viewBoxTransform } from "./viewports";

export interface SVGPropertyResolution {
  properties: SVGElementProperties;
  diagnostics: RenderDiagnostic[];
}

function findElementById(root: ElementNode, id: string): ElementNode | undefined {
  if (String(root.properties?.id ?? "") === id) return root;
  for (const child of root.children) {
    if (typeof child === "string" || child.type !== "element") continue;
    const found = findElementById(child, id);
    if (found) return found;
  }
  return undefined;
}

function diagnostic(code: string, message: string): RenderDiagnostic {
  return { code, message, severity: "warning", source: { element: "svg" } };
}

function validOuterViewport(config: SwiftUIGeneratorConfig): { width: number; height: number } | undefined {
  const viewport = config.outerViewport;
  if (!viewport) return undefined;
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width < 0 ||
    viewport.height < 0
  ) {
    throw new SVGLengthError("invalid-outer-viewport", "outerViewport must contain finite, non-negative dimensions.");
  }
  return viewport;
}

function rootDimension(
  raw: unknown,
  axis: "horizontal" | "vertical",
  viewBoxDimension: number | undefined,
  outerViewport: { width: number; height: number } | undefined,
  fallbackViewport: { width: number; height: number },
  diagnostics: RenderDiagnostic[],
): number {
  const parsed = parseSVGLength(raw, { allowAuto: true });
  if (parsed.kind === "missing" || parsed.kind === "auto") {
    if (viewBoxDimension !== undefined && viewBoxDimension >= 0) return viewBoxDimension;
    if (outerViewport) return axis === "horizontal" ? outerViewport.width : outerViewport.height;
    return axis === "horizontal" ? 300 : 150;
  }

  if (!outerViewport && ["%", "vw", "vh", "vmin", "vmax"].includes(parsed.unit)) {
    diagnostics.push(
      diagnostic(
        "root-relative-viewport-fallback",
        `Root ${axis === "horizontal" ? "width" : "height"} uses ${parsed.unit || "a relative unit"} without outerViewport; ` +
          "permissive mode resolves it against the viewBox (or the deterministic 300×150 fallback).",
      ),
    );
  }

  const resolved = resolveSVGLength(
    parsed,
    lengthContext(
      fallbackViewport,
      outerViewport ?? fallbackViewport,
      axis === "horizontal" ? "viewport-width" : "viewport-height",
      axis,
      defaultFontMetrics(),
    ),
  );
  if (typeof resolved !== "number")
    throw new SVGLengthError("invalid-root-size", "Root size did not resolve to a number.");
  if (resolved < 0) {
    diagnostics.push(
      diagnostic("negative-root-size", "Root width and height cannot be negative; permissive mode renders nothing."),
    );
    return 0;
  }
  return resolved;
}

/**
 * Extracts properties of the <svg> node.
 * @param svgJsonTree
 */
export function resolveSVGProperties(svg: ElementNode, config: SwiftUIGeneratorConfig = {}): SVGPropertyResolution {
  const diagnostics: RenderDiagnostic[] = [];
  const fragmentId = config.fragment?.replace(/^#/, "");
  const fragment = fragmentId ? findElementById(svg, fragmentId) : undefined;
  if (fragmentId && fragment?.tagName !== "view") {
    diagnostics.push(
      diagnostic("invalid-view-fragment", `Static fragment #${fragmentId} does not reference a <view> element.`),
    );
  }
  const activeView = fragment?.tagName === "view" ? fragment : undefined;

  let parsedViewBox: ViewBoxData | undefined;
  const rawViewBox = activeView?.properties?.viewBox ?? svg.properties?.viewBox;
  try {
    parsedViewBox = parseViewBox(rawViewBox);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    diagnostics.push(diagnostic(error instanceof SVGLengthError ? error.code : "invalid-viewbox", message));
  }

  const outerViewport = validOuterViewport(config);
  const fallbackViewport = outerViewport ?? {
    width: parsedViewBox?.width || 300,
    height: parsedViewBox?.height || 150,
  };
  let width = 0;
  let height = 0;
  try {
    width = rootDimension(
      svg.properties?.width,
      "horizontal",
      parsedViewBox?.width,
      outerViewport,
      fallbackViewport,
      diagnostics,
    );
  } catch (error) {
    diagnostics.push(diagnostic(error instanceof SVGLengthError ? error.code : "invalid-root-width", String(error)));
  }
  try {
    height = rootDimension(
      svg.properties?.height,
      "vertical",
      parsedViewBox?.height,
      outerViewport,
      fallbackViewport,
      diagnostics,
    );
  } catch (error) {
    diagnostics.push(diagnostic(error instanceof SVGLengthError ? error.code : "invalid-root-height", String(error)));
  }

  let preserveAspectRatio = DEFAULT_PRESERVE_ASPECT_RATIO;
  try {
    preserveAspectRatio = parsePreserveAspectRatio(
      activeView?.properties?.preserveAspectRatio ?? svg.properties?.preserveAspectRatio,
    );
  } catch (error) {
    diagnostics.push(
      diagnostic(error instanceof SVGLengthError ? error.code : "invalid-preserve-aspect-ratio", String(error)),
    );
  }

  const viewBox = parsedViewBox ?? { x: 0, y: 0, width, height };
  const zeroSized = width === 0 || height === 0 || viewBox.width === 0 || viewBox.height === 0;
  const properties: SVGElementProperties = {
    width,
    height,
    viewBox,
    userViewport: { width: viewBox.width, height: viewBox.height },
    preserveAspectRatio,
    viewBoxTransform: viewBoxTransform(parsedViewBox, { x: 0, y: 0, width, height }, preserveAspectRatio),
    zeroSized,
  };
  return { properties, diagnostics };
}

export function extractSVGProperties(svg: ElementNode, config: SwiftUIGeneratorConfig = {}): SVGElementProperties {
  return resolveSVGProperties(svg, config).properties;
}

/**
 * Performs Breadth First Search (BFS) to find <svg> element
 * @param rootNode Root node of given by SVG Parser
 */
export function getSVGElement(rootNode: RootNode): ElementNode | undefined {
  const frontier: (RootNode | ElementNode | TextNode | string)[] = [rootNode];

  // Run while there are nodes in the frontier
  while (frontier.length > 0) {
    // Get the first node so there is a FIFO queue.
    const currentNode = frontier.shift();

    // Ignore undefined and string nodes.
    if (currentNode && typeof currentNode !== "string") {
      if (currentNode.type === "root") {
        // Only need children from the root node, so add them
        // to frontier and continue.
        frontier.push(...currentNode.children);
      } else if (currentNode.type === "element") {
        // If the element node is the svg element, return it.
        if (currentNode.tagName === "svg") return currentNode;

        // Otherwise push children to the frontier and continue.
        frontier.push(...currentNode.children);
      } else {
      }
    }
  }

  return undefined;
}

/**
 * This function is used to cleanup expression like this: `0.5*width`.
 * If the expression is `1*width` there is no reason to multiply it by
 * 1, so we can just leave `width`. If the expression is `0*width`
 * then there is no reason to keep `width` around, so it just becomes
 * `0`.
 * @param value Numberic value.
 * @param suffix Variable suffix that is appended to the end (width,
 * height, etc.)
 */
export function clampNormalisedSizeProduct(value: string, suffix: string): string {
  if (Number(value) === 1) {
    return suffix;
  } else if (Number(value) === 0) {
    return "0";
  } else {
    return `${value}*${suffix}`;
  }
}

/** Formats a rounded number without leaving an invalid trailing decimal point. */
export function formatRoundedNumber(value: number, precision: number): string {
  return String(Number(value.toFixed(precision)));
}

interface RectOrPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * Normalises the position and size of the provided rectangle to span
 * from 0 to 1 based on the viewBox of the <svg> element. Width and
 * height are optional, so if only the position is required, then you
 * can just provide the x and y values.
 * @param rect ViewBox-like object with width and height being optional.
 * @param viewBox View box of the SVG Element.
 */
export function normaliseRectValues(rect: RectOrPosition, viewBox: ViewBoxData): RectOrPosition {
  if (rect.width !== undefined && rect.height !== undefined) {
    return {
      x: (rect.x - viewBox.x) / viewBox.width,
      y: (rect.y - viewBox.y) / viewBox.height,
      width: rect.width / viewBox.width,
      height: rect.height / viewBox.height,
    };
  } else {
    return {
      x: (rect.x - viewBox.x) / viewBox.width,
      y: (rect.y - viewBox.y) / viewBox.height,
    };
  }
}

interface RectOrPositionString {
  x: string;
  y: string;
  width?: string;
  height?: string;
}

export function stringifyRectValues(rect: RectOrPosition, precision: number): RectOrPositionString {
  // Function to convert all numbers the same way.
  const toFixed = (value: number) => formatRoundedNumber(value, precision);

  if (rect.width === undefined || rect.height === undefined) {
    return {
      x: toFixed(rect.x),
      y: toFixed(rect.y),
    };
  } else {
    return {
      x: toFixed(rect.x),
      y: toFixed(rect.y),
      width: toFixed(rect.width),
      height: toFixed(rect.height),
    };
  }
}
