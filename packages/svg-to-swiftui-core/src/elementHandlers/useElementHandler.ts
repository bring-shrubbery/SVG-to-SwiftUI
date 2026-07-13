import type { ElementNode } from "svg-parser";
import { extractStyle } from "../styleUtils";
import { IDENTITY_TRANSFORM, multiplyTransforms, parseTransform, wrapWithTransform } from "../transformUtils";
import type { TranspilerOptions } from "../types";
import { parsePreserveAspectRatio, parseViewBox, viewBoxTransform } from "../viewports";
import { handleElement } from "./index";
import { resolvedGeometryNumber } from "./resolvedGeometry";

function symbolViewportTransform(use: ElementNode, symbol: ElementNode) {
  const symbolViewBox = parseViewBox(symbol.properties?.viewBox);
  if (!symbolViewBox) return IDENTITY_TRANSFORM;

  const useProps = use.properties ?? {};
  const x = resolvedGeometryNumber(useProps.x, 0);
  const y = resolvedGeometryNumber(useProps.y, 0);
  const width = resolvedGeometryNumber(useProps.width, symbolViewBox.width);
  const height = resolvedGeometryNumber(useProps.height, symbolViewBox.height);
  return viewBoxTransform(
    symbolViewBox,
    { x, y, width, height },
    parsePreserveAspectRatio(symbol.properties?.preserveAspectRatio),
  );
}

function renderReferencedViewport(element: ElementNode, options: TranspilerOptions): string[] {
  let symbolStyle: Record<string, string | number> = {};
  try {
    symbolStyle = extractStyle(element);
  } catch {}
  const childOptions = { ...options, parentStyle: { ...options.parentStyle, ...symbolStyle } };
  const lines: string[] = [];
  for (const child of element.children) {
    if (typeof child === "string" || child.type !== "element") continue;
    lines.push(...handleElement(child, childOptions));
  }
  options.lastPathId = childOptions.lastPathId;
  return lines;
}

export default function handleUseElement(element: ElementNode, options: TranspilerOptions): string[] {
  const props = element.properties ?? {};
  const href = props.href ?? props["xlink:href"];
  if (href === undefined || !String(href).startsWith("#")) {
    throw new Error("<use> must reference a local element id with href or xlink:href.");
  }

  const id = String(href).slice(1);
  const referenced = options.definitions.get(id);
  if (!referenced) throw new Error(`<use> references missing element #${id}.`);
  if (options.activeUseReferences.has(id)) throw new Error(`<use> contains a circular reference to #${id}.`);

  let ownStyle: Record<string, string | number> = {};
  try {
    ownStyle = extractStyle(element);
  } catch {}

  const childOptions: TranspilerOptions = {
    ...options,
    parentStyle: { ...options.parentStyle, ...ownStyle },
    activeUseReferences: new Set(options.activeUseReferences).add(id),
  };

  const isViewportReference = referenced.tagName === "symbol" || referenced.tagName === "svg";
  let lines = isViewportReference
    ? renderReferencedViewport(referenced, childOptions)
    : handleElement(referenced, childOptions);
  options.lastPathId = childOptions.lastPathId;

  const x = resolvedGeometryNumber(props.x, 0);
  const y = resolvedGeometryNumber(props.y, 0);
  const position = isViewportReference
    ? symbolViewportTransform(element, referenced)
    : { ...IDENTITY_TRANSFORM, e: x, f: y };
  const transform = multiplyTransforms(parseTransform(props.transform), position);
  lines = wrapWithTransform(lines, transform, options);
  return lines;
}
