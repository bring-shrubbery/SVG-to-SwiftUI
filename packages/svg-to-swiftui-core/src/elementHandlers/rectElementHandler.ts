import type { ElementNode } from "svg-parser";

import type { SVGRectAttributes } from "../svgTypes";
import type { TranspilerOptions } from "../types";
import {
  clampNormalisedSizeProduct,
  normaliseRectValues,
  stringifyRectValues,
} from "../utils";

export default function handleRectElement(
  element: ElementNode,
  options: TranspilerOptions,
): string[] {
  // TODO: Add style support
  // const style = {
  //   ...options.parentStyle,
  //   ...extractStyle(element),
  // };

  const props = element.properties;

  if (props) {
    const circleProps = props as unknown as SVGRectAttributes;

    // Set default values
    circleProps.x = circleProps.x || "0";
    circleProps.y = circleProps.y || "0";

    // Check if required properties are provided.
    if (!circleProps.width || !circleProps.height) {
      throw new Error("Rectangle has to have width and height properties!");
    }

    // Parse numbers from the striings.
    const x = parseFloat(circleProps.x);
    const y = parseFloat(circleProps.y);
    const width = parseFloat(circleProps.width);
    const height = parseFloat(circleProps.height);

    // Normalise all values to be based on fraction of width/height.
    const normalisedRect = normaliseRectValues(
      { x, y, width, height },
      options.viewBox,
    );

    // Stringify values to the fixed precision point.
    const SR = stringifyRectValues(normalisedRect, options.precision);

    // Append the width and height multipliers after normalisation.
    const strX = clampNormalisedSizeProduct(SR.x, "width");
    const strY = clampNormalisedSizeProduct(SR.y, "height");
    const strWidth = clampNormalisedSizeProduct(SR.width ?? "unknown", "width");
    const strHeight = clampNormalisedSizeProduct(
      SR.height ?? "unknown",
      "height",
    );

    // Generate SwiftUI string.
    const CGRect = `CGRect(x: ${strX}, y: ${strY}, width: ${strWidth}, height: ${strHeight})`;
    return [`path.addRect(${CGRect})`];
  } else {
    throw new Error("Circle element has to some properties");
  }
}
