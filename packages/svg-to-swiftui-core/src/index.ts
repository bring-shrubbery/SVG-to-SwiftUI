import type { ElementNode } from "svg-parser";
import { parse } from "svg-parser";
import { DEFAULT_CONFIG } from "./constants";
import { buildRenderDocument } from "./renderTree/buildRenderTree";
import { analyzeCapabilities } from "./renderTree/capabilities";
import { generateShape, generateView } from "./renderTree/generateSwiftUI";
import { createUsageCommentTemplate } from "./templates";
import type { SwiftUIGeneratorConfig } from "./types";
import { extractSVGProperties, getSVGElement } from "./utils";

export * from "./types";

/**
 * Test and integration hooks for inspecting the semantic pipeline without
 * parsing generated Swift source. They are grouped to keep the main API small.
 */
function parseRenderDocument(rawSVGString: string) {
  const ast = parse(rawSVGString);
  const svgElement = getSVGElement(ast);
  if (!svgElement) throw new Error("Could not find SVG element, please provide full SVG source!");
  return buildRenderDocument(svgElement, extractSVGProperties(svgElement));
}

export const __testing = { parseRenderDocument, analyzeCapabilities };

/** Convert a complete SVG source string into a SwiftUI Shape or View declaration. */
export function convert(rawSVGString: string, config?: SwiftUIGeneratorConfig): string {
  const ast = parse(rawSVGString);
  const svgElement = getSVGElement(ast);
  if (!svgElement) throw new Error("Could not find SVG element, please provide full SVG source!");
  return swiftUIGenerator(svgElement, config);
}

function swiftUIGenerator(svgElement: ElementNode, config: SwiftUIGeneratorConfig = {}): string {
  const svgProperties = extractSVGProperties(svgElement);
  const configWithDefaults: SwiftUIGeneratorConfig = { ...DEFAULT_CONFIG, ...config };
  const document = buildRenderDocument(svgElement, svgProperties);
  const decision = analyzeCapabilities(document, config);

  if (config.strict && document.diagnostics.length > 0) {
    throw new Error(document.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
  }

  const generated =
    decision.mode === "view"
      ? generateView(document, svgProperties, configWithDefaults)
      : generateShape(document, svgProperties, configWithDefaults);

  if (!config.usageCommentPrefix) return generated.lines.join("\n");
  const usageComment = createUsageCommentTemplate({
    config: configWithDefaults,
    viewBox: svgProperties.viewBox,
    preservesColors: generated.preservesColors,
  });
  return [...usageComment, "", ...generated.lines].join("\n");
}
