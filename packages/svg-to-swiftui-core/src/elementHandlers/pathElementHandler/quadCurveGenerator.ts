import {clampNormalisedSizeProduct, stringifyRectValues} from '../../utils';
import {SwiftGenerator} from '../types';

export const generateQuadCurveSwift: SwiftGenerator<{
  x1: number;
  y1: number;
  x: number;
  y: number;
}> = (data, options) => {
  // Convert raw values into width/height relative values.
  const xy = stringifyRectValues(
    {
      x: data.x / options.viewBox.width,
      y: data.y / options.viewBox.height,
    },
    options.precision
  );

  const xy1 = stringifyRectValues(
    {
      x: data.x1 / options.viewBox.width,
      y: data.y1 / options.viewBox.height,
    },
    options.precision
  );

  // Prepare string values.
  const x_str = clampNormalisedSizeProduct(xy.x, 'width');
  const y_str = clampNormalisedSizeProduct(xy.y, 'height');
  const x1_str = clampNormalisedSizeProduct(xy1.x, 'width');
  const y1_str = clampNormalisedSizeProduct(xy1.y, 'height');

  const swiftString = [
    `path.addQuadCurve(to: CGPoint(x: ${x_str}, y: ${y_str}),`,
    `control1: CGPoint(x: ${x1_str}, y: ${y1_str}))`,
  ].join(' ');

  return [swiftString];
};
