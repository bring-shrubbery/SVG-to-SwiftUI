import type { ElementNode } from "svg-parser";
import { parse } from "svg-parser";
import { DEFAULT_CONFIG } from "./constants";
import { prepareForeignObjectSnapshots } from "./foreignObjects";
import { renderDocumentBounds, renderNodeBounds, renderNodesBounds } from "./renderTree/bounds";
import { buildRenderDocument } from "./renderTree/buildRenderTree";
import { analyzeCapabilities } from "./renderTree/capabilities";
import { generateShape, generateView } from "./renderTree/generateSwiftUI";
import type { RenderDiagnostic, RenderNode } from "./renderTree/types";
import { type InternalGeneratorConfig, prepareImageResources, resourceState } from "./resources";
import { createUsageCommentTemplate } from "./templates";
import type { ConversionArtifact, SwiftUIGeneratorConfig } from "./types";
import { getSVGElement, resolveSVGProperties } from "./utils";

export * from "./lengths";
export * from "./types";
export * from "./viewports";

export interface ConversionResult {
  swift: string;
  diagnostics: readonly RenderDiagnostic[];
  artifacts?: readonly ConversionArtifact[];
}

export interface ConversionArtifactResult extends ConversionResult {
  artifacts: readonly ConversionArtifact[];
}

/**
 * Test and integration hooks for inspecting the semantic pipeline without
 * parsing generated Swift source. They are grouped to keep the main API small.
 */
function parseRenderDocument(rawSVGString: string, config: SwiftUIGeneratorConfig = {}) {
  const ast = parse(rawSVGString);
  const svgElement = getSVGElement(ast);
  if (!svgElement) throw new Error("Could not find SVG element, please provide full SVG source!");
  const resolution = resolveSVGProperties(svgElement, config);
  return buildRenderDocument(svgElement, resolution.properties, resolution.diagnostics, config);
}

function inspectComputedStyles(rawSVGString: string, config: SwiftUIGeneratorConfig = {}) {
  const document = parseRenderDocument(rawSVGString, config);
  const result: Array<{ source: RenderNode["source"]; style: RenderNode["style"] }> = [];
  const visit = (nodes: RenderNode[]): void => {
    for (const node of nodes) {
      result.push({ source: node.source, style: node.style });
      if (node.type === "group") visit(node.children);
    }
  };
  visit(document.children);
  return result;
}

export const __testing = {
  parseRenderDocument,
  inspectComputedStyles,
  analyzeCapabilities,
  renderDocumentBounds,
  renderNodeBounds,
  renderNodesBounds,
};

/** Convert a complete SVG source string into a SwiftUI Shape or View declaration. */
export function convert(rawSVGString: string, config?: SwiftUIGeneratorConfig): string {
  const ast = parse(rawSVGString);
  const svgElement = getSVGElement(ast);
  if (!svgElement) throw new Error("Could not find SVG element, please provide full SVG source!");
  return swiftUIGenerator(svgElement, config).swift;
}

/** Convert while retaining structured diagnostics in permissive mode. */
export function convertWithDiagnostics(rawSVGString: string, config?: SwiftUIGeneratorConfig): ConversionResult {
  const ast = parse(rawSVGString);
  const svgElement = getSVGElement(ast);
  if (!svgElement) throw new Error("Could not find SVG element, please provide full SVG source!");
  return swiftUIGenerator(svgElement, config);
}

/** Resolve async caller resources before generating deterministic Swift source. */
export async function convertAsync(rawSVGString: string, config: SwiftUIGeneratorConfig = {}): Promise<string> {
  return (await convertAsyncWithDiagnostics(rawSVGString, config)).swift;
}

/** Async conversion variant that also returns structured diagnostics. */
export async function convertAsyncWithDiagnostics(
  rawSVGString: string,
  config: SwiftUIGeneratorConfig = {},
): Promise<ConversionResult> {
  return convertAsyncPrepared(rawSVGString, config, false);
}

async function convertAsyncPrepared(
  rawSVGString: string,
  config: SwiftUIGeneratorConfig,
  extractForeignObjectArtifacts: boolean,
): Promise<ConversionResult> {
  const ast = parse(rawSVGString);
  const svgElement = getSVGElement(ast);
  if (!svgElement) throw new Error("Could not find SVG element, please provide full SVG source!");
  const internalConfig: InternalGeneratorConfig = { ...config };
  internalConfig.__extractForeignObjectArtifacts = extractForeignObjectArtifacts;
  internalConfig.__resourceState = resourceState(internalConfig);
  await prepareImageResources(svgElement, internalConfig);
  internalConfig.__preparingForeignObjects = true;
  const preflightResolution = resolveSVGProperties(svgElement, internalConfig);
  const preflight = buildRenderDocument(
    svgElement,
    preflightResolution.properties,
    preflightResolution.diagnostics,
    internalConfig,
  );
  internalConfig.__preparingForeignObjects = false;
  await prepareForeignObjectSnapshots(preflight, svgElement, internalConfig);
  return swiftUIGenerator(svgElement, internalConfig);
}

/** Async conversion that extracts large foreignObject snapshots as deterministic binary artifacts. */
export async function convertAsyncWithArtifacts(
  rawSVGString: string,
  config: SwiftUIGeneratorConfig = {},
): Promise<ConversionArtifactResult> {
  const result = await convertAsyncPrepared(rawSVGString, config, true);
  return { ...result, artifacts: result.artifacts ?? [] };
}

function swiftUIGenerator(svgElement: ElementNode, config: InternalGeneratorConfig = {}): ConversionResult {
  const configWithDefaults: InternalGeneratorConfig = { ...DEFAULT_CONFIG, ...config };
  const resolution = resolveSVGProperties(svgElement, configWithDefaults);
  const svgProperties = resolution.properties;
  const document = buildRenderDocument(svgElement, svgProperties, resolution.diagnostics, configWithDefaults);
  const decision = analyzeCapabilities(document, config);

  if (
    document.diagnostics.some((diagnostic) => diagnostic.severity === "error") ||
    (config.strict && document.diagnostics.length > 0)
  ) {
    throw new Error(document.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
  }

  const generated =
    decision.mode === "view"
      ? generateView(document, svgProperties, configWithDefaults)
      : generateShape(document, svgProperties, configWithDefaults);

  const artifacts = config.__conversionArtifacts ? [...config.__conversionArtifacts.values()] : undefined;
  if (!config.usageCommentPrefix)
    return {
      swift: generated.lines.join("\n"),
      diagnostics: document.diagnostics,
      ...(artifacts?.length ? { artifacts } : {}),
    };
  const usageComment = createUsageCommentTemplate({
    config: configWithDefaults,
    viewBox: svgProperties.viewBox,
    preservesColors: generated.preservesColors,
  });
  return {
    swift: [...usageComment, "", ...generated.lines].join("\n"),
    diagnostics: document.diagnostics,
    ...(artifacts?.length ? { artifacts } : {}),
  };
}
