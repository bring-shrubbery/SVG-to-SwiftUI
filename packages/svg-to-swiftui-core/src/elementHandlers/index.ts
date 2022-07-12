import {ElementNode} from 'svg-parser';
import {TranspilerOptions} from '../types';
import handleCircleElement from './circleElementHandler';
import handleEllipseElement from './ellipseElementHandler';
import handleGroupElement from './groupElementHandler';
import handlePathElement from './pathElementHandler';
import handleRectElement from './rectElementHandler';

export function handleElement(
  element: ElementNode,
  options: TranspilerOptions
): string[] {
  switch (element.tagName) {
    case 'g':
      return handleGroupElement(element, options);

    case 'svg':
      return handleGroupElement(element, options);

    case 'path':
      return handlePathElement(element, options);

    case 'circle':
      return handleCircleElement(element, options);

    case 'rect':
      return handleRectElement(element, options);

    case 'ellipse':
      return handleEllipseElement(element, options);

    default:
      console.error(
        [
          `Element <${element.tagName}> is not supported!`,
          'Please open a Github issue for this or send a PR with the implementation!',
        ].join('\n')
      );
      return [];
  }
}
