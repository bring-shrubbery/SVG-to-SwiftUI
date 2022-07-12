import {clampNormalisedSizeProduct, stringifyRectValues} from '../../utils';
import {SwiftGenerator} from '../types';

export const generateCubicCurveSwift: SwiftGenerator<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
}> = (data, options) => {
  // Convert raw values into width/height relative values.
  const xy1 = stringifyRectValues(
    {
      x: data.x1 / options.viewBox.width,
      y: data.y1 / options.viewBox.height,
    },
    options.precision
  );

  const xy2 = stringifyRectValues(
    {
      x: data.x2 / options.viewBox.width,
      y: data.y2 / options.viewBox.height,
    },
    options.precision
  );

  const xy = stringifyRectValues(
    {
      x: data.x / options.viewBox.width,
      y: data.y / options.viewBox.height,
    },
    options.precision
  );

  // Prepare string values.
  const p1x_str = clampNormalisedSizeProduct(xy.x, 'width');
  const p1y_str = clampNormalisedSizeProduct(xy.y, 'height');
  const p2x_str = clampNormalisedSizeProduct(xy1.x, 'width');
  const p2y_str = clampNormalisedSizeProduct(xy1.y, 'height');
  const p3x_str = clampNormalisedSizeProduct(xy2.x, 'width');
  const p3y_str = clampNormalisedSizeProduct(xy2.y, 'height');

  const swiftString = [
    `path.addCurve(to: CGPoint(x: ${p1x_str}, y: ${p1y_str}),`,
    `control1: CGPoint(x: ${p2x_str}, y: ${p2y_str}),`,
    `control2: CGPoint(x: ${p3x_str}, y: ${p3y_str}))`,
  ].join(' ');

  return [swiftString];
};
