import type { ElementNode } from "svg-parser";
import { parse } from "svg-parser";
import { DEFAULT_CONFIG } from "./constants";
import { handleElement } from "./elementHandlers";
import { createFunctionTemplate, createStructTemplate, createUsageCommentTemplate } from "./templates";
import type { SwiftUIGeneratorConfig, TranspilerOptions } from "./types";
import { extractSVGProperties, getSVGElement } from "./utils";

/**
 * Pre-scan the SVG tree to detect if any elements have fill (not "none").
 * Tracks inherited fill from parent elements.
 */
function svgHasFills(node: ElementNode, inheritedFill?: string): boolean {
  const FILLABLE_TAGS = new Set(["path", "circle", "ellipse", "rect", "polygon", "polyline"]);

  // Determine this element's effective fill
  const ownFill = node.properties?.fill as string | undefined;
  const style = node.properties?.style as string | undefined;

  let effectiveFill = inheritedFill;

  // Own fill attribute overrides inherited
  if (ownFill !== undefined) {
    effectiveFill = ownFill;
  }

  // Inline style fill overrides attribute
  if (style) {
    const match = /fill\s*:\s*([^;]+)/.exec(style);
    if (match) {
      effectiveFill = match[1]!.trim();
    }
  }

  // Check if this is a fillable shape with non-none fill
  if (FILLABLE_TAGS.has(node.tagName ?? "")) {
    // Default fill is black if not specified
    const fill = effectiveFill ?? "black";
    if (fill !== "none") return true;
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      if (typeof child !== "string" && "tagName" in (child as ElementNode)) {
        if (svgHasFills(child as ElementNode, effectiveFill)) return true;
      }
    }
  }

  return false;
}

export * from "./types";

/**
 * This function converts SVG string into SwiftUI
 * Shape structure which is returned as a string.
 * @param rawSVGString SVG code as a raw string.
 * @param config Optional configuration object.
 */
export function convert(rawSVGString: string, config?: SwiftUIGeneratorConfig): string {
  const AST = parse(rawSVGString);
  const svgElement = getSVGElement(AST);
  if (svgElement) {
    return swiftUIGenerator(svgElement, config);
  } else {
    throw new Error("Could not find SVG element, please provide full SVG source!");
  }
}

/**
 * Generates SwiftUI Shape string from SVG HAST (Abstract Syntax Tree).
 * @param svgElement Parsed SVG Abstract Syntax Tree.
 * @param config Optional configuration object.
 */
function swiftUIGenerator(svgElement: ElementNode, config?: SwiftUIGeneratorConfig): string {
  const svgProperties = extractSVGProperties(svgElement);

  // The initial options passed to the first element.
  const rootTranspilerOptions: TranspilerOptions = {
    ...svgProperties,
    precision: config?.precision ?? 10,
    lastPathId: 0,
    indentationSize: config?.indentationSize ?? 4,
    currentIndentationLevel: 0,
    parentStyle: {},
    fillColors: new Set<string>(),
    strokeExpansion: 0,
    reverseWinding: false,
    normalizeWindingCW: false,
    hasFills: svgHasFills(svgElement),
  };

  const configWithDefaults = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Generate SwiftUI Shape body.
  const generatedBody = handleElement(svgElement, rootTranspilerOptions);

  const structBody: string[] = [];
  structBody.push(
    ...createFunctionTemplate({
      name: "path",
      parameters: [["in rect", "CGRect"]],
      returnType: "Path",
      indent: configWithDefaults.indentationSize,
      body: [
        "var path = Path()",
        "let width = rect.size.width",
        "let height = rect.size.height",
        ...generatedBody,
        "return path",
      ],
    }),
  );

  const fullSwiftUIShape = createStructTemplate({
    name: configWithDefaults.structName ?? DEFAULT_CONFIG.structName ?? "SVGShape",
    indent: configWithDefaults.indentationSize,
    returnType: "Shape",
    body: structBody,
  });

  if (config?.usageCommentPrefix) {
    const usageComment = createUsageCommentTemplate({
      config,
      viewBox: svgProperties.viewBox,
    });

    return [...usageComment, "", ...fullSwiftUIShape].join("\n");
  }

  return fullSwiftUIShape.join("\n");
}
