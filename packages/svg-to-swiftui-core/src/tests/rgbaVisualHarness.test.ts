import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { compareRgba } from "../../visual-tests/rgba-compare";
import { convert } from "../index";

const exact = { channel: 0, maxOutsidePercent: 0, maxMeanRgbError: 0, maxMeanAlphaError: 0 };

function png(pixels: [number, number, number, number][]): PNG {
  const image = new PNG({ width: pixels.length, height: 1 });
  pixels.forEach((pixel, index) => {
    image.data.set(pixel, index * 4);
  });
  return image;
}

describe("full RGBA visual comparison", () => {
  test("rejects the same geometry rendered with the wrong solid color", () => {
    const result = compareRgba(png([[255, 0, 0, 255]]), png([[0, 0, 255, 255]]), exact);
    expect(result.passed).toBe(false);
    expect(result.metrics).toMatchObject({ pixelsOutsideTolerance: 1, outsidePercent: 100, maxChannelError: 255 });
  });

  test("rejects reversed paint order and reversed gradient direction", () => {
    const layers = compareRgba(
      png([
        [255, 0, 0, 255],
        [0, 0, 255, 255],
      ]),
      png([
        [0, 0, 255, 255],
        [255, 0, 0, 255],
      ]),
      exact,
    );
    const gradient = compareRgba(
      png([
        [0, 0, 0, 255],
        [128, 128, 128, 255],
        [255, 255, 255, 255],
      ]),
      png([
        [255, 255, 255, 255],
        [128, 128, 128, 255],
        [0, 0, 0, 255],
      ]),
      exact,
    );
    expect(layers.metrics.pixelsOutsideTolerance).toBe(2);
    expect(gradient.metrics.pixelsOutsideTolerance).toBe(2);
  });

  test("reports RGB and alpha errors independently", () => {
    const opacity = compareRgba(png([[40, 100, 200, 128]]), png([[40, 100, 200, 255]]), exact);
    const alphaOnlyMask = compareRgba(png([[0, 0, 0, 64]]), png([[0, 0, 0, 192]]), exact);
    expect(opacity.metrics.meanRgbError).toBeGreaterThan(0);
    expect(opacity.metrics.meanAlphaError).toBe(127);
    expect(alphaOnlyMask.metrics.meanRgbError).toBe(0);
    expect(alphaOnlyMask.metrics.meanAlphaError).toBe(128);
  });

  test("compares consistently premultiplied pixels and ignores invisible hidden RGB", () => {
    const result = compareRgba(png([[255, 0, 0, 0]]), png([[0, 255, 255, 0]]), exact);
    expect(result.passed).toBe(true);
    expect(result.metrics.meanAbsoluteError).toBe(0);
  });

  test("acceptance fixture generates a real View with no Shape conformance", () => {
    const source = readFileSync(resolve(__dirname, "../../visual-tests/fixtures/harness-multicolor-view.svg"), "utf8");
    const swift = convert(source, { structName: "ViewOnlyFixture", preserveColors: true });
    expect(swift).toContain("struct ViewOnlyFixture: View");
    expect(swift).not.toContain("struct ViewOnlyFixture: Shape");
  });
});
