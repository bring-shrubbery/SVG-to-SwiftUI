import type { ElementNode } from "svg-parser";
import { extractStyle } from "../styleUtils";
import { parseTransform, wrapWithTransform } from "../transformUtils";
import type { TranspilerOptions } from "../types";
import { handleElement } from "./index";

/** Renders the first viable child, matching SVG <switch> fallback behavior. */
export default function handleSwitchElement(element: ElementNode, options: TranspilerOptions): string[] {
  let ownStyle: Record<string, string | number> = {};
  try {
    ownStyle = extractStyle(element);
  } catch {}

  for (const child of element.children) {
    if (typeof child === "string" || child.type !== "element") continue;
    const childOptions = { ...options, parentStyle: { ...options.parentStyle, ...ownStyle } };
    const lines = handleElement(child, childOptions);
    options.lastPathId = childOptions.lastPathId;
    return wrapWithTransform(lines, parseTransform(element.properties?.transform), options);
  }

  return [];
}
