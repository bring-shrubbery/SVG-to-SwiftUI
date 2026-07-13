import type { ElementNode, RootNode } from "svg-parser";
import type { TranspilerOptions } from "./types";
import { clampNormalisedSizeProduct } from "./utils";

export interface AffineTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export type SVGTransform = AffineTransform;
export const IDENTITY_TRANSFORM: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function multiplyTransforms(left: AffineTransform, right: AffineTransform): AffineTransform {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function translate(tx: number, ty = 0): AffineTransform {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

function scale(sx: number, sy = sx): AffineTransform {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
}

function rotate(angle: number, cx = 0, cy = 0): AffineTransform {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: cx - cx * cos + cy * sin,
    f: cy - cx * sin - cy * cos,
  };
}

function parseNumbers(value: string): number[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const numbers = trimmed.split(/[\s,]+/).map(Number);
  if (numbers.some((number) => !Number.isFinite(number))) {
    throw new Error(`Invalid SVG transform parameters: ${value}`);
  }
  return numbers;
}

function requireArity(name: string, values: number[], allowed: number[]): void {
  if (!allowed.includes(values.length)) {
    throw new Error(`SVG ${name}() expects ${allowed.join(" or ")} parameters, received ${values.length}`);
  }
}

function transformFunction(name: string, values: number[]): AffineTransform {
  switch (name.toLowerCase()) {
    case "matrix":
      requireArity(name, values, [6]);
      return { a: values[0]!, b: values[1]!, c: values[2]!, d: values[3]!, e: values[4]!, f: values[5]! };
    case "translate":
      requireArity(name, values, [1, 2]);
      return translate(values[0]!, values[1]);
    case "scale":
      requireArity(name, values, [1, 2]);
      return scale(values[0]!, values[1]);
    case "rotate":
      requireArity(name, values, [1, 3]);
      return rotate(values[0]!, values[1], values[2]);
    case "skewx":
      requireArity(name, values, [1]);
      return { a: 1, b: 0, c: Math.tan((values[0]! * Math.PI) / 180), d: 1, e: 0, f: 0 };
    case "skewy":
      requireArity(name, values, [1]);
      return { a: 1, b: Math.tan((values[0]! * Math.PI) / 180), c: 0, d: 1, e: 0, f: 0 };
    default:
      throw new Error(`Unsupported SVG transform function: ${name}`);
  }
}

/** Parse an SVG transform list and apply its functions in the declared order. */
export function parseSVGTransform(value: string): AffineTransform {
  const functionPattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let matrix = IDENTITY_TRANSFORM;
  let lastIndex = 0;
  let matched = false;

  for (const match of value.matchAll(functionPattern)) {
    const separator = value.slice(lastIndex, match.index);
    if (!/^[\s,]*$/.test(separator)) throw new Error(`Invalid SVG transform list: ${value}`);

    matrix = multiplyTransforms(matrix, transformFunction(match[1]!, parseNumbers(match[2]!)));
    lastIndex = (match.index ?? 0) + match[0].length;
    matched = true;
  }

  if (!matched || !/^[\s,]*$/.test(value.slice(lastIndex))) {
    throw new Error(`Invalid SVG transform list: ${value}`);
  }
  return matrix;
}

export function parseTransform(value: unknown): AffineTransform {
  if (typeof value !== "string" || !value.trim() || value.trim().toLowerCase() === "none") return IDENTITY_TRANSFORM;
  return parseSVGTransform(value);
}

export function getSVGTransform(element: ElementNode | RootNode): string | undefined {
  if (element.type !== "element") return undefined;

  const attribute = element.properties?.transform;
  if (attribute !== undefined && String(attribute).trim()) return String(attribute).trim();

  const style = element.properties?.style;
  if (typeof style === "string") {
    const match = /(?:^|;)\s*transform\s*:\s*([^;]+)/i.exec(style);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

function formatNumber(value: number, precision: number): string {
  const rounded = Number(value.toFixed(precision));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function scaledRuntimeValue(value: number, suffix: "height/width" | "width/height", precision: number): string {
  const formatted = formatNumber(value, precision);
  if (formatted === "0") return "0";
  if (formatted === "1") return suffix;
  if (formatted === "-1") return `-${suffix}`;
  return `${formatted}*${suffix}`;
}

function swiftTransform(matrix: AffineTransform, options: TranspilerOptions): string {
  const { viewBox, precision } = options;
  const a = formatNumber(matrix.a, precision);
  const b = scaledRuntimeValue(matrix.b * (viewBox.width / viewBox.height), "height/width", precision);
  const c = scaledRuntimeValue(matrix.c * (viewBox.height / viewBox.width), "width/height", precision);
  const d = formatNumber(matrix.d, precision);
  const translatedX = matrix.a * viewBox.x + matrix.c * viewBox.y + matrix.e - viewBox.x;
  const translatedY = matrix.b * viewBox.x + matrix.d * viewBox.y + matrix.f - viewBox.y;
  const tx = clampNormalisedSizeProduct(formatNumber(translatedX / viewBox.width, precision), "width");
  const ty = clampNormalisedSizeProduct(formatNumber(translatedY / viewBox.height, precision), "height");

  return `CGAffineTransform(a: ${a}, b: ${b}, c: ${c}, d: ${d}, tx: ${tx}, ty: ${ty})`;
}

function wrapWithMatrix(lines: string[], matrix: AffineTransform, options: TranspilerOptions): string[] {
  if (lines.length === 0) return lines;
  options.lastPathId++;
  const variable = `transformPath${options.lastPathId}`;
  return [
    `var ${variable} = Path()`,
    ...lines.map((line) => line.replace(/^path\./, `${variable}.`)),
    `path.addPath(${variable}.applying(${swiftTransform(matrix, options)}))`,
  ];
}

export function wrapWithSVGTransform(
  lines: string[],
  transform: string | undefined,
  options: TranspilerOptions,
): string[] {
  return transform ? wrapWithMatrix(lines, parseSVGTransform(transform), options) : lines;
}

export function wrapWithTransform(lines: string[], transform: AffineTransform, options: TranspilerOptions): string[] {
  const isIdentity =
    transform.a === 1 &&
    transform.b === 0 &&
    transform.c === 0 &&
    transform.d === 1 &&
    transform.e === 0 &&
    transform.f === 0;
  return isIdentity ? lines : wrapWithMatrix(lines, transform, options);
}
