import {ElementNode, RootNode} from 'svg-parser';
import {extractStyle} from '../styleUtils';
import {TranspilerOptions} from '../types';
import {handleElement} from './index';

/**
 * Transforms SVG group element into SwiftUI Shape by
 * accumulating subcomands of the children.
 * @param element Group element node
 * @param options Transpiler options
 */
export default function handleGroupElement(
  element: ElementNode | RootNode,
  options: TranspilerOptions
): string[] {
  const {children} = element;
  const style = element.type === 'element' ? extractStyle(element) : {};

  // For each child run the generator, accumulate swift string and return it.
  const acc: string[] = [];

  for (const child of children) {
    // TODO: Handle string children properly.
    if (typeof child === 'string') continue;

    // TODO: Handle TextNode children properly.
    if (child.type === 'text') continue;

    // Append result to the accumulator.
    acc.push(
      ...handleElement(child, {
        ...options,
        ...style,
      })
    );
  }

  return acc;
}
