import type { ElementNode } from "svg-parser";

import type { SVGEllipseAttributes } from "../svgTypes";
import type { TranspilerOptions } from "../types";
import {
  clampNormalisedSizeProduct,
  normaliseRectValues,
  stringifyRectValues,
} from "../utils";

export default function handleEllipseElement(
  element: ElementNode,
  options: TranspilerOptions,
): string[] {
  // TODO: style
  const props = element.properties;
  if (props) {
    const ellipseProps = props as unknown as SVGEllipseAttributes;

    // Ellipse properties requirement check
    if (
      !ellipseProps.cx ||
      !ellipseProps.cy ||
      !ellipseProps.rx ||
      !ellipseProps.ry
    ) {
      throw new Error(
        "Ellipse element has to contain cx, cy, rx and ry properties!",
      );
    }

    // Parse string
    const cx = parseFloat(ellipseProps.cx);
    const cy = parseFloat(ellipseProps.cy);
    const rx = parseFloat(ellipseProps.rx);
    const ry = parseFloat(ellipseProps.ry);

    // Get size variables
    const x = cx - rx;
    const y = cy - ry;
    const width = rx * 2;
    const height = ry * 2;

    // Normalization
    const normalizedRect = normaliseRectValues(
      { x, y, width, height },
      options.viewBox,
    );

    const SR = stringifyRectValues(normalizedRect, options.precision);
    const strX = clampNormalisedSizeProduct(SR.x, "width");
    const strY = clampNormalisedSizeProduct(SR.y, "height");
    const strWidth = clampNormalisedSizeProduct(SR.width ?? "unknown", "width");
    const strHeight = clampNormalisedSizeProduct(
      SR.height ?? "unknown",
      "height",
    );

    // Generate SwiftUI string
    const CGrect = `CGRect(x: ${strX}, y: ${strY}, width: ${strWidth}, height: ${strHeight})`;

    return [`path.addEllipse(in: ${CGrect})`];
  } else {
    throw new Error("Ellipse element has to some properties");
  }
}
