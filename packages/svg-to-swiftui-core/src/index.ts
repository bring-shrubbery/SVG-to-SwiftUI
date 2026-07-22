import type { ElementNode } from "svg-parser";
import { parse } from "svg-parser";
import { type ConversionConformance, conversionConformance } from "./conformance";
import { DEFAULT_CONFIG } from "./constants";
import { prepareForeignObjectSnapshots } from "./foreignObjects";
import { renderDocumentBounds, renderNodeBounds, renderNodesBounds } from "./renderTree/bounds";
import { buildRenderDocument } from "./renderTree/buildRenderTree";
import { analyzeCapabilities } from "./renderTree/capabilities";
import { generateShape, generateView } from "./renderTree/generateSwiftUI";
import type { OutputMode, RenderDiagnostic, RenderNode, SourcePosition } from "./renderTree/types";
import { type InternalGeneratorConfig, prepareImageResources, resourceState } from "./resources";
import { createUsageCommentTemplate } from "./templates";
import type { ConversionArtifact, SwiftUIGeneratorConfig } from "./types";
import { getSVGElement, resolveSVGProperties } from "./utils";

export * from "./conformance";
export * from "./lengths";
export type {
  DiagnosticSeverity,
  OutputMode,
  RenderDiagnostic,
  SourceLocation,
  SourcePosition,
} from "./renderTree/types";
export * from "./types";
export * from "./viewports";

export interface ConversionResult {
  swift: string;
  outputMode: OutputMode;
  diagnostics: readonly RenderDiagnostic[];
  artifacts?: readonly ConversionArtifact[];
}

export interface ConversionArtifactResult extends ConversionResult {
  artifacts: readonly ConversionArtifact[];
}

export interface DetailedConversionResult {
  /** Generated Swift source. */
  source: string;
  outputMode: OutputMode;
  artifacts: readonly ConversionArtifact[];
  diagnostics: readonly RenderDiagnostic[];
  conformance: ConversionConformance;
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
  return swiftUIGenerator(rawSVGString, svgElement, config).swift;
}

/** Convert while retaining structured diagnostics in permissive mode. */
export function convertWithDiagnostics(rawSVGString: string, config?: SwiftUIGeneratorConfig): ConversionResult {
  const ast = parse(rawSVGString);
  const svgElement = getSVGElement(ast);
  if (!svgElement) throw new Error("Could not find SVG element, please provide full SVG source!");
  return swiftUIGenerator(rawSVGString, svgElement, config);
}

/** Convert with the complete stable result contract used by conformance tooling. */
export function convertDetailed(rawSVGString: string, config?: SwiftUIGeneratorConfig): DetailedConversionResult {
  const result = convertWithDiagnostics(rawSVGString, config);
  return {
    source: result.swift,
    outputMode: result.outputMode,
    artifacts: result.artifacts ?? [],
    diagnostics: result.diagnostics,
    conformance: conversionConformance(rawSVGString, result.diagnostics),
  };
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
  return swiftUIGenerator(rawSVGString, svgElement, internalConfig);
}

/** Async conversion that extracts large foreignObject snapshots as deterministic binary artifacts. */
export async function convertAsyncWithArtifacts(
  rawSVGString: string,
  config: SwiftUIGeneratorConfig = {},
): Promise<ConversionArtifactResult> {
  const result = await convertAsyncPrepared(rawSVGString, config, true);
  return { ...result, artifacts: result.artifacts ?? [] };
}

/** Async detailed conversion, including deterministic external-resource artifacts. */
export async function convertDetailedAsync(
  rawSVGString: string,
  config: SwiftUIGeneratorConfig = {},
): Promise<DetailedConversionResult> {
  const result = await convertAsyncPrepared(rawSVGString, config, true);
  return {
    source: result.swift,
    outputMode: result.outputMode,
    artifacts: result.artifacts ?? [],
    diagnostics: result.diagnostics,
    conformance: conversionConformance(rawSVGString, result.diagnostics),
  };
}

function sourcePosition(rawSVGString: string, diagnostic: RenderDiagnostic): SourcePosition | undefined {
  const escapedTag = diagnostic.source.element.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidates = [...rawSVGString.matchAll(new RegExp(`<\\s*${escapedTag}\\b[^>]*>`, "gi"))];
  const match = diagnostic.source.id
    ? candidates.find((candidate) => {
        const tag = candidate[0];
        const id = [...tag.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)][0]?.[1];
        return id === diagnostic.source.id;
      })
    : candidates[0];
  if (match?.index === undefined) return undefined;
  const before = rawSVGString.slice(0, match.index);
  const lines = before.split("\n");
  return { offset: match.index, line: lines.length, column: lines[lines.length - 1]!.length + 1 };
}

function finalizeDiagnostics(rawSVGString: string, diagnostics: readonly RenderDiagnostic[]): RenderDiagnostic[] {
  return diagnostics
    .map((diagnostic) => {
      const references = [...diagnostic.message.matchAll(/#([\w:.-]+)/g)].map((match) => `#${match[1]}`);
      const location = sourcePosition(rawSVGString, diagnostic);
      return {
        ...diagnostic,
        ...(diagnostic.css?.source === "presentation-attribute" && diagnostic.css.property
          ? { attribute: diagnostic.attribute ?? diagnostic.css.property }
          : {}),
        ...(diagnostic.css?.property ? { property: diagnostic.property ?? diagnostic.css.property } : {}),
        ...(location ? { location } : {}),
        ...(references.length > 0 ? { referenceChain: diagnostic.referenceChain ?? references } : {}),
        fallback: diagnostic.fallback ?? {
          permissive: "Emit this diagnostic and apply the documented static fallback.",
          strict: "Fail conversion before returning generated source.",
        },
      };
    })
    .sort(
      (left, right) =>
        (left.location?.offset ?? Number.MAX_SAFE_INTEGER) - (right.location?.offset ?? Number.MAX_SAFE_INTEGER) ||
        left.code.localeCompare(right.code) ||
        left.message.localeCompare(right.message),
    );
}

function swiftUIGenerator(
  rawSVGString: string,
  svgElement: ElementNode,
  config: InternalGeneratorConfig = {},
): ConversionResult {
  const configWithDefaults: InternalGeneratorConfig = { ...DEFAULT_CONFIG, ...config };
  const resolution = resolveSVGProperties(svgElement, configWithDefaults);
  const svgProperties = resolution.properties;
  const document = buildRenderDocument(svgElement, svgProperties, resolution.diagnostics, configWithDefaults);
  const decision = analyzeCapabilities(document, config);
  const diagnostics = finalizeDiagnostics(rawSVGString, document.diagnostics);
  for (const diagnostic of diagnostics) configWithDefaults.onDiagnostic?.(diagnostic);

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error") || (config.strict && diagnostics.length > 0)) {
    throw new Error(
      diagnostics
        .map(
          (diagnostic) =>
            `[${diagnostic.code}] ${diagnostic.source.element}${diagnostic.source.id ? `#${diagnostic.source.id}` : ""}${diagnostic.location ? ` at ${diagnostic.location.line}:${diagnostic.location.column}` : ""}: ${diagnostic.message}`,
        )
        .join("\n"),
    );
  }

  const generated =
    decision.mode === "view"
      ? generateView(document, svgProperties, configWithDefaults)
      : generateShape(document, svgProperties, configWithDefaults);

  const artifacts = config.__conversionArtifacts ? [...config.__conversionArtifacts.values()] : undefined;
  if (!config.usageCommentPrefix)
    return {
      swift: generated.lines.join("\n"),
      outputMode: decision.mode,
      diagnostics,
      ...(artifacts?.length ? { artifacts } : {}),
    };
  const usageComment = createUsageCommentTemplate({
    config: configWithDefaults,
    viewBox: svgProperties.viewBox,
    preservesColors: generated.preservesColors,
  });
  return {
    swift: [...usageComment, "", ...generated.lines].join("\n"),
    outputMode: decision.mode,
    diagnostics,
    ...(artifacts?.length ? { artifacts } : {}),
  };
}
