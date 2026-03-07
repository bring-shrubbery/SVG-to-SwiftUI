import type { ElementNode } from "svg-parser";

import type { TranspilerOptions } from "../types";
import { parsePointsToSwift } from "./polylineElementHandler";

export default function handlePolygonElement(
  element: ElementNode,
  options: TranspilerOptions,
): string[] {
  const props = element.properties;

  if (!props) {
    throw new Error("Polygon element has to have properties!");
  }

  const points = String(props.points || "").trim();
  if (!points) {
    throw new Error("Polygon element must have a points attribute!");
  }

  return parsePointsToSwift(points, options, true);
}
