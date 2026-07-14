import type { ElementNode } from "svg-parser";

import type { SVGCircleAttributes } from "../svgTypes";
import type { TranspilerOptions } from "../types";
import { clampNormalisedSizeProduct, normaliseRectValues, stringifyRectValues } from "../utils";
import handlePathElement from "./pathElementHandler";
import { resolvedGeometryNumber } from "./resolvedGeometry";

export default function handleCircleElement(element: ElementNode, options: TranspilerOptions): string[] {
  // TODO: Add styles support
  // const style = {
  //   ...options.parentStyle,
  //   ...extractStyle(element),
  // };

  const props = element.properties;

  if (props) {
    const circleProps = props as unknown as SVGCircleAttributes;

    // Check if required properties are provided.
    // Parse numbers from the strings, expanding by stroke if fill+stroke.
    const cx = resolvedGeometryNumber(circleProps.cx, 0);
    const cy = resolvedGeometryNumber(circleProps.cy, 0);
    const r = resolvedGeometryNumber(circleProps.r, 0) + (options.strokeExpansion || 0);

    if (options.resolvedStyle?.strokeStyle.dashArray) {
      const d = [
        `M${cx + r} ${cy}`,
        `A${r} ${r} 0 0 1 ${cx} ${cy + r}`,
        `A${r} ${r} 0 0 1 ${cx - r} ${cy}`,
        `A${r} ${r} 0 0 1 ${cx} ${cy - r}`,
        `A${r} ${r} 0 0 1 ${cx + r} ${cy}Z`,
      ].join(" ");
      return handlePathElement({ ...element, tagName: "path", properties: { ...element.properties, d } }, options);
    }

    // Convert center-radius to bounding box.
    const x = cx - r;
    const y = cy - r;
    const width = r * 2;
    const height = r * 2;

    // Normalise all values to be based on fraction of width/height.
    const normalisedRect = normaliseRectValues({ x, y, width, height }, options.viewBox);

    // Stringify values to the fixed precision point.
    const SR = stringifyRectValues(normalisedRect, options.precision);

    // Append the width and height multipliers after normalisation.
    const strX = clampNormalisedSizeProduct(SR.x, "width");
    const strY = clampNormalisedSizeProduct(SR.y, "height");
    const strWidth = clampNormalisedSizeProduct(SR.width ?? "unknown", "width");
    const strHeight = clampNormalisedSizeProduct(SR.height ?? "unknown", "height");

    // Generate SwiftUI string.
    const CGRect = `CGRect(x: ${strX}, y: ${strY}, width: ${strWidth}, height: ${strHeight})`;
    return [`path.addEllipse(in: ${CGRect})`];
  } else {
    throw new Error("Circle element has to some properties");
  }
}
