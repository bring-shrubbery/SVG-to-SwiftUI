import type { ElementNode } from "svg-parser";

import type { TranspilerOptions } from "../types";
import { clampNormalisedSizeProduct } from "../utils";

export default function handlePolylineElement(
  element: ElementNode,
  options: TranspilerOptions,
): string[] {
  const props = element.properties;

  if (!props) {
    throw new Error("Polyline element has to have properties!");
  }

  const points = String(props.points || "").trim();
  if (!points) {
    throw new Error("Polyline element must have a points attribute!");
  }

  return parsePointsToSwift(points, options, false);
}

export function parsePointsToSwift(
  points: string,
  options: TranspilerOptions,
  closePath: boolean,
): string[] {
  // Parse "x1,y1 x2,y2 ..." or "x1 y1 x2 y2 ..."
  const nums = points
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map(parseFloat);

  if (nums.length < 4 || nums.length % 2 !== 0) {
    throw new Error("Points attribute must contain pairs of coordinates!");
  }

  const toFixed = (v: number) =>
    v.toFixed(options.precision).replace(/0+$/, "");

  const lines: string[] = [];

  for (let i = 0; i < nums.length; i += 2) {
    const nx = nums[i]! / options.viewBox.width;
    const ny = nums[i + 1]! / options.viewBox.height;
    const sx = clampNormalisedSizeProduct(toFixed(nx), "width");
    const sy = clampNormalisedSizeProduct(toFixed(ny), "height");

    if (i === 0) {
      lines.push(`path.move(to: CGPoint(x: ${sx}, y: ${sy}))`);
    } else {
      lines.push(`path.addLine(to: CGPoint(x: ${sx}, y: ${sy}))`);
    }
  }

  if (closePath) {
    lines.push("path.closeSubpath()");
  }

  return lines;
}
