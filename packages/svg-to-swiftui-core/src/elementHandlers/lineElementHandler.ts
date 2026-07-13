import type { ElementNode } from "svg-parser";

import type { TranspilerOptions } from "../types";
import { clampNormalisedSizeProduct, formatRoundedNumber } from "../utils";
import { resolvedGeometryNumber } from "./resolvedGeometry";

interface SVGLineAttributes {
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
}

export default function handleLineElement(element: ElementNode, options: TranspilerOptions): string[] {
  const props = element.properties;

  if (!props) {
    throw new Error("Line element has to have properties!");
  }

  const lineProps = props as unknown as SVGLineAttributes;

  const x1 = resolvedGeometryNumber(lineProps.x1, 0);
  const y1 = resolvedGeometryNumber(lineProps.y1, 0);
  const x2 = resolvedGeometryNumber(lineProps.x2, 0);
  const y2 = resolvedGeometryNumber(lineProps.y2, 0);

  const toFixed = (v: number) => formatRoundedNumber(v, options.precision);

  const nx1 = (x1 - options.viewBox.x) / options.viewBox.width;
  const ny1 = (y1 - options.viewBox.y) / options.viewBox.height;
  const nx2 = (x2 - options.viewBox.x) / options.viewBox.width;
  const ny2 = (y2 - options.viewBox.y) / options.viewBox.height;

  const sx1 = clampNormalisedSizeProduct(toFixed(nx1), "width");
  const sy1 = clampNormalisedSizeProduct(toFixed(ny1), "height");
  const sx2 = clampNormalisedSizeProduct(toFixed(nx2), "width");
  const sy2 = clampNormalisedSizeProduct(toFixed(ny2), "height");

  return [`path.move(to: CGPoint(x: ${sx1}, y: ${sy1}))`, `path.addLine(to: CGPoint(x: ${sx2}, y: ${sy2}))`];
}
