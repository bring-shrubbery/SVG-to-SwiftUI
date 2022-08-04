import {clampNormalisedSizeProduct, stringifyRectValues} from '../../utils';
import {SwiftGenerator} from '../types';

export const generateLineToSwift: SwiftGenerator<{x: number; y: number}> = (
  data,
  options
) => {
  const xy = stringifyRectValues(
    {
      x: data.x / options.viewBox.width,
      y: data.y / options.viewBox.height,
    },
    options.precision
  );

  const new_x = clampNormalisedSizeProduct(xy.x, 'width');
  const new_y = clampNormalisedSizeProduct(xy.y, 'height');

  return [`path.addLine(to: CGPoint(x: ${new_x}, y: ${new_y}))`];
};
