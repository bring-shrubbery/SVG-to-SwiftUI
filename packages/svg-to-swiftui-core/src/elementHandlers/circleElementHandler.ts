import {ElementNode} from 'svg-parser';
import {SVGCircleAttributes} from '../svgTypes';
import {TranspilerOptions} from '../types';
import {
  clampNormalisedSizeProduct,
  normaliseRectValues,
  stringifyRectValues,
} from '../utils';

export default function handleCircleElement(
  element: ElementNode,
  options: TranspilerOptions
): string[] {
  // TODO: Add styles support
  // const style = {
  //   ...options.parentStyle,
  //   ...extractStyle(element),
  // };

  const props = element.properties;

  if (props) {
    const circleProps = props as unknown as SVGCircleAttributes;

    // Check if required properties are provided.
    if (!circleProps.cx || !circleProps.cy || !circleProps.r) {
      throw new Error(
        'Circle element has to contain cx, cy, and r properties!'
      );
    }

    // Parse numbers from the striings.
    const cx = parseFloat(circleProps.cx);
    const cy = parseFloat(circleProps.cy);
    const r = parseFloat(circleProps.r);

    // Convert center-radius to bounding box.
    const x = cx - r;
    const y = cy - r;
    const width = r * 2;
    const height = r * 2;

    // Normalise all values to be based on fraction of width/height.
    const normalisedRect = normaliseRectValues(
      {x, y, width, height},
      options.viewBox
    );

    // Stringify values to the fixed precision point.
    const SR = stringifyRectValues(normalisedRect, options.precision);

    // Append the width and height multipliers after normalisation.
    const strX = clampNormalisedSizeProduct(SR.x, 'width');
    const strY = clampNormalisedSizeProduct(SR.y, 'height');
    const strWidth = clampNormalisedSizeProduct(SR.width!, 'width');
    const strHeight = clampNormalisedSizeProduct(SR.height!, 'height');

    // Generate SwiftUI string.
    const CGRect = `CGRect(x: ${strX}, y: ${strY}, width: ${strWidth}, height: ${strHeight})`;
    return [`path.addEllipse(in: ${CGRect})`];
  } else {
    throw new Error('Circle element has to some properties');
  }
}
