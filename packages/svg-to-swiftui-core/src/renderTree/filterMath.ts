import type {
  FilterBlendMode,
  FilterChannelSelector,
  FilterComponentTransferFunction,
  FilterComponentTransferFunctions,
  FilterCompositeOperator,
  FilterEdgeMode,
  FilterMorphologyOperator,
  FilterTurbulenceType,
} from "./types";

/** A premultiplied RGBA sample. Filter primitives exchange this representation. */
export type FilterPixel = readonly [red: number, green: number, blue: number, alpha: number];

export interface FilterBitmap {
  width: number;
  height: number;
  /** Premultiplied row-major RGBA values. */
  values: number[];
}

export interface FilterPixelRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

function pixelAt(image: FilterBitmap, x: number, y: number): FilterPixel {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return [0, 0, 0, 0];
  const offset = (y * image.width + x) * 4;
  return [
    image.values[offset] ?? 0,
    image.values[offset + 1] ?? 0,
    image.values[offset + 2] ?? 0,
    image.values[offset + 3] ?? 0,
  ];
}

function setPixel(image: FilterBitmap, x: number, y: number, pixel: FilterPixel): void {
  const offset = (y * image.width + x) * 4;
  image.values[offset] = pixel[0];
  image.values[offset + 1] = pixel[1];
  image.values[offset + 2] = pixel[2];
  image.values[offset + 3] = pixel[3];
}

function emptyLike(image: FilterBitmap): FilterBitmap {
  return { width: image.width, height: image.height, values: Array(image.width * image.height * 4).fill(0) };
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function edgeCoordinate(value: number, size: number, edge: FilterEdgeMode): number | undefined {
  if (value >= 0 && value < size) return value;
  if (edge === "none" || size <= 0) return undefined;
  if (edge === "duplicate") return Math.min(size - 1, Math.max(0, value));
  return positiveModulo(value, size);
}

function sampleNearest(image: FilterBitmap, x: number, y: number, edge: FilterEdgeMode): FilterPixel {
  const sampleX = edgeCoordinate(Math.round(x), image.width, edge);
  const sampleY = edgeCoordinate(Math.round(y), image.height, edge);
  return sampleX === undefined || sampleY === undefined ? [0, 0, 0, 0] : pixelAt(image, sampleX, sampleY);
}

function sampleBilinear(image: FilterBitmap, x: number, y: number, edge: FilterEdgeMode): FilterPixel {
  const minX = Math.floor(x);
  const minY = Math.floor(y);
  const fractionX = x - minX;
  const fractionY = y - minY;
  const samples = [
    sampleNearest(image, minX, minY, edge),
    sampleNearest(image, minX + 1, minY, edge),
    sampleNearest(image, minX, minY + 1, edge),
    sampleNearest(image, minX + 1, minY + 1, edge),
  ];
  return [0, 1, 2, 3].map((channel) => {
    const top = samples[0]![channel]! + fractionX * (samples[1]![channel]! - samples[0]![channel]!);
    const bottom = samples[2]![channel]! + fractionX * (samples[3]![channel]! - samples[2]![channel]!);
    return clamp(top + fractionY * (bottom - top));
  }) as unknown as FilterPixel;
}

export interface ConvolveMatrixParameters {
  orderX: number;
  orderY: number;
  kernelMatrix: readonly number[];
  divisor: number;
  bias: number;
  targetX: number;
  targetY: number;
  edgeMode: FilterEdgeMode;
  kernelUnitLengthX?: number;
  kernelUnitLengthY?: number;
  preserveAlpha: boolean;
}

/** W3C feConvolveMatrix, including the required 180° kernel rotation. */
export function convolveFilterBitmap(image: FilterBitmap, parameters: ConvolveMatrixParameters): FilterBitmap {
  const result = emptyLike(image);
  const unitX = parameters.kernelUnitLengthX ?? 1;
  const unitY = parameters.kernelUnitLengthY ?? 1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const accumulators = [0, 0, 0, 0];
      for (let row = 0; row < parameters.orderY; row++) {
        for (let column = 0; column < parameters.orderX; column++) {
          const source = sampleBilinear(
            image,
            x + (column - parameters.targetX) * unitX,
            y + (row - parameters.targetY) * unitY,
            parameters.edgeMode,
          );
          const kernel =
            parameters.kernelMatrix[
              (parameters.orderY - row - 1) * parameters.orderX + (parameters.orderX - column - 1)
            ] ?? 0;
          const sample = parameters.preserveAlpha ? unpremultiply(source) : source;
          for (let channel = 0; channel < 4; channel++) accumulators[channel]! += sample[channel]! * kernel;
        }
      }
      if (parameters.preserveAlpha) {
        const alpha = pixelAt(image, x, y)[3];
        setPixel(
          result,
          x,
          y,
          premultiply(
            accumulators[0]! / parameters.divisor + parameters.bias,
            accumulators[1]! / parameters.divisor + parameters.bias,
            accumulators[2]! / parameters.divisor + parameters.bias,
            alpha,
          ),
        );
      } else {
        const channels = accumulators.map((value) => clamp(value / parameters.divisor + parameters.bias));
        const alpha = channels[3]!;
        setPixel(result, x, y, [
          Math.min(alpha, channels[0]!),
          Math.min(alpha, channels[1]!),
          Math.min(alpha, channels[2]!),
          alpha,
        ]);
      }
    }
  }
  return result;
}

/** Component-wise premultiplied rectangular erosion/dilation with transparent edges. */
export function morphologyFilterBitmap(
  image: FilterBitmap,
  operator: FilterMorphologyOperator,
  radiusX: number,
  radiusY: number,
): FilterBitmap {
  if (radiusX <= 0 || radiusY <= 0) return { ...image, values: [...image.values] };
  const result = emptyLike(image);
  const minOffsetX = Math.ceil(-radiusX);
  const maxOffsetX = Math.floor(radiusX);
  const minOffsetY = Math.ceil(-radiusY);
  const maxOffsetY = Math.floor(radiusY);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const channels = Array(4).fill(operator === "erode" ? 1 : 0) as number[];
      for (let offsetY = minOffsetY; offsetY <= maxOffsetY; offsetY++) {
        for (let offsetX = minOffsetX; offsetX <= maxOffsetX; offsetX++) {
          const sample = pixelAt(image, x + offsetX, y + offsetY);
          for (let channel = 0; channel < 4; channel++)
            channels[channel] =
              operator === "erode"
                ? Math.min(channels[channel]!, sample[channel]!)
                : Math.max(channels[channel]!, sample[channel]!);
        }
      }
      const alpha = channels[3]!;
      setPixel(result, x, y, [
        Math.min(alpha, channels[0]!),
        Math.min(alpha, channels[1]!),
        Math.min(alpha, channels[2]!),
        alpha,
      ]);
    }
  }
  return result;
}

const channelIndex = (channel: FilterChannelSelector): number => ({ R: 0, G: 1, B: 2, A: 3 })[channel];

/** W3C inverse displacement mapping with unpremultiplied map channels and bilinear source sampling. */
export function displacementFilterBitmap(
  source: FilterBitmap,
  map: FilterBitmap,
  displacement: { a: number; b: number; c: number; d: number },
  xChannel: FilterChannelSelector,
  yChannel: FilterChannelSelector,
): FilterBitmap {
  const result = emptyLike(source);
  const xIndex = channelIndex(xChannel);
  const yIndex = channelIndex(yChannel);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const channels = unpremultiply(pixelAt(map, x, y));
      const xAmount = channels[xIndex]! - 0.5;
      const yAmount = channels[yIndex]! - 0.5;
      setPixel(
        result,
        x,
        y,
        sampleBilinear(
          source,
          x + displacement.a * xAmount + displacement.c * yAmount,
          y + displacement.b * xAmount + displacement.d * yAmount,
          "none",
        ),
      );
    }
  }
  return result;
}

/** Repeat an input primitive subregion without painting overlapping tile seams. */
export function tileFilterBitmap(
  image: FilterBitmap,
  inputRegion: FilterPixelRegion,
  outputRegion: FilterPixelRegion,
): FilterBitmap {
  const result = emptyLike(image);
  if (inputRegion.width <= 0 || inputRegion.height <= 0) return result;
  const startX = Math.max(0, Math.floor(outputRegion.x));
  const startY = Math.max(0, Math.floor(outputRegion.y));
  const endX = Math.min(image.width, Math.ceil(outputRegion.x + outputRegion.width));
  const endY = Math.min(image.height, Math.ceil(outputRegion.y + outputRegion.height));
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const sourceX = inputRegion.x + positiveModulo(x + 0.5 - inputRegion.x, inputRegion.width) - 0.5;
      const sourceY = inputRegion.y + positiveModulo(y + 0.5 - inputRegion.y, inputRegion.height) - 0.5;
      setPixel(result, x, y, sampleBilinear(image, sourceX, sourceY, "none"));
    }
  }
  return result;
}

const RAND_M = 2_147_483_647;
const RAND_A = 16_807;
const RAND_Q = 127_773;
const RAND_R = 2_836;
const LATTICE_SIZE = 256;
const LATTICE_MASK = 255;
const PERLIN_N = 4_096;

export function setupTurbulenceSeed(seed: number): number {
  let result = Math.trunc(seed);
  if (result <= 0) result = -(result % (RAND_M - 1)) + 1;
  if (result > RAND_M - 1) result = RAND_M - 1;
  return result;
}

export function nextTurbulenceRandom(seed: number): number {
  let result = RAND_A * (seed % RAND_Q) - RAND_R * Math.floor(seed / RAND_Q);
  if (result <= 0) result += RAND_M;
  return result;
}

interface StitchInfo {
  width: number;
  height: number;
  wrapX: number;
  wrapY: number;
}

/** Exact lattice initialization and noise sequence required by SVG feTurbulence. */
export class SVGTurbulenceGenerator {
  private readonly lattice = Array(LATTICE_SIZE * 2 + 2).fill(0) as number[];
  private readonly gradients = Array.from({ length: 4 }, () =>
    Array.from({ length: LATTICE_SIZE * 2 + 2 }, () => [0, 0] as [number, number]),
  );

  constructor(seed: number) {
    let random = setupTurbulenceSeed(seed);
    let index = 0;
    for (let channel = 0; channel < 4; channel++) {
      for (index = 0; index < LATTICE_SIZE; index++) {
        this.lattice[index] = index;
        let x = 0;
        let y = 0;
        let length = 0;
        do {
          random = nextTurbulenceRandom(random);
          x = ((random % (LATTICE_SIZE * 2)) - LATTICE_SIZE) / LATTICE_SIZE;
          random = nextTurbulenceRandom(random);
          y = ((random % (LATTICE_SIZE * 2)) - LATTICE_SIZE) / LATTICE_SIZE;
          length = Math.hypot(x, y);
        } while (length === 0);
        this.gradients[channel]![index] = [x / length, y / length];
      }
    }
    while (--index) {
      random = nextTurbulenceRandom(random);
      const replacement = random % LATTICE_SIZE;
      [this.lattice[index], this.lattice[replacement]] = [this.lattice[replacement]!, this.lattice[index]!];
    }
    for (index = 0; index < LATTICE_SIZE + 2; index++) {
      this.lattice[LATTICE_SIZE + index] = this.lattice[index]!;
      for (let channel = 0; channel < 4; channel++)
        this.gradients[channel]![LATTICE_SIZE + index] = [...this.gradients[channel]![index]!] as [number, number];
    }
  }

  private noise(channel: number, x: number, y: number, stitch?: StitchInfo): number {
    let bx0 = Math.trunc(x + PERLIN_N);
    let bx1 = bx0 + 1;
    const rx0 = x + PERLIN_N - bx0;
    const rx1 = rx0 - 1;
    let by0 = Math.trunc(y + PERLIN_N);
    let by1 = by0 + 1;
    const ry0 = y + PERLIN_N - by0;
    const ry1 = ry0 - 1;
    if (stitch) {
      if (bx0 >= stitch.wrapX) bx0 -= stitch.width;
      if (bx1 >= stitch.wrapX) bx1 -= stitch.width;
      if (by0 >= stitch.wrapY) by0 -= stitch.height;
      if (by1 >= stitch.wrapY) by1 -= stitch.height;
    }
    bx0 &= LATTICE_MASK;
    bx1 &= LATTICE_MASK;
    by0 &= LATTICE_MASK;
    by1 &= LATTICE_MASK;
    const i = this.lattice[bx0]!;
    const j = this.lattice[bx1]!;
    const b00 = this.lattice[i + by0]!;
    const b10 = this.lattice[j + by0]!;
    const b01 = this.lattice[i + by1]!;
    const b11 = this.lattice[j + by1]!;
    const curve = (value: number) => value * value * (3 - 2 * value);
    const interpolate = (amount: number, left: number, right: number) => left + amount * (right - left);
    const dot = (gradient: [number, number], dx: number, dy: number) => dx * gradient[0] + dy * gradient[1];
    const sx = curve(rx0);
    const sy = curve(ry0);
    const top = interpolate(
      sx,
      dot(this.gradients[channel]![b00]!, rx0, ry0),
      dot(this.gradients[channel]![b10]!, rx1, ry0),
    );
    const bottom = interpolate(
      sx,
      dot(this.gradients[channel]![b01]!, rx0, ry1),
      dot(this.gradients[channel]![b11]!, rx1, ry1),
    );
    return interpolate(sy, top, bottom);
  }

  sample(
    channel: number,
    pointX: number,
    pointY: number,
    baseFrequencyX: number,
    baseFrequencyY: number,
    numOctaves: number,
    type: FilterTurbulenceType,
    stitchTiles: boolean,
    tile: FilterPixelRegion,
  ): number {
    let frequencyX = baseFrequencyX;
    let frequencyY = baseFrequencyY;
    let stitch: StitchInfo | undefined;
    if (stitchTiles && tile.width > 0 && tile.height > 0) {
      const adjusted = (frequency: number, size: number) => {
        if (frequency === 0) return 0;
        const low = Math.floor(size * frequency) / size;
        const high = Math.ceil(size * frequency) / size;
        return low > 0 && frequency / low < high / frequency ? low : high;
      };
      frequencyX = adjusted(frequencyX, tile.width);
      frequencyY = adjusted(frequencyY, tile.height);
      const width = Math.trunc(tile.width * frequencyX + 0.5);
      const height = Math.trunc(tile.height * frequencyY + 0.5);
      stitch = {
        width,
        height,
        wrapX: Math.trunc(tile.x * frequencyX + PERLIN_N + width),
        wrapY: Math.trunc(tile.y * frequencyY + PERLIN_N + height),
      };
    }
    let x = pointX * frequencyX;
    let y = pointY * frequencyY;
    let ratio = 1;
    let sum = 0;
    for (let octave = 0; octave < numOctaves; octave++) {
      const noise = this.noise(channel, x, y, stitch);
      sum += (type === "fractalNoise" ? noise : Math.abs(noise)) / ratio;
      x *= 2;
      y *= 2;
      ratio *= 2;
      if (stitch) {
        stitch.width *= 2;
        stitch.wrapX = 2 * stitch.wrapX - PERLIN_N;
        stitch.height *= 2;
        stitch.wrapY = 2 * stitch.wrapY - PERLIN_N;
      }
    }
    return clamp(type === "fractalNoise" ? (sum + 1) / 2 : sum);
  }
}

export interface TurbulenceParameters {
  baseFrequencyX: number;
  baseFrequencyY: number;
  numOctaves: number;
  seed: number;
  stitchTiles: boolean;
  type: FilterTurbulenceType;
  region: FilterPixelRegion;
  scaleX?: number;
  scaleY?: number;
}

export function turbulenceFilterBitmap(width: number, height: number, parameters: TurbulenceParameters): FilterBitmap {
  const result: FilterBitmap = { width, height, values: Array(width * height * 4).fill(0) };
  const generator = new SVGTurbulenceGenerator(parameters.seed);
  const scaleX = parameters.scaleX ?? 1;
  const scaleY = parameters.scaleY ?? 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pointX = x / scaleX;
      const pointY = y / scaleY;
      const channels = [0, 1, 2, 3].map((channel) =>
        generator.sample(
          channel,
          pointX,
          pointY,
          parameters.baseFrequencyX,
          parameters.baseFrequencyY,
          parameters.numOctaves,
          parameters.type,
          parameters.stitchTiles,
          parameters.region,
        ),
      );
      setPixel(result, x, y, premultiply(channels[0]!, channels[1]!, channels[2]!, channels[3]!));
    }
  }
  return result;
}
