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
  const props = element.properties;

  if (props) {
    const rectProps = props as unknown as SVGRectAttributes;

    // Set default values
    rectProps.x = rectProps.x || "0";
    rectProps.y = rectProps.y || "0";

    // Check if required properties are provided.
    if (!rectProps.width || !rectProps.height) {
      throw new Error("Rectangle has to have width and height properties!");
    }

    // Parse numbers from the strings, expanding by stroke if fill+stroke.
    const exp = options.strokeExpansion || 0;
    const x = parseFloat(rectProps.x) - exp;
    const y = parseFloat(rectProps.y) - exp;
    const width = parseFloat(rectProps.width) + 2 * exp;
    const height = parseFloat(rectProps.height) + 2 * exp;

    // Parse corner radii. SVG spec: rx defaults to ry and vice versa.
    const rxRaw = rectProps.rx ? parseFloat(rectProps.rx) : undefined;
    const ryRaw = rectProps.ry ? parseFloat(rectProps.ry) : undefined;
    const rx = rxRaw ?? ryRaw ?? 0;
    const ry = ryRaw ?? rxRaw ?? 0;

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
    const strWidth = clampNormalisedSizeProduct(
      SR.width ?? "unknown",
      "width",
    );
    const strHeight = clampNormalisedSizeProduct(
      SR.height ?? "unknown",
      "height",
    );

    // Generate SwiftUI string.
    const CGRect = `CGRect(x: ${strX}, y: ${strY}, width: ${strWidth}, height: ${strHeight})`;

    if (rx > 0 || ry > 0) {
      // Normalise corner radii relative to viewBox
      const nRx = rx / options.viewBox.width;
      const nRy = ry / options.viewBox.height;
      const toFixed = (v: number) =>
        v.toFixed(options.precision).replace(/0+$/, "");
      const strRx = clampNormalisedSizeProduct(toFixed(nRx), "width");
      const strRy = clampNormalisedSizeProduct(toFixed(nRy), "height");

      return [
        `path.addRoundedRect(in: ${CGRect}, cornerSize: CGSize(width: ${strRx}, height: ${strRy}))`,
      ];
    }

    return [`path.addRect(${CGRect})`];
  } else {
    throw new Error("Rectangle element has to have properties!");
  }
}
