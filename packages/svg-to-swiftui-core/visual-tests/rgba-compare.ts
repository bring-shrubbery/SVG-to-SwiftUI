import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

export interface RgbaTolerance {
  /** Per-channel difference that marks a pixel as outside tolerance, in 8-bit units. */
  channel: number;
  /** Maximum percentage of pixels with at least one channel outside tolerance. */
  maxOutsidePercent: number;
  /** Maximum mean absolute error across premultiplied RGB channels. */
  maxMeanRgbError: number;
  /** Maximum mean absolute alpha error. */
  maxMeanAlphaError: number;
}

export interface DifferenceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RgbaMetrics {
  totalPixels: number;
  pixelsOutsideTolerance: number;
  outsidePercent: number;
  meanAbsoluteError: number;
  meanRgbError: number;
  meanAlphaError: number;
  maxChannelError: number;
  bounds: DifferenceBounds | null;
}

export interface RgbaComparison {
  metrics: RgbaMetrics;
  passed: boolean;
  diff: PNG;
}

function premultipliedChannel(channel: number, alpha: number): number {
  return Math.round((channel * alpha) / 255);
}

export function compareRgba(reference: PNG, actual: PNG, tolerance: RgbaTolerance): RgbaComparison {
  if (reference.width !== actual.width || reference.height !== actual.height) {
    throw new Error(
      `Dimension mismatch: reference ${reference.width}x${reference.height}, Swift ${actual.width}x${actual.height}`,
    );
  }

  const diff = new PNG({ width: reference.width, height: reference.height });
  const totalPixels = reference.width * reference.height;
  let pixelsOutsideTolerance = 0;
  let totalRgbError = 0;
  let totalAlphaError = 0;
  let maxChannelError = 0;
  let minX = reference.width;
  let minY = reference.height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < totalPixels; index++) {
    const offset = index * 4;
    const referenceAlpha = reference.data[offset + 3]!;
    const actualAlpha = actual.data[offset + 3]!;
    const errors = [
      Math.abs(
        premultipliedChannel(reference.data[offset]!, referenceAlpha) -
          premultipliedChannel(actual.data[offset]!, actualAlpha),
      ),
      Math.abs(
        premultipliedChannel(reference.data[offset + 1]!, referenceAlpha) -
          premultipliedChannel(actual.data[offset + 1]!, actualAlpha),
      ),
      Math.abs(
        premultipliedChannel(reference.data[offset + 2]!, referenceAlpha) -
          premultipliedChannel(actual.data[offset + 2]!, actualAlpha),
      ),
      Math.abs(referenceAlpha - actualAlpha),
    ];
    totalRgbError += errors[0]! + errors[1]! + errors[2]!;
    totalAlphaError += errors[3]!;
    const pixelMax = Math.max(...errors);
    maxChannelError = Math.max(maxChannelError, pixelMax);
    const outside = errors.some((error) => error > tolerance.channel);

    if (outside) {
      pixelsOutsideTolerance++;
      const x = index % reference.width;
      const y = Math.floor(index / reference.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    const intensity = pixelMax;
    diff.data[offset] = outside ? 255 : intensity;
    diff.data[offset + 1] = outside ? Math.max(0, 96 - intensity) : intensity;
    diff.data[offset + 2] = outside ? 0 : intensity;
    diff.data[offset + 3] = outside || intensity > 0 ? 255 : 0;
  }

  const outsidePercent = totalPixels === 0 ? 0 : (pixelsOutsideTolerance / totalPixels) * 100;
  const meanRgbError = totalPixels === 0 ? 0 : totalRgbError / (totalPixels * 3);
  const meanAlphaError = totalPixels === 0 ? 0 : totalAlphaError / totalPixels;
  const meanAbsoluteError = totalPixels === 0 ? 0 : (totalRgbError + totalAlphaError) / (totalPixels * 4);
  const metrics: RgbaMetrics = {
    totalPixels,
    pixelsOutsideTolerance,
    outsidePercent,
    meanAbsoluteError,
    meanRgbError,
    meanAlphaError,
    maxChannelError,
    bounds:
      maxX < 0
        ? null
        : {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          },
  };
  return {
    metrics,
    passed:
      outsidePercent <= tolerance.maxOutsidePercent &&
      meanRgbError <= tolerance.maxMeanRgbError &&
      meanAlphaError <= tolerance.maxMeanAlphaError,
    diff,
  };
}

export function comparePngFiles(
  referencePath: string,
  actualPath: string,
  diffPath: string,
  tolerance: RgbaTolerance,
): RgbaComparison {
  const reference = PNG.sync.read(readFileSync(referencePath));
  const actual = PNG.sync.read(readFileSync(actualPath));
  const comparison = compareRgba(reference, actual, tolerance);
  if (!comparison.passed) writeFileSync(diffPath, PNG.sync.write(comparison.diff));
  return comparison;
}
