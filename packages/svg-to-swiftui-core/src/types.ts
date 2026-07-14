export interface SwiftUIGeneratorConfig {
  structName?: string;
  precision?: number;
  indentationSize?: number;
  usageCommentPrefix?: boolean;
  /** Preserve SVG paints in a layered View. Defaults to automatic detection for multicolor SVGs. */
  preserveColors?: boolean;
  /** Fail when the semantic render tree contains unsupported visible content. */
  strict?: boolean;
  /** Outer CSS viewport used to resolve percentage-based root width/height and viewport units. */
  outerViewport?: { width: number; height: number };
  /** Select a static <view id="…"> fragment, with or without a leading #. */
  fragment?: string;
  /** Deterministic font lookup used by SVG text rendering. */
  fonts?: {
    /** Font families known to be registered by the generated view's host. */
    availableFamilies?: string[];
    /** Case-insensitive SVG family substitutions, for example { Inter: "Noto Sans" }. */
    substitutions?: Record<string, string>;
    /** Family used after the authored list cannot be resolved. Defaults to Helvetica. */
    fallbackFamily?: string;
    /** Fail conversion when an authored family cannot be resolved. */
    strict?: boolean;
  };
  /** Deterministic resource loading. The default embeddedOnly policy performs no filesystem or network I/O. */
  resources?: ResourceConfiguration;
}

export type ResourcePolicy = "embeddedOnly" | "local" | "custom";
export type ResourceKind = "image" | "external-use" | "css-url" | "filter-image" | "foreign-object";

export interface ResourceLimits {
  /** Maximum encoded bytes for one resource. Defaults to 5 MiB. */
  maxResourceBytes?: number;
  /** Maximum decoded raster pixels for one image. Defaults to 16 million. */
  maxImagePixels?: number;
  /** Maximum aggregate bytes across one conversion. Defaults to 20 MiB. */
  maxTotalBytes?: number;
  /** Maximum resolved resources across one conversion. Defaults to 128. */
  maxResources?: number;
  /** Maximum nested SVG image depth. Defaults to 8. */
  maxNestingDepth?: number;
}

export interface ResourceRequest {
  rawURL: string;
  canonicalURL: string;
  baseURL?: string;
  kind: ResourceKind;
  source: { element: string; id?: string };
  limits: Required<ResourceLimits>;
}

export interface ResolvedResource {
  bytes?: Uint8Array;
  /** Required for bytes supplied by custom/local resolvers; validated against file signatures. */
  mimeType?: string;
  /** Stable canonical identity used for nested relative URLs and cycle detection. */
  canonicalURL?: string;
  /** Optional generated-app asset name. No bytes are embedded when this is selected. */
  assetName?: string;
  /** Required for asset references whose intrinsic size is not encoded in supplied bytes. */
  intrinsicSize?: { width: number; height: number };
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export type ResourceResolver = (
  request: ResourceRequest,
) => ResolvedResource | undefined | Promise<ResolvedResource | undefined>;

export interface ResourceConfiguration {
  policy?: ResourcePolicy;
  /** Base URL for resolving relative custom resources and SVG subdocument URLs. */
  baseURL?: string;
  /** Approved root used by local policy. Relative URLs may not escape this directory. */
  baseDirectory?: string;
  /** Caller-supplied deterministic content, keyed by raw or canonical URL. */
  supplied?: Readonly<Record<string, ResolvedResource>>;
  /** Sync or async callback. embeddedOnly never invokes it; local invokes it only after traversal checks. */
  resolver?: ResourceResolver;
  limits?: ResourceLimits;
}

export interface TranspilerOptions {
  width: number;
  height: number;
  viewBox: ViewBoxData;
  precision: number;
  lastPathId: number;
  indentationSize: number;
  currentIndentationLevel: number;
  parentStyle: Record<string, string | number>;
  fillColors: Set<string>;
  strokeExpansion: number;
  reverseWinding: boolean;
  normalizeWindingCW: boolean;
  hasFills: boolean;
  /** Generate an independent paint layer instead of geometry for a shared silhouette. */
  separatePaintLayer: boolean;
  hasStrokes: boolean;
  /** Active SVG fill-rule for the current path: "nonzero" | "evenodd". */
  fillRule: string;
  /** SVG elements indexed by id, used to resolve <use> references. */
  definitions: Map<string, import("svg-parser").ElementNode>;
  /** Active <use> references, used to reject circular definitions. */
  activeUseReferences: Set<string>;
  /** Precomputed semantic style supplied by the render-tree generator. */
  resolvedStyle?: import("./renderTree/types").ComputedStyle;
  /** Apply the complete CTM to a centerline before constructing a non-scaling stroke outline. */
  preStrokeTransform?: import("./transformUtils").AffineTransform;
}

export interface ViewBoxData {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Element Property Interfaces

export interface SVGElementProperties {
  width: number;
  height: number;
  viewBox: ViewBoxData;
  userViewport: { width: number; height: number };
  preserveAspectRatio: import("./viewports").PreserveAspectRatio;
  viewBoxTransform: import("./transformUtils").AffineTransform;
  zeroSized: boolean;
}
