import type { ElementNode } from "svg-parser";
import { parse } from "svg-parser";

import type { SwiftUIGeneratorConfig, TranspilerOptions } from "./types";
import { DEFAULT_CONFIG } from "./constants";
import { handleElement } from "./elementHandlers";
import {
  createFunctionTemplate,
  createStructTemplate,
  createUsageCommentTemplate,
} from "./templates";
import { extractSVGProperties, getSVGElement } from "./utils";

export * from "./types";

const LIGHT_FILLS = new Set(["white", "#fff", "#ffffff", "rgb(255,255,255)"]);

function isLightFill(fill: string): boolean {
  return LIGHT_FILLS.has(fill.replace(/\s/g, ""));
}

function hasLightFill(fills: Set<string>): boolean {
  for (const f of fills) {
    if (isLightFill(f)) return true;
  }
  return false;
}

function hasDarkFill(fills: Set<string>): boolean {
  for (const f of fills) {
    if (!isLightFill(f)) return true;
  }
  return false;
}

/**
 * This function converts SVG string into SwiftUI
 * Shape structure which is returned as a string.
 * @param rawSVGString SVG code as a raw string.
 * @param config Optional configuration object.
 */
export function convert(
  rawSVGString: string,
  config?: SwiftUIGeneratorConfig,
): string {
  const AST = parse(rawSVGString);
  const svgElement = getSVGElement(AST);
  if (svgElement) {
    return swiftUIGenerator(svgElement, config);
  } else {
    throw new Error(
      "Could not find SVG element, please provide full SVG source!",
    );
  }
}

/**
 * Generates SwiftUI Shape string from SVG HAST (Abstract Syntax Tree).
 * @param svgElement Parsed SVG Abstract Syntax Tree.
 * @param config Optional configuration object.
 */
function swiftUIGenerator(
  svgElement: ElementNode,
  config?: SwiftUIGeneratorConfig,
): string {
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
  };

  const configWithDefaults = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Generate SwiftUI Shape body.
  const generatedBody = handleElement(svgElement, rootTranspilerOptions);

  // Detect if shape needs even-odd fill rule (mixed light/dark fills)
  const needsEoFill = hasLightFill(rootTranspilerOptions.fillColors) &&
    hasDarkFill(rootTranspilerOptions.fillColors);

  const structBody: string[] = [];
  if (needsEoFill) {
    structBody.push("static let eoFill = true");
  }
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
    name:
      configWithDefaults.structName ?? DEFAULT_CONFIG.structName ?? "SVGShape",
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
