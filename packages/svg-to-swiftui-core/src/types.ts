export interface SwiftUIGeneratorConfig {
  structName?: string;
  precision?: number;
  indentationSize?: number;
  usageCommentPrefix?: boolean;
  /** Preserve SVG paints in a layered View. Defaults to automatic detection for multicolor SVGs. */
  preserveColors?: boolean;
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
  /** Active SVG fill-rule for the current path: "nonzero" | "evenodd". */
  fillRule: string;
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
}
