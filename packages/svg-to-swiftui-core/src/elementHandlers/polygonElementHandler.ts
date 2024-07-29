import {ElementNode} from 'svg-parser';
import {SVGPolygonAttributes} from '../svgTypes';
import {TranspilerOptions} from '../types';
import { generateMoveToSwift } from './pathElementHandler/moveToGenerator';
import { generateLineToSwift } from './pathElementHandler/lineToGenerator';

export default function handlePolygonElement(
  element: ElementNode,
  options: TranspilerOptions
): string[] {
  const swiftAccumulator: string[] = [];
  // TODO: style
  const props = element.properties;
  if (props) {
    const ellipseProps = props as unknown as SVGPolygonAttributes;

    const width = options.width;
    const height = options.height;

    const points = ellipseProps.points as string;

    if (points) {
      // Split the string by spaces to get each coordinate pair
      const pairs = points.split(' ');

      var firstPoint = true;
      // Map each pair to corresponding point in path
      const coordinates = pairs.map(pair => {
        const [x, y] = pair.split(',').map(Number);
        if (x && y) {
          if (firstPoint) {
            swiftAccumulator.push(...generateMoveToSwift({x, y}, options));
          } else {
            swiftAccumulator.push(...generateLineToSwift({x, y}, options));
          }
          firstPoint = false;
        }
      });
      return swiftAccumulator;
    }
    return [];
  } else {
    throw new Error('Polygon element should have some properties');
  }
}
