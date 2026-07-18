import { __testing, convert, convertAsync, convertWithDiagnostics, type ResourceRequest } from "../index";
import {
  convolveFilterBitmap,
  displacementFilterBitmap,
  type FilterBitmap,
  morphologyFilterBitmap,
  nextTurbulenceRandom,
  SVGTurbulenceGenerator,
  setupTurbulenceSeed,
  tileFilterBitmap,
  turbulenceFilterBitmap,
} from "../renderTree/filterMath";
import type { FilterPrimitive, RenderNode } from "../renderTree/types";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgQIAZcfRzQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

function primitives(source: string, config = {}): FilterPrimitive[] {
  const document = __testing.parseRenderDocument(source, config);
  const node = flatten(document.children).find((candidate) => candidate.filter);
  if (!node?.filter) throw new Error("Expected a filter instance");
  return node.filter.primitives;
}

function bitmap(width: number, height: number, values: number[]): FilterBitmap {
  return { width, height, values };
}

function pngWithDimensions(width: number, height: number): Uint8Array {
  const bytes = Uint8Array.from(PNG);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function pixels(image: FilterBitmap): number[][] {
  return Array.from({ length: image.width * image.height }, (_, index) => image.values.slice(index * 4, index * 4 + 4));
}

describe("spatial, noise, and image filter parsing", () => {
  test("retains every primitive attribute, comma pairs, defaults, and graph inputs", () => {
    const graph = primitives(`<svg viewBox="0 0 100 50"><defs><filter id="f">
      <feConvolveMatrix order="3,2" kernelMatrix="1 2 3,4 5 6" divisor="7" bias=".25"
        targetX="2" targetY="0" edgeMode="wrap" kernelUnitLength="2,3" preserveAlpha="true" result="conv"/>
      <feMorphology in="conv" operator="dilate" radius="4,5" result="morph"/>
      <feDisplacementMap in="morph" in2="SourceGraphic" scale="8" xChannelSelector="B" yChannelSelector="A"/>
      <feTile/><feTurbulence baseFrequency=".02,.03" numOctaves="4" seed="-3.9" stitchTiles="stitch" type="fractalNoise"/>
    </filter></defs><rect width="100" height="50" filter="url(#f)"/></svg>`);
    expect(graph).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "convolveMatrix",
          orderX: 3,
          orderY: 2,
          kernelMatrix: [1, 2, 3, 4, 5, 6],
          divisor: 7,
          bias: 0.25,
          targetX: 2,
          targetY: 0,
          edgeMode: "wrap",
          kernelUnitLengthX: 2,
          kernelUnitLengthY: 3,
          preserveAlpha: true,
        }),
        expect.objectContaining({ type: "morphology", operator: "dilate", radiusX: 4, radiusY: 5 }),
        expect.objectContaining({
          type: "displacementMap",
          input: { type: "result", index: 1 },
          input2: { type: "sourceGraphic" },
          displacement: { a: 8, b: 0, c: 0, d: 8 },
          xChannel: "B",
          yChannel: "A",
        }),
        expect.objectContaining({ type: "tile" }),
        expect.objectContaining({
          type: "turbulence",
          baseFrequencyX: 0.02,
          baseFrequencyY: 0.03,
          numOctaves: 4,
          seed: -3,
          stitchTiles: true,
          noiseType: "fractalNoise",
        }),
      ]),
    );
  });

  test("transforms objectBoundingBox radii, kernel spacing, displacement, and tile input region", () => {
    const graph = primitives(`<svg viewBox="0 0 200 100"><defs><filter id="f" primitiveUnits="objectBoundingBox">
      <feConvolveMatrix order="1" kernelMatrix="1" kernelUnitLength=".1 .2" x="10%" y="20%" width="30%" height="40%" result="a"/>
      <feMorphology in="a" radius=".1 .2" result="b"/>
      <feDisplacementMap in="b" in2="SourceGraphic" scale=".5"/><feTile in="a"/>
    </filter></defs><rect x="20" y="10" width="100" height="50" filter="url(#f)"/></svg>`);
    expect(graph[0]).toMatchObject({
      kernelUnitLengthX: 10,
      kernelUnitLengthY: 10,
      subregion: { x: 30, y: 20, width: 30, height: 20 },
    });
    expect(graph[1]).toMatchObject({ radiusX: 10, radiusY: 10 });
    expect(graph[2]).toMatchObject({ displacement: { a: 50, b: 0, c: 0, d: 25 } });
    expect(graph[3]).toMatchObject({ tileRegion: { x: 30, y: 20, width: 30, height: 20 } });
  });

  test("diagnoses malformed values and enforces configurable limits", () => {
    const result = convertWithDiagnostics(
      `<svg viewBox="0 0 10 10"><defs><filter id="f">
      <feConvolveMatrix order="4 4" kernelMatrix="1 2" divisor="0" targetX="1.5"/><feMorphology operator="bad" radius="-1"/>
      <feConvolveMatrix order="2.5" kernelMatrix="1"/><feDisplacementMap xChannelSelector="X"/>
      <feTurbulence numOctaves="99.5" type="bad" stitchTiles="bad"/>
    </filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`,
      {
        filters: { maxKernelCells: 8, maxOctaves: 2, maxOutputPixels: 1 },
      },
    );
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "filter-kernel-limit",
        "invalid-filter-divisor",
        "invalid-filter-convolution-target",
        "invalid-filter-order",
        "invalid-filter-morphology-operator",
        "negative-filter-radius",
        "invalid-filter-xchannelselector",
        "filter-octave-limit",
        "invalid-filter-num-octaves",
        "invalid-filter-turbulence-type",
        "invalid-filter-stitch-tiles",
      ]),
    );
    expect(result.swift).toContain("maxOutputPixels: 1");
  });

  test("materializes data raster, external SVG, and local-fragment feImage without network runtime code", async () => {
    const requests: ResourceRequest[] = [];
    const child = Uint8Array.from(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 1"><rect width="2" height="1" fill="blue"/></svg>`,
      ),
    );
    const source = `<svg viewBox="0 0 20 10"><defs><g id="local"><circle cx="5" cy="5" r="4"/></g><filter id="f">
      <feImage href="pixel.png" x="0" width="5" height="5" result="a"/>
      <feImage href="child.svg" x="5" width="5" height="5" result="b"/>
      <feImage href="#local" x="10" width="5" height="5" preserveAspectRatio="none"/>
    </filter></defs><rect width="20" height="10" filter="url(#f)"/></svg>`;
    const swift = await convertAsync(source, {
      structName: "FilterImages",
      resources: {
        policy: "custom",
        baseURL: "https://assets.example/root.svg",
        resolver: async (request) => {
          requests.push(request);
          if (request.canonicalURL.endsWith("pixel.png")) return { bytes: PNG, mimeType: "image/png" };
          if (request.canonicalURL.endsWith("child.svg")) return { bytes: child, mimeType: "image/svg+xml" };
          return undefined;
        },
      },
    });
    expect(requests.map(({ kind }) => kind)).toEqual(["filter-image", "filter-image"]);
    expect(swift).toContain("FilterImageLayer0");
    expect(swift).toContain("FilterImagesFilterImageDocument0");
    expect(swift).toContain("FilterImagesFilterImageDocument1");
    expect(swift).toContain("CGImageSourceCreateImageAtIndex");
    expect(swift).not.toContain("URLSession");
  });

  test("uses href over xlink:href and rejects recursive local fragments", () => {
    const document = __testing.parseRenderDocument(`<svg viewBox="0 0 10 10"><defs>
      <g id="recursive" filter="url(#f)"><rect width="5" height="5"/></g>
      <filter id="f"><feImage href="#recursive" xlink:href="#other"/></filter>
      <g id="other"><circle r="1"/></g>
    </defs><rect width="10" height="10" filter="url(#f)"/></svg>`);
    expect(document.resources.filters.get("f")?.primitives[0]).toMatchObject({
      type: "image",
      image: { href: "#recursive", localElementId: "recursive" },
    });
    expect(document.diagnostics.map(({ code }) => code)).toContain("recursive-filter-image");
  });

  test("applies the shared resource policy, encoded-byte limit, and decoded-pixel limit to feImage", () => {
    const svg = (href: string) =>
      `<svg viewBox="0 0 10 10"><defs><filter id="f"><feImage href="${href}"/></filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`;
    const denied = convertWithDiagnostics(svg("https://example.test/image.png"));
    expect(denied.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "external-resource-denied", source: { element: "feImage" } }),
      ]),
    );
    const byteLimited = convertWithDiagnostics(svg("large.png"), {
      resources: { supplied: { "large.png": { bytes: PNG } }, limits: { maxResourceBytes: 8 } },
    });
    expect(byteLimited.diagnostics.map(({ code }) => code)).toContain("resource-byte-limit");
    const pixelLimited = convertWithDiagnostics(svg("large.png"), {
      resources: {
        supplied: { "large.png": { bytes: pngWithDimensions(2, 2) } },
        limits: { maxImagePixels: 1 },
      },
    });
    expect(pixelLimited.diagnostics.map(({ code }) => code)).toContain("resource-pixel-limit");
  });

  test("emits typed Swift runtime cases for all six families", () => {
    const swift = convert(`<svg viewBox="0 0 10 10"><defs><filter id="f">
      <feConvolveMatrix order="1" kernelMatrix="1"/><feMorphology/><feDisplacementMap/>
      <feTile/><feTurbulence/><feImage href="#shape"/>
    </filter><rect id="shape" width="2" height="2"/></defs><rect width="10" height="10" filter="url(#f)"/></svg>`);
    for (const name of ["convolveMatrix", "morphology", "displacementMap", "tile", "turbulence", "image"])
      expect(swift).toContain(`case ${name}`);
    expect(swift).toContain("private final class TurbulenceGenerator");
    expect(swift).toContain("renderFilterImages:");
  });
});

describe("spatial and turbulence reference math", () => {
  test("rotates convolution kernels 180 degrees and handles edge modes", () => {
    const source = bitmap(3, 1, [1, 0, 0, 1, 0.5, 0, 0, 1, 0, 0, 0, 1]);
    const common = {
      orderX: 3,
      orderY: 1,
      kernelMatrix: [1, 0, 0],
      divisor: 1,
      bias: 0,
      targetX: 1,
      targetY: 0,
      preserveAlpha: false,
    };
    expect(pixels(convolveFilterBitmap(source, { ...common, edgeMode: "none" }))[1]).toEqual([0, 0, 0, 1]);
    expect(pixels(convolveFilterBitmap(source, { ...common, edgeMode: "duplicate" }))[0]).toEqual([0.5, 0, 0, 1]);
    expect(pixels(convolveFilterBitmap(source, { ...common, edgeMode: "wrap" }))[0]).toEqual([0.5, 0, 0, 1]);
  });

  test("supports fractional kernel spacing, divisor/bias, and preserveAlpha", () => {
    const source = bitmap(2, 1, [0.25, 0, 0, 0.5, 0, 0, 0, 1]);
    const output = convolveFilterBitmap(source, {
      orderX: 2,
      orderY: 1,
      kernelMatrix: [1, 1],
      divisor: 2,
      bias: 0.1,
      targetX: 0,
      targetY: 0,
      edgeMode: "duplicate",
      kernelUnitLengthX: 0.5,
      preserveAlpha: true,
    });
    expect(pixels(output)[0]?.[0]).toBeCloseTo(0.2166666667);
    expect(pixels(output)[0]?.slice(1)).toEqual([0.05, 0.05, 0.5]);
  });

  test("erodes and dilates premultiplied samples with fractional radii and transparent edges", () => {
    const source = bitmap(3, 1, [0, 0, 0, 0, 0.4, 0.2, 0, 0.5, 0, 0, 0, 0]);
    expect(pixels(morphologyFilterBitmap(source, "dilate", 1, 0.5))).toEqual([
      [0.4, 0.2, 0, 0.5],
      [0.4, 0.2, 0, 0.5],
      [0.4, 0.2, 0, 0.5],
    ]);
    expect(pixels(morphologyFilterBitmap(source, "erode", 1, 0.5))).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  test("uses unpremultiplied map channels and the SVG positive coordinate sign", () => {
    const source = bitmap(3, 1, [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]);
    const map = bitmap(3, 1, [0.5, 0, 0, 0.5, 0.5, 0, 0, 1, 0, 0, 0, 0]);
    expect(pixels(displacementFilterBitmap(source, map, { a: 2, b: 0, c: 0, d: 0 }, "R", "A"))).toEqual([
      [0, 1, 0, 1],
      [0, 1, 0, 1],
      [0, 1, 0, 1],
    ]);
  });

  test("tiles fractional input origins without seams", () => {
    const source = bitmap(4, 1, [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1]);
    const output = tileFilterBitmap(
      source,
      { x: 0.25, y: 0, width: 1.5, height: 1 },
      { x: 0, y: 0, width: 4, height: 1 },
    );
    expect(pixels(output)).toEqual([
      [1, 0, 0, 1],
      [0, 1, 0, 1],
      [0.5, 0.5, 0, 1],
      [1, 0, 0, 1],
    ]);
  });

  test("matches the mandated Park-Miller sequence and deterministic turbulence samples", () => {
    let seed = setupTurbulenceSeed(1);
    for (let index = 0; index < 10_000; index++) seed = nextTurbulenceRandom(seed);
    expect(seed).toBe(1_043_618_065);
    expect(setupTurbulenceSeed(-2_147_483_647)).toBe(2);
    expect(setupTurbulenceSeed(Number.MAX_SAFE_INTEGER)).toBe(2_147_483_646);
    const generator = new SVGTurbulenceGenerator(7);
    expect(
      generator.sample(0, 12.5, 8.25, 0.04, 0.06, 3, "fractalNoise", false, { x: 0, y: 0, width: 20, height: 10 }),
    ).toBeCloseTo(0.49089059, 7);
    const stitched = turbulenceFilterBitmap(5, 3, {
      baseFrequencyX: 0.12,
      baseFrequencyY: 0.2,
      numOctaves: 2,
      seed: 3,
      stitchTiles: true,
      type: "turbulence",
      region: { x: 0, y: 0, width: 5, height: 3 },
    });
    expect(stitched.values).toHaveLength(60);
    expect(stitched.values.every(Number.isFinite)).toBe(true);
  });
});
