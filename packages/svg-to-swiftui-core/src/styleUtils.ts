import type { Properties } from "hast";
import type { Rule } from "postcss";
import safeParse from "postcss-safe-parser";
import type { ElementNode } from "svg-parser";
import { canonicalPropertyName, StylePropertiesSet } from "./styleProperties";

type StyleData = Record<string, string | number>;

/** Legacy geometry-adapter helper. Semantic rendering uses SVGStyleResolver. */
export function extractStyle(element: ElementNode): StyleData {
  const props = element.properties;
  if (!props) throw new Error(`No properties found on ${element.tagName} node!`);
  return {
    ...filterStyleProps(props),
    ...(typeof props.style === "string" ? parseStyle(props.style) : {}),
  };
}

/** Parse an inline declaration list with PostCSS error recovery. */
export function parseStyle(style: string): StyleData {
  const root = safeParse(`__inline__ { ${style} }`);
  const rule = root.nodes.find((node): node is Rule => node.type === "rule");
  const result: StyleData = {};
  if (!rule) return result;
  for (const node of rule.nodes) {
    if (node.type !== "decl") continue;
    const property = canonicalPropertyName(node.prop);
    if (StylePropertiesSet.has(property)) result[property] = node.value.trim();
  }
  return result;
}

/** Extract recognized presentation attributes, canonicalizing parser aliases. */
export function filterStyleProps(props: Properties): StyleData {
  const result: StyleData = {};
  for (const [rawName, value] of Object.entries(props)) {
    const property = canonicalPropertyName(rawName);
    if (StylePropertiesSet.has(property) && value !== undefined && value !== null) {
      result[property] = Array.isArray(value) ? value.join(" ") : typeof value === "boolean" ? String(value) : value;
    }
  }
  return result;
}

export { StylePropertiesSet } from "./styleProperties";
