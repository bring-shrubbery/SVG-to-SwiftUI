import type { ElementNode, RootNode } from "svg-parser";

import type { TranspilerOptions } from "../types";
import { extractStyle } from "../styleUtils";
import { handleElement } from "./index";

/**
 * Transforms SVG group element into SwiftUI Shape by
 * accumulating subcomands of the children.
 * @param element Group element node
 * @param options Transpiler options
 */
export default function handleGroupElement(
  element: ElementNode | RootNode,
  options: TranspilerOptions,
): string[] {
  const { children } = element;
  let ownStyle: Record<string, string | number> = {};
  try {
    ownStyle = element.type === "element" ? extractStyle(element) : {};
  } catch {
    // no style to extract
  }

  // Merge this group's style into the inherited parent style chain
  const mergedParentStyle = { ...options.parentStyle, ...ownStyle };

  // For each child run the generator, accumulate swift string and return it.
  const acc: string[] = [];

  for (const child of children) {
    // TODO: Handle string children properly.
    if (typeof child === "string") continue;

    // TODO: Handle TextNode children properly.
    if (child.type === "text") continue;

    // Create child options with inherited style
    const childOptions: TranspilerOptions = {
      ...options,
      parentStyle: mergedParentStyle,
    };

    // Append result to the accumulator.
    acc.push(...handleElement(child, childOptions));

    // Sync mutable counters back to parent options
    options.lastPathId = childOptions.lastPathId;
  }

  return acc;
}
