import type {
  FilterBlendMode,
  FilterComponentTransferFunction,
  FilterComponentTransferFunctions,
  FilterCompositeOperator,
} from "./types";

/** A premultiplied RGBA sample. Filter primitives exchange this representation. */
export type FilterPixel = readonly [red: number, green: number, blue: number, alpha: number];

type RGB = [number, number, number];

const clamp = (value: number): number => {
  if (Number.isNaN(value) || value === Number.NEGATIVE_INFINITY) return 0;
  if (value === Number.POSITIVE_INFINITY) return 1;
  return Math.min(1, Math.max(0, value));
};

function unpremultiply(pixel: FilterPixel): [number, number, number, number] {
  const alpha = clamp(pixel[3]);
  if (alpha === 0) return [0, 0, 0, 0];
  return [clamp(pixel[0] / alpha), clamp(pixel[1] / alpha), clamp(pixel[2] / alpha), alpha];
}

function premultiply(red: number, green: number, blue: number, alpha: number): FilterPixel {
  const a = clamp(alpha);
  return [clamp(red) * a, clamp(green) * a, clamp(blue) * a, a];
}

const premultipliedChannel = (pixel: FilterPixel, channel: number, alpha: number): number =>
  Math.min(alpha, clamp(pixel[channel] ?? 0));

function transfer(value: number, linear: boolean, encode: boolean): number {
  const channel = clamp(value);
  if (!linear) return channel;
  if (encode) return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function convertFilterPixel(pixel: FilterPixel, linear: boolean, encode: boolean): FilterPixel {
  const [red, green, blue, alpha] = unpremultiply(pixel);
  return premultiply(
    transfer(red, linear, encode),
    transfer(green, linear, encode),
    transfer(blue, linear, encode),
    alpha,
  );
}

function separable(mode: FilterBlendMode, backdrop: number, source: number): number {
  switch (mode) {
    case "normal":
      return source;
    case "multiply":
      return backdrop * source;
    case "screen":
      return backdrop + source - backdrop * source;
    case "overlay":
      return backdrop <= 0.5 ? 2 * backdrop * source : 1 - 2 * (1 - backdrop) * (1 - source);
    case "darken":
      return Math.min(backdrop, source);
    case "lighten":
      return Math.max(backdrop, source);
    case "color-dodge":
      return backdrop === 0 ? 0 : source === 1 ? 1 : Math.min(1, backdrop / (1 - source));
    case "color-burn":
      return backdrop === 1 ? 1 : source === 0 ? 0 : 1 - Math.min(1, (1 - backdrop) / source);
    case "hard-light":
      return source <= 0.5 ? 2 * source * backdrop : 1 - 2 * (1 - source) * (1 - backdrop);
    case "soft-light": {
      if (source <= 0.5) return backdrop - (1 - 2 * source) * backdrop * (1 - backdrop);
      const d = backdrop <= 0.25 ? ((16 * backdrop - 12) * backdrop + 4) * backdrop : Math.sqrt(backdrop);
      return backdrop + (2 * source - 1) * (d - backdrop);
    }
    case "difference":
      return Math.abs(backdrop - source);
    case "exclusion":
      return backdrop + source - 2 * backdrop * source;
    default:
      return source;
  }
}

const luminosity = (color: RGB): number => 0.3 * color[0] + 0.59 * color[1] + 0.11 * color[2];
const saturation = (color: RGB): number => Math.max(...color) - Math.min(...color);

function clipColor(color: RGB): RGB {
  const result: RGB = [...color];
  const lum = luminosity(result);
  const minimum = Math.min(...result);
  const maximum = Math.max(...result);
  if (minimum < 0)
    for (let index = 0; index < 3; index++) result[index] = lum + ((result[index]! - lum) * lum) / (lum - minimum);
  if (maximum > 1)
    for (let index = 0; index < 3; index++)
      result[index] = lum + ((result[index]! - lum) * (1 - lum)) / (maximum - lum);
  return result;
}

function setLuminosity(color: RGB, lum: number): RGB {
  const delta = lum - luminosity(color);
  return clipColor([color[0] + delta, color[1] + delta, color[2] + delta]);
}

function setSaturation(color: RGB, sat: number): RGB {
  const result: RGB = [0, 0, 0];
  const order = [0, 1, 2].sort((left, right) => color[left]! - color[right]!);
  const minimum = order[0]!;
  const middle = order[1]!;
  const maximum = order[2]!;
  if (color[maximum]! > color[minimum]!) {
    result[middle] = ((color[middle]! - color[minimum]!) * sat) / (color[maximum]! - color[minimum]!);
    result[maximum] = sat;
  }
  return result;
}

function blendedRGB(mode: FilterBlendMode, backdrop: RGB, source: RGB): RGB {
  switch (mode) {
    case "hue":
      return setLuminosity(setSaturation(source, saturation(backdrop)), luminosity(backdrop));
    case "saturation":
      return setLuminosity(setSaturation(backdrop, saturation(source)), luminosity(backdrop));
    case "color":
      return setLuminosity(source, luminosity(backdrop));
    case "luminosity":
      return setLuminosity(backdrop, luminosity(source));
    default:
      return [
        separable(mode, backdrop[0], source[0]),
        separable(mode, backdrop[1], source[1]),
        separable(mode, backdrop[2], source[2]),
      ];
  }
}

/** Blend `source` (`in`) over `backdrop` (`in2`) using the W3C source-over mixing formula. */
export function blendFilterPixels(source: FilterPixel, backdrop: FilterPixel, mode: FilterBlendMode): FilterPixel {
  const cs = unpremultiply(source);
  const cb = unpremultiply(backdrop);
  const sourceChannels = [0, 1, 2].map((channel) => premultipliedChannel(source, channel, cs[3]));
  const backdropChannels = [0, 1, 2].map((channel) => premultipliedChannel(backdrop, channel, cb[3]));
  const blended = blendedRGB(mode, [cb[0], cb[1], cb[2]], [cs[0], cs[1], cs[2]]);
  const alpha = cs[3] + cb[3] * (1 - cs[3]);
  return [
    clamp((1 - cs[3]) * backdropChannels[0]! + (1 - cb[3]) * sourceChannels[0]! + cs[3] * cb[3] * blended[0]),
    clamp((1 - cs[3]) * backdropChannels[1]! + (1 - cb[3]) * sourceChannels[1]! + cs[3] * cb[3] * blended[1]),
    clamp((1 - cs[3]) * backdropChannels[2]! + (1 - cb[3]) * sourceChannels[2]! + cs[3] * cb[3] * blended[2]),
    clamp(alpha),
  ];
}

export function colorMatrixFilterPixel(pixel: FilterPixel, matrix: readonly number[]): FilterPixel {
  if (matrix.length !== 20) return pixel;
  const input = unpremultiply(pixel);
  const output = [0, 1, 2, 3].map((row) => {
    const offset = row * 5;
    return clamp(
      matrix[offset]! * input[0] +
        matrix[offset + 1]! * input[1] +
        matrix[offset + 2]! * input[2] +
        matrix[offset + 3]! * input[3] +
        matrix[offset + 4]!,
    );
  });
  return premultiply(output[0]!, output[1]!, output[2]!, output[3]!);
}

export function componentTransferValue(value: number, fn: FilterComponentTransferFunction): number {
  const input = clamp(value);
  switch (fn.type) {
    case "identity":
      return input;
    case "table": {
      if (fn.values.length === 0) return input;
      if (fn.values.length === 1) return clamp(fn.values[0]!);
      if (input === 1) return clamp(fn.values[fn.values.length - 1]!);
      const scaled = input * (fn.values.length - 1);
      const index = Math.floor(scaled);
      return clamp(fn.values[index]! + (scaled - index) * (fn.values[index + 1]! - fn.values[index]!));
    }
    case "discrete":
      if (fn.values.length === 0) return input;
      return clamp(fn.values[Math.min(fn.values.length - 1, Math.floor(input * fn.values.length))]!);
    case "linear":
      return clamp(fn.slope * input + fn.intercept);
    case "gamma":
      return clamp(fn.amplitude * input ** fn.exponent + fn.offset);
  }
}

export function componentTransferFilterPixel(
  pixel: FilterPixel,
  functions: FilterComponentTransferFunctions,
): FilterPixel {
  const input = unpremultiply(pixel);
  return premultiply(
    componentTransferValue(input[0], functions[0]),
    componentTransferValue(input[1], functions[1]),
    componentTransferValue(input[2], functions[2]),
    componentTransferValue(input[3], functions[3]),
  );
}

export function compositeFilterPixels(
  source: FilterPixel,
  destination: FilterPixel,
  operator: FilterCompositeOperator,
  coefficients: readonly [number, number, number, number] = [0, 0, 0, 0],
): FilterPixel {
  const sourceAlpha = clamp(source[3]);
  const destinationAlpha = clamp(destination[3]);
  const sourceChannel = (index: number): number =>
    index === 3 ? sourceAlpha : premultipliedChannel(source, index, sourceAlpha);
  const destinationChannel = (index: number): number =>
    index === 3 ? destinationAlpha : premultipliedChannel(destination, index, destinationAlpha);
  if (operator === "arithmetic") {
    const channels = [0, 1, 2, 3].map((index) =>
      clamp(
        coefficients[0] * sourceChannel(index) * destinationChannel(index) +
          coefficients[1] * sourceChannel(index) +
          coefficients[2] * destinationChannel(index) +
          coefficients[3],
      ),
    );
    const alpha = channels[3]!;
    return [Math.min(alpha, channels[0]!), Math.min(alpha, channels[1]!), Math.min(alpha, channels[2]!), alpha];
  }
  let sourceFactor: number;
  let destinationFactor: number;
  switch (operator) {
    case "over":
      sourceFactor = 1;
      destinationFactor = 1 - sourceAlpha;
      break;
    case "in":
      sourceFactor = destinationAlpha;
      destinationFactor = 0;
      break;
    case "out":
      sourceFactor = 1 - destinationAlpha;
      destinationFactor = 0;
      break;
    case "atop":
      sourceFactor = destinationAlpha;
      destinationFactor = 1 - sourceAlpha;
      break;
    case "xor":
      sourceFactor = 1 - destinationAlpha;
      destinationFactor = 1 - sourceAlpha;
      break;
    case "lighter":
      sourceFactor = 1;
      destinationFactor = 1;
      break;
  }
  const output = [0, 1, 2, 3].map((index) =>
    clamp(sourceChannel(index) * sourceFactor + destinationChannel(index) * destinationFactor),
  );
  const alpha = output[3]!;
  return [Math.min(alpha, output[0]!), Math.min(alpha, output[1]!), Math.min(alpha, output[2]!), alpha];
}
