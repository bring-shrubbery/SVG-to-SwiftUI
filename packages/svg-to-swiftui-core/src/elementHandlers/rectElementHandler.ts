import type { ElementNode } from "svg-parser";

import type { SVGRectAttributes } from "../svgTypes";
import type { TranspilerOptions } from "../types";
import { clampNormalisedSizeProduct, formatRoundedNumber, normaliseRectValues, stringifyRectValues } from "../utils";
import handlePathElement from "./pathElementHandler";
import { resolvedGeometryNumber } from "./resolvedGeometry";

export default function handleRectElement(element: ElementNode, options: TranspilerOptions): string[] {
  const props = element.properties;

  if (props) {
    const rectProps = props as unknown as SVGRectAttributes;

    // Set default values
    rectProps.x = rectProps.x ?? "0";
    rectProps.y = rectProps.y ?? "0";

    // Check if required properties are provided.
    if (rectProps.width === undefined || rectProps.height === undefined) {
      throw new Error("Rectangle has to have width and height properties!");
    }

    // Parse numbers from the strings, expanding by stroke if fill+stroke.
    const exp = options.strokeExpansion || 0;
    const x = resolvedGeometryNumber(rectProps.x) - exp;
    const y = resolvedGeometryNumber(rectProps.y) - exp;
    const width = resolvedGeometryNumber(rectProps.width) + 2 * exp;
    const height = resolvedGeometryNumber(rectProps.height) + 2 * exp;

    // Parse corner radii. SVG spec: rx defaults to ry and vice versa.
    const rxRaw = rectProps.rx === undefined ? undefined : resolvedGeometryNumber(rectProps.rx);
    const ryRaw = rectProps.ry === undefined ? undefined : resolvedGeometryNumber(rectProps.ry);
    const rx = Math.min(Math.abs(rxRaw ?? ryRaw ?? 0), width / 2);
    const ry = Math.min(Math.abs(ryRaw ?? rxRaw ?? 0), height / 2);

    if (options.resolvedStyle?.strokeStyle.dashArray) {
      const right = x + width;
      const bottom = y + height;
      const d =
        rx > 0 && ry > 0
          ? [
              `M${x + rx} ${y}`,
              `H${right - rx}`,
              `A${rx} ${ry} 0 0 1 ${right} ${y + ry}`,
              `V${bottom - ry}`,
              `A${rx} ${ry} 0 0 1 ${right - rx} ${bottom}`,
              `H${x + rx}`,
              `A${rx} ${ry} 0 0 1 ${x} ${bottom - ry}`,
              `V${y + ry}`,
              `A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`,
            ].join(" ")
          : `M${x} ${y}H${right}V${bottom}H${x}Z`;
      return handlePathElement({ ...element, tagName: "path", properties: { ...element.properties, d } }, options);
    }

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

    if (rx > 0 || ry > 0) {
      // Normalise corner radii relative to viewBox
      const nRx = rx / options.viewBox.width;
      const nRy = ry / options.viewBox.height;
      const toFixed = (v: number) => formatRoundedNumber(v, options.precision);
      const strRx = clampNormalisedSizeProduct(toFixed(nRx), "width");
      const strRy = clampNormalisedSizeProduct(toFixed(nRy), "height");

      return [`path.addRoundedRect(in: ${CGRect}, cornerSize: CGSize(width: ${strRx}, height: ${strRy}))`];
    }

    return [`path.addRect(${CGRect})`];
  } else {
    throw new Error("Rectangle element has to have properties!");
  }
}
