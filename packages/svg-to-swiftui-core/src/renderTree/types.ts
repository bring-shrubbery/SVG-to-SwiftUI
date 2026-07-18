import type { ElementNode } from "svg-parser";
import type { RGBAColor } from "../colorUtils";
import type { FontMetrics, ParsedSVGLength } from "../lengths";
import type { AffineTransform } from "../transformUtils";
import type { ViewBoxData } from "../types";
import type { PreserveAspectRatio } from "../viewports";

/** Identifies the SVG source that produced a render-tree node or diagnostic. */
export interface SourceLocation {
  element: string;
  id?: string;
}

export type DiagnosticSeverity = "warning" | "error";

export interface CSSDiagnosticContext {
  source: "embedded-style" | "inline-style" | "presentation-attribute";
  selector?: string;
  property?: string;
  line?: number;
  column?: number;
}

/** A structured conversion diagnostic. Later features can add codes without changing the public converter API. */
export interface RenderDiagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  source: SourceLocation;
  css?: CSSDiagnosticContext;
}

/** SVG paint is deliberately semantic; Swift source is only introduced by the generator. */
export type Paint =
  | { type: "none" }
  | { type: "solid"; value: string }
  | { type: "reference"; id: string; fallback?: string }
  | { type: "context"; source: "fill" | "stroke" };

export type GradientUnits = "objectBoundingBox" | "userSpaceOnUse";
export type GradientSpreadMethod = "pad" | "reflect" | "repeat";
export type GradientColorInterpolation = "sRGB" | "linearRGB";

export interface GradientStop {
  offset: number;
  color: RGBAColor;
  source: SourceLocation;
}

interface GradientPaintBase {
  id: string;
  units: GradientUnits;
  transform: AffineTransform;
  spreadMethod: GradientSpreadMethod;
  stops: GradientStop[];
  colorInterpolation: GradientColorInterpolation;
  href?: string;
  source: SourceLocation;
}

export interface LinearGradientPaint extends GradientPaintBase {
  type: "linearGradient";
  x1: ParsedSVGLength;
  y1: ParsedSVGLength;
  x2: ParsedSVGLength;
  y2: ParsedSVGLength;
}

export interface RadialGradientPaint extends GradientPaintBase {
  type: "radialGradient";
  cx: ParsedSVGLength;
  cy: ParsedSVGLength;
  r: ParsedSVGLength;
  fx: ParsedSVGLength;
  fy: ParsedSVGLength;
  fr: ParsedSVGLength;
}

export type PatternUnits = "objectBoundingBox" | "userSpaceOnUse";
export type MaskUnits = "objectBoundingBox" | "userSpaceOnUse";
export type ClipPathUnits = "objectBoundingBox" | "userSpaceOnUse";
export type MaskType = "alpha" | "luminance";
export type SVGBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export interface NodeCoordinateContext {
  viewport: { width: number; height: number };
  rootViewport: { width: number; height: number };
  fontMetrics: FontMetrics;
}

export interface MaskResource {
  id: string;
  x: ParsedSVGLength;
  y: ParsedSVGLength;
  width: ParsedSVGLength;
  height: ParsedSVGLength;
  units: MaskUnits;
  contentUnits: MaskUnits;
  maskType: MaskType;
  source: SourceLocation;
  element: ElementNode;
  contentElements: ElementNode[];
  children: RenderNode[];
  instances: Map<RenderNode, MaskInstance>;
  presentation: Readonly<Record<string, string | number>>;
}

export interface MaskInstance {
  resource?: MaskResource;
  maskType: MaskType;
  children: RenderNode[];
  region: RenderBounds;
  contentTransform: AffineTransform;
  invalid: boolean;
}

export interface MaskReference {
  id?: string;
  invalid: boolean;
}

export interface ClipPathResource {
  id: string;
  units: ClipPathUnits;
  source: SourceLocation;
  element: ElementNode;
  contentElements: ElementNode[];
  children: RenderNode[];
  instances: Map<RenderNode, ClipPathInstance>;
  presentation: Readonly<Record<string, string | number>>;
  provenance: Readonly<Record<string, CSSDiagnosticContext>>;
}

export interface ClipPathInstance {
  resource?: ClipPathResource;
  children: RenderNode[];
  contentTransform: AffineTransform;
  invalid: boolean;
}

export interface ClipPathReference {
  id?: string;
  invalid: boolean;
}

export interface PatternContentInstance {
  /** Children resolved in the coordinate context of one referencing shape. */
  children: RenderNode[];
}

export interface PatternPaint {
  type: "pattern";
  id: string;
  x: ParsedSVGLength;
  y: ParsedSVGLength;
  width: ParsedSVGLength;
  height: ParsedSVGLength;
  units: PatternUnits;
  contentUnits: PatternUnits;
  transform: AffineTransform;
  viewBox?: ViewBoxData;
  preserveAspectRatio: PreserveAspectRatio;
  overflow: string;
  href?: string;
  source: SourceLocation;
  /** Ordered shadow-tree content retained from the nearest template with children. */
  contentElements: ElementNode[];
  /** First materialized render-tree instance, useful for resource inspection. */
  children: RenderNode[];
  /** Per-reference render trees preserve nested viewport percentage semantics. */
  instances: Map<RenderShape, PatternContentInstance>;
  /** Computed presentation inherited by shadow-tree children. */
  presentation: Readonly<Record<string, string | number>>;
  /** Set when nested use/paint dependency analysis finds a cycle. */
  invalid: boolean;
}

export interface InvalidPaintServer {
  type: "invalid" | "unsupported";
  id: string;
  element: string;
  source: SourceLocation;
}

export type GradientPaint = LinearGradientPaint | RadialGradientPaint;
export type PaintServer = GradientPaint | PatternPaint | InvalidPaintServer;

export interface StrokeStyle {
  width: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "miter" | "round" | "bevel";
  miterLimit: number;
  dashArray?: number[];
  dashOffset: number;
  vectorEffect: "none" | "non-scaling-stroke";
}

export type PaintOrderPhase = "fill" | "stroke" | "markers";

export interface MarkerReference {
  id?: string;
  invalid: boolean;
}

export type MarkerUnits = "strokeWidth" | "userSpaceOnUse";
export type MarkerOrient = { type: "auto" | "auto-start-reverse" } | { type: "angle"; degrees: number };
export type MarkerRefCoordinate =
  | { type: "length"; value: ParsedSVGLength }
  | { type: "keyword"; value: "min" | "center" | "max" };

export interface MarkerResource {
  id: string;
  markerWidth: ParsedSVGLength;
  markerHeight: ParsedSVGLength;
  refX: MarkerRefCoordinate;
  refY: MarkerRefCoordinate;
  units: MarkerUnits;
  orient: MarkerOrient;
  viewBox?: ViewBoxData;
  preserveAspectRatio: PreserveAspectRatio;
  overflow: string;
  source: SourceLocation;
  element: ElementNode;
  contentElements: ElementNode[];
  children: RenderNode[];
  instances: Map<RenderShape, RenderGroup[]>;
  presentation: Readonly<Record<string, string | number>>;
  provenance: Readonly<Record<string, CSSDiagnosticContext>>;
}

/** Presentation properties after inheritance and inline-style precedence have been resolved. */
export interface ComputedStyle {
  fill: Paint;
  /** Authored fill retained for context-fill when the host geometry itself has no fill phase (for example line). */
  contextFill?: Paint;
  stroke: Paint;
  color: string;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  markerStart?: MarkerReference;
  markerMid?: MarkerReference;
  markerEnd?: MarkerReference;
  /** Complete SVG paint sequence after omitted phases are appended in default order. */
  paintOrder: readonly PaintOrderPhase[];
  fillRule: "nonzero" | "evenodd";
  clipRule: "nonzero" | "evenodd";
  display: string;
  visibility: string;
  clipPath?: ClipPathReference;
  mask?: MaskReference;
  blendMode: SVGBlendMode;
  isolation: "auto" | "isolate";
  strokeStyle: StrokeStyle;
  /** Typed values not yet consumed by issue #51, retained for later rendering tickets. */
  presentation: Readonly<Record<string, string | number>>;
  /** Winning CSS declaration context for inspectable cascade results. */
  provenance: Readonly<Record<string, CSSDiagnosticContext>>;
}

export type Geometry =
  | { type: "path"; d: string; pathLength?: string }
  | { type: "circle"; cx: number; cy: number; r: number; pathLength?: string }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number; pathLength?: string }
  | { type: "rect"; x: number; y: number; width: number; height: number; rx?: number; ry?: number; pathLength?: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; pathLength?: string }
  | { type: "polyline"; points: string; pathLength?: string }
  | { type: "polygon"; points: string; pathLength?: string };

export interface RenderShape {
  type: "shape";
  geometry: Geometry;
  style: ComputedStyle;
  transform: AffineTransform;
  source: SourceLocation;
  /** Coordinate context at the referencing element, retained for user-space paint percentages. */
  paintContext: NodeCoordinateContext;
  clipPath?: ClipPathInstance;
  mask?: MaskInstance;
  /** Materialized marker shadow trees in SVG vertex order. */
  markers?: RenderGroup[];
}

export interface MarkerPlacement {
  kind: "start" | "mid" | "end";
  x: number;
  y: number;
  angle: number;
  unitScale: number;
  refX: number;
  refY: number;
  viewBoxTransform: AffineTransform;
}

export interface RenderGroup {
  type: "group";
  children: RenderNode[];
  style: ComputedStyle;
  transform: AffineTransform;
  source: SourceLocation;
  paintContext: NodeCoordinateContext;
  clipPath?: ClipPathInstance;
  mask?: MaskInstance;
  /** Present only on a marker shadow-tree root. */
  markerPlacement?: MarkerPlacement;
  /** True when this group came from a referenced definition. */
  referenceId?: string;
  /** Semantic viewport data retained for clipping and later coordinate-space consumers. */
  viewport?: {
    rect: ViewBoxData;
    viewBox?: ViewBoxData;
    preserveAspectRatio: PreserveAspectRatio;
    overflow: string;
    clip: boolean;
    zeroSized: boolean;
    /** Transform applied outside the viewport rectangle; excludes the viewBox mapping. */
    clipTransform: AffineTransform;
  };
}

export interface RenderText {
  type: "text";
  text: string;
  chunks: RenderTextChunk[];
  attributes: Readonly<Record<string, string | number>>;
  style: ComputedStyle;
  transform: AffineTransform;
  source: SourceLocation;
  paintContext: NodeCoordinateContext;
  clipPath?: ClipPathInstance;
  mask?: MaskInstance;
}

export interface RenderTextChunk {
  x?: number;
  y?: number;
  runs: RenderTextRun[];
  anchor: "start" | "middle" | "end";
  direction: "ltr" | "rtl";
  writingMode: "horizontal-tb" | "vertical-rl" | "vertical-lr";
  lengthAdjustments: RenderTextLengthAdjustment[];
  textPath?: RenderTextPath;
}

export interface RenderTextCharacter {
  /** One extended grapheme cluster; never a UTF-16 code unit. */
  text: string;
  dx: number;
  dy: number;
  rotate: number;
}

export interface RenderTextLengthAdjustment {
  /** Character range local to the containing chunk. */
  start: number;
  end: number;
  target: number;
  mode: "spacing" | "spacingAndGlyphs";
}

export interface RenderTextPathPoint {
  x: number;
  y: number;
  distance: number;
  /** True when this point begins a new subpath; no segment joins it to the previous point. */
  move: boolean;
}

export interface RenderTextPath {
  points: RenderTextPathPoint[];
  length: number;
  closed: boolean;
  /** Converts authored path-distance units (pathLength) into actual user units. */
  distanceScale: number;
  startOffset: number;
  method: "align" | "stretch";
  spacing: "auto" | "exact";
  side: "left" | "right";
  source: SourceLocation;
}

export interface RenderTextRun {
  text: string;
  characters: RenderTextCharacter[];
  dx: number;
  dy: number;
  font: {
    family: string;
    size: number;
    weight: number;
    width: number;
    italic: boolean;
    smallCaps: boolean;
    sizeAdjust?: number;
  };
  letterSpacing: number;
  wordSpacing: number;
  kerning: boolean;
  baseline: "alphabetic" | "middle" | "central" | "hanging" | "text-before-edge" | "text-after-edge";
  baselineShift: number;
  decoration: readonly ("underline" | "overline" | "line-through")[];
  direction: "ltr" | "rtl";
  unicodeBidi: "normal" | "embed" | "isolate" | "bidi-override" | "isolate-override" | "plaintext";
  textOrientation: "mixed" | "upright" | "sideways";
  style: ComputedStyle;
  transform: AffineTransform;
  source: SourceLocation;
}

export interface RenderImage {
  type: "image";
  href: string;
  viewport: ViewBoxData;
  preserveAspectRatio: PreserveAspectRatio;
  imageRendering: string;
  resource?:
    | {
        type: "raster";
        bytes?: Uint8Array;
        mimeType: string;
        canonicalURL: string;
        assetName?: string;
        intrinsicSize?: { width: number; height: number };
      }
    | {
        type: "svg";
        canonicalURL: string;
        document: RenderDocument;
        referencedPreserveAspectRatio: PreserveAspectRatio;
        hasReferencedPreserveAspectRatio: boolean;
      };
  attributes: Readonly<Record<string, string | number>>;
  style: ComputedStyle;
  transform: AffineTransform;
  source: SourceLocation;
  paintContext: NodeCoordinateContext;
  clipPath?: ClipPathInstance;
  mask?: MaskInstance;
}

/** The union is intentionally extensible for clip, mask, filter, marker, and foreign-object nodes. */
export type RenderNode = RenderGroup | RenderShape | RenderText | RenderImage;

export interface ResourceRegistry {
  definitions: Map<string, ElementNode>;
  /** Document ancestry used to resolve transformed geometry references. */
  parents: Map<ElementNode, ElementNode>;
  symbols: Map<string, ElementNode>;
  /** Typed paint resources consumed by the renderer. */
  paints: Map<string, PaintServer>;
  /** Original paint elements retained for future pattern/resource resolvers. */
  paintElements: Map<string, ElementNode>;
  clips: Map<string, ClipPathResource>;
  clipElements: Map<string, ElementNode>;
  masks: Map<string, MaskResource>;
  maskElements: Map<string, ElementNode>;
  markers: Map<string, MarkerResource>;
  markerElements: Map<string, ElementNode>;
  filters: Map<string, ElementNode>;
  views: Map<string, ElementNode>;
}

export interface RenderDocument {
  viewport: {
    width: number;
    height: number;
    viewBox: ViewBoxData;
    userViewport: { width: number; height: number };
    preserveAspectRatio: PreserveAspectRatio;
    coordinateSpace: ViewBoxData;
    zeroSized: boolean;
  };
  resources: ResourceRegistry;
  children: RenderNode[];
  diagnostics: RenderDiagnostic[];
}

/** Axis-aligned painted bounds in the root generated-view coordinate space. */
export interface RenderBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type OutputMode = "shape" | "view";

export interface CapabilityDecision {
  mode: OutputMode;
  reasons: string[];
  paintCount: number;
}
