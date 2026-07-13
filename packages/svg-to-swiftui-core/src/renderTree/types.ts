import type { ElementNode } from "svg-parser";
import type { AffineTransform } from "../transformUtils";
import type { ViewBoxData } from "../types";
import type { PreserveAspectRatio } from "../viewports";

/** Identifies the SVG source that produced a render-tree node or diagnostic. */
export interface SourceLocation {
  element: string;
  id?: string;
}

export type DiagnosticSeverity = "warning" | "error";

/** A structured conversion diagnostic. Later features can add codes without changing the public converter API. */
export interface RenderDiagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  source: SourceLocation;
}

/** SVG paint is deliberately semantic; Swift source is only introduced by the generator. */
export type Paint =
  | { type: "none" }
  | { type: "solid"; value: string }
  | { type: "reference"; id: string; fallback?: string };

export interface StrokeStyle {
  width: number;
  lineCap: string;
  lineJoin: string;
  miterLimit: number;
  dashArray?: number[];
  dashOffset: number;
}

/** Presentation properties after inheritance and inline-style precedence have been resolved. */
export interface ComputedStyle {
  fill: Paint;
  stroke: Paint;
  color: string;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  fillRule: "nonzero" | "evenodd";
  clipRule: "nonzero" | "evenodd";
  display: string;
  visibility: string;
  strokeStyle: StrokeStyle;
  /** Typed values not yet consumed by issue #51, retained for later rendering tickets. */
  presentation: Readonly<Record<string, string | number>>;
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
}

export interface RenderGroup {
  type: "group";
  children: RenderNode[];
  style: ComputedStyle;
  transform: AffineTransform;
  source: SourceLocation;
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
  attributes: Readonly<Record<string, string | number>>;
  style: ComputedStyle;
  transform: AffineTransform;
  source: SourceLocation;
}

export interface RenderImage {
  type: "image";
  href: string;
  attributes: Readonly<Record<string, string | number>>;
  style: ComputedStyle;
  transform: AffineTransform;
  source: SourceLocation;
}

/** The union is intentionally extensible for clip, mask, filter, marker, and foreign-object nodes. */
export type RenderNode = RenderGroup | RenderShape | RenderText | RenderImage;

export interface ResourceRegistry {
  definitions: Map<string, ElementNode>;
  symbols: Map<string, ElementNode>;
  paints: Map<string, ElementNode>;
  clips: Map<string, ElementNode>;
  masks: Map<string, ElementNode>;
  markers: Map<string, ElementNode>;
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

export type OutputMode = "shape" | "view";

export interface CapabilityDecision {
  mode: OutputMode;
  reasons: string[];
  paintCount: number;
}
