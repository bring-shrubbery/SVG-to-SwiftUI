import type { ElementNode } from "svg-parser";
import { extractStyle } from "../styleUtils";
import { IDENTITY_TRANSFORM, multiplyTransforms, parseTransform, wrapWithTransform } from "../transformUtils";
import type { TranspilerOptions, ViewBoxData } from "../types";
import { handleElement } from "./index";

function parseViewBox(value: unknown): ViewBoxData | undefined {
  if (value === undefined) return undefined;
  const values = String(value)
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (values.length !== 4 || values.some((number) => !Number.isFinite(number))) return undefined;
  return { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! };
}

function symbolViewportTransform(use: ElementNode, symbol: ElementNode) {
  const symbolViewBox = parseViewBox(symbol.properties?.viewBox);
  if (!symbolViewBox) return IDENTITY_TRANSFORM;

  const useProps = use.properties ?? {};
  const x = Number(useProps.x ?? 0);
  const y = Number(useProps.y ?? 0);
  const width = Number(useProps.width ?? symbolViewBox.width);
  const height = Number(useProps.height ?? symbolViewBox.height);
  const preserveAspectRatio = String(symbol.properties?.preserveAspectRatio ?? "xMidYMid meet").trim();

  if (preserveAspectRatio === "none") {
    const scaleX = width / symbolViewBox.width;
    const scaleY = height / symbolViewBox.height;
    return {
      a: scaleX,
      b: 0,
      c: 0,
      d: scaleY,
      e: x - symbolViewBox.x * scaleX,
      f: y - symbolViewBox.y * scaleY,
    };
  }

  const slice = /\bslice\b/.test(preserveAspectRatio);
  const scale = slice
    ? Math.max(width / symbolViewBox.width, height / symbolViewBox.height)
    : Math.min(width / symbolViewBox.width, height / symbolViewBox.height);
  const renderedWidth = symbolViewBox.width * scale;
  const renderedHeight = symbolViewBox.height * scale;
  const xAlignment = preserveAspectRatio.includes("xMin") ? 0 : preserveAspectRatio.includes("xMax") ? 1 : 0.5;
  const yAlignment = preserveAspectRatio.includes("YMin") ? 0 : preserveAspectRatio.includes("YMax") ? 1 : 0.5;

  return {
    a: scale,
    b: 0,
    c: 0,
    d: scale,
    e: x + (width - renderedWidth) * xAlignment - symbolViewBox.x * scale,
    f: y + (height - renderedHeight) * yAlignment - symbolViewBox.y * scale,
  };
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

  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const position = isViewportReference
    ? symbolViewportTransform(element, referenced)
    : { ...IDENTITY_TRANSFORM, e: x, f: y };
  const transform = multiplyTransforms(parseTransform(props.transform), position);
  lines = wrapWithTransform(lines, transform, options);
  return lines;
}
