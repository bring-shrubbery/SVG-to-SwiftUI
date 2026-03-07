import type { ElementNode } from "svg-parser";

import type { TranspilerOptions } from "../types";
import { clampNormalisedSizeProduct } from "../utils";

interface SVGLineAttributes {
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
}

export default function handleLineElement(
  element: ElementNode,
  options: TranspilerOptions,
): string[] {
  const props = element.properties;

  if (!props) {
    throw new Error("Line element has to have properties!");
  }

  const lineProps = props as unknown as SVGLineAttributes;

  const x1 = parseFloat(lineProps.x1 || "0");
  const y1 = parseFloat(lineProps.y1 || "0");
  const x2 = parseFloat(lineProps.x2 || "0");
  const y2 = parseFloat(lineProps.y2 || "0");

  const toFixed = (v: number) =>
    v.toFixed(options.precision).replace(/0+$/, "");

  const nx1 = x1 / options.viewBox.width;
  const ny1 = y1 / options.viewBox.height;
  const nx2 = x2 / options.viewBox.width;
  const ny2 = y2 / options.viewBox.height;

  const sx1 = clampNormalisedSizeProduct(toFixed(nx1), "width");
  const sy1 = clampNormalisedSizeProduct(toFixed(ny1), "height");
  const sx2 = clampNormalisedSizeProduct(toFixed(nx2), "width");
  const sy2 = clampNormalisedSizeProduct(toFixed(ny2), "height");

  return [
    `path.move(to: CGPoint(x: ${sx1}, y: ${sy1}))`,
    `path.addLine(to: CGPoint(x: ${sx2}, y: ${sy2}))`,
  ];
}
