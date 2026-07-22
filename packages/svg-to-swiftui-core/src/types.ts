import type { RenderDiagnostic } from "./renderTree/types";

export interface SwiftUIGeneratorConfig {
  structName?: string;
  precision?: number;
  indentationSize?: number;
  usageCommentPrefix?: boolean;
  /** Preserve SVG paints in a layered View. Defaults to automatic detection for multicolor SVGs. */
  preserveColors?: boolean;
  /** Fail when the semantic render tree contains unsupported visible content. */
  strict?: boolean;
  /** Receives each finalized diagnostic once, in deterministic source order. */
  onDiagnostic?: (diagnostic: RenderDiagnostic) => void;
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
  /** Bounded deterministic CPU execution for SVG filter primitives. */
  filters?: FilterConfiguration;
  /** Conversion-time renderer for static SVG <foreignObject> content. Async conversion is required. */
  foreignObjectRenderer?: ForeignObjectRenderer;
  /** Bounded rasterization and artifact behavior for static <foreignObject> snapshots. */
  foreignObjects?: ForeignObjectConfiguration;
  /** Deterministic language and capability inputs used by static SVG semantics. */
  staticEnvironment?: StaticEnvironment;
}

export interface FilterConfiguration {
  /** Maximum number of coefficients in one feConvolveMatrix kernel. Defaults to 225 (15×15). */
  maxKernelCells?: number;
  /** Maximum accepted feTurbulence octave count. Defaults to 9. */
  maxOctaves?: number;
  /** Maximum generated filter bitmap area. Defaults to 16 million pixels. */
  maxOutputPixels?: number;
}

export interface StaticEnvironment {
  /** Ordered BCP 47 language preferences. No host-machine locale is read when omitted. */
  preferredLanguages?: readonly string[];
  /** Extension URL identifiers supported by the generated static environment. */
  supportedExtensions?: readonly string[];
  /** SVG language version used for legacy requiredFeatures policy. Defaults to SVG 2. */
  svgVersion?: "1.1" | "2";
  /** Explicitly supported SVG 1.1 requiredFeatures identifiers. */
  supportedFeatures?: readonly string[];
  /** Highest-priority locale for selecting accessible title/desc alternatives. */
  accessibilityLocale?: string;
}

export interface ForeignObjectConfiguration {
  /** Snapshot pixels per SVG user unit. Defaults to 1 and is capped by maxScale. */
  scale?: number;
  /** Maximum accepted snapshot scale. Defaults to 4 and cannot exceed 8. */
  maxScale?: number;
  /** Extract snapshots larger than this many PNG bytes when using the artifact API. Defaults to 256 KiB. */
  inlineByteLimit?: number;
}

export interface ForeignObjectSnapshotRequest {
  /** Complete isolated, sanitized document. Active content is removed before the adapter receives it. */
  document: string;
  /** Foreign content box in SVG user-space coordinates. The isolated document itself starts at 0,0. */
  viewport: ViewBoxData;
  /** Exact transparent output dimensions requested from the adapter. */
  pixelWidth: number;
  pixelHeight: number;
  scale: number;
  source: { element: "foreignObject"; id?: string };
  /** Deterministic browser base used to resolve relative XHTML/CSS resource URLs. */
  baseURL: string;
  /** Human-readable text/ARIA label extracted from the sanitized subtree. */
  accessibilityLabel?: string;
  /** Resolve browser subresources through the configured deterministic resource policy. */
  resolveResource: (url: string) => Promise<ForeignObjectResolvedResource | undefined>;
}

export interface ForeignObjectResolvedResource {
  bytes: Uint8Array;
  mimeType: string;
  canonicalURL: string;
}

export interface ForeignObjectSnapshot {
  /** Unpremultiplied 8-bit sRGB pixels in row-major RGBA order. */
  rgba: Uint8Array;
  width: number;
  height: number;
  /** Actual pixels per SVG user unit used by the renderer. */
  scale: number;
}

export type ForeignObjectRenderer = (
  request: ForeignObjectSnapshotRequest,
) => ForeignObjectSnapshot | Promise<ForeignObjectSnapshot>;

export interface ConversionArtifact {
  /** Deterministic content-addressed filename, including extension. */
  name: string;
  mimeType: "image/png";
  bytes: Uint8Array;
  width: number;
  height: number;
  scale: number;
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
