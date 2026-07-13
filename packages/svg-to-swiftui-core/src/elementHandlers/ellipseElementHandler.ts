import type { ElementNode } from "svg-parser";

import type { SVGEllipseAttributes } from "../svgTypes";
import type { TranspilerOptions } from "../types";
import { clampNormalisedSizeProduct, normaliseRectValues, stringifyRectValues } from "../utils";
import { resolvedGeometryNumber } from "./resolvedGeometry";

export default function handleEllipseElement(element: ElementNode, options: TranspilerOptions): string[] {
  // TODO: style
  const props = element.properties;
  if (props) {
    const ellipseProps = props as unknown as SVGEllipseAttributes;

    // Ellipse properties requirement check
    // Parse string
    const cx = resolvedGeometryNumber(ellipseProps.cx, 0);
    const cy = resolvedGeometryNumber(ellipseProps.cy, 0);
    const rx = resolvedGeometryNumber(ellipseProps.rx, 0) + (options.strokeExpansion || 0);
    const ry = resolvedGeometryNumber(ellipseProps.ry, 0) + (options.strokeExpansion || 0);

    // Get size variables
    const x = cx - rx;
    const y = cy - ry;
    const width = rx * 2;
    const height = ry * 2;

    // Normalization
    const normalizedRect = normaliseRectValues({ x, y, width, height }, options.viewBox);

    const SR = stringifyRectValues(normalizedRect, options.precision);
    const strX = clampNormalisedSizeProduct(SR.x, "width");
    const strY = clampNormalisedSizeProduct(SR.y, "height");
    const strWidth = clampNormalisedSizeProduct(SR.width ?? "unknown", "width");
    const strHeight = clampNormalisedSizeProduct(SR.height ?? "unknown", "height");

    // Generate SwiftUI string
    const CGrect = `CGRect(x: ${strX}, y: ${strY}, width: ${strWidth}, height: ${strHeight})`;

    return [`path.addEllipse(in: ${CGrect})`];
  } else {
    throw new Error("Ellipse element has to some properties");
  }
}
