import { __testing, convert, convertWithDiagnostics } from "../index";
import { type FilterBitmap, type FilterVector3, lightingFilterBitmap, surfaceNormal } from "../renderTree/filterMath";
import type { FilterPrimitive, RenderNode } from "../renderTree/types";

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

function primitives(source: string): FilterPrimitive[] {
  const document = __testing.parseRenderDocument(source);
  const node = flatten(document.children).find((candidate) => candidate.filter);
  if (!node?.filter) throw new Error("Expected a filter instance");
  return node.filter.primitives;
}

function alphaBitmap(width: number, height: number, alpha: number[]): FilterBitmap {
  return {
    width,
    height,
    values: alpha.flatMap((value) => [0, 0, 0, value]),
  };
}

function expectVector(actual: FilterVector3, expected: FilterVector3, digits = 7): void {
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, digits);
  });
}

describe("SVG filter lighting parsing", () => {
  test("retains diffuse/specular parameters, CSS lighting colors, and every light source", () => {
    const graph =
      primitives(`<svg viewBox="0 0 100 50"><style>.lit { lighting-color: currentColor }</style><defs><filter id="f">
      <feDiffuseLighting class="lit" color="#4080c0" surfaceScale="3" diffuseConstant=".75" kernelUnitLength="2,3" result="d">
        <feDistantLight azimuth="45" elevation="30"/>
      </feDiffuseLighting>
      <feSpecularLighting in="d" lighting-color="#ff8040" surfaceScale="4" specularConstant=".5" specularExponent="16" result="s">
        <fePointLight x="20" y="10" z="30"/>
      </feSpecularLighting>
      <feDiffuseLighting in="s"><feSpotLight x="5" y="6" z="7" pointsAtX="8" pointsAtY="9" pointsAtZ="1" specularExponent="12" limitingConeAngle="25"/></feDiffuseLighting>
    </filter></defs><rect width="100" height="50" filter="url(#f)"/></svg>`);
    expect(graph[0]).toMatchObject({
      type: "diffuseLighting",
      surfaceScale: 3,
      diffuseConstant: 0.75,
      kernelUnitLengthX: 2,
      kernelUnitLengthY: 3,
      color: { red: 64 / 255, green: 128 / 255, blue: 192 / 255, alpha: 1 },
      light: { type: "distant" },
    });
    if (graph[0]?.type !== "diffuseLighting" || graph[0].light?.type !== "distant")
      throw new Error("Expected distant light");
    expect(graph[0].light.x).toBeCloseTo(0.6123724357);
    expect(graph[0].light.y).toBeCloseTo(0.6123724357);
    expect(graph[0].light.z).toBeCloseTo(0.5);
    expect(graph[1]).toMatchObject({
      type: "specularLighting",
      input: { type: "result", index: 0 },
      surfaceScale: 4,
      specularConstant: 0.5,
      specularExponent: 16,
      light: { type: "point", x: 20, y: 10, z: 30 },
    });
    expect(graph[2]).toMatchObject({
      type: "diffuseLighting",
      light: {
        type: "spot",
        x: 5,
        y: 6,
        z: 7,
        pointsAtX: 8,
        pointsAtY: 9,
        pointsAtZ: 1,
        specularExponent: 12,
        limitingConeAngle: 25,
      },
    });
  });

  test("resolves objectBoundingBox light coordinates, height, and kernel distances", () => {
    const graph = primitives(`<svg viewBox="0 0 200 100"><defs><filter id="f" primitiveUnits="objectBoundingBox">
      <feDiffuseLighting surfaceScale=".2" kernelUnitLength=".1 .2"><fePointLight x=".25" y=".5" z=".3"/></feDiffuseLighting>
    </filter></defs><rect x="20" y="10" width="100" height="50" filter="url(#f)"/></svg>`);
    expect(graph[0]).toMatchObject({
      type: "diffuseLighting",
      surfaceScale: Math.sqrt(5000) * 0.2,
      kernelUnitLengthX: 10,
      kernelUnitLengthY: 10,
      light: { type: "point", x: 45, y: 35, z: 0.3 },
    });
  });

  test("diagnoses missing/multiple lights and malformed parameter ranges with deterministic fallbacks", () => {
    const result = convertWithDiagnostics(`<svg viewBox="0 0 10 10"><defs><filter id="f">
      <feDiffuseLighting diffuseConstant="-1" kernelUnitLength="0" lighting-color="not-a-color"/>
      <feSpecularLighting specularConstant="-2" specularExponent="200"><fePointLight/><feDistantLight/></feSpecularLighting>
      <feDiffuseLighting><feSpotLight specularExponent="0"/><feUnknownLight/></feDiffuseLighting>
    </filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>`);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "negative-filter-diffuseconstant",
        "invalid-filter-kernelunitlength",
        "invalid-lighting-color",
        "missing-filter-light-source",
        "negative-filter-specularconstant",
        "invalid-filter-specularexponent-range",
        "multiple-filter-light-sources",
        "unsupported-filter-light-source",
      ]),
    );
    expect(() =>
      convert(`<svg><filter id="f"><feDiffuseLighting/></filter><rect filter="url(#f)"/></svg>`, { strict: true }),
    ).toThrow("requires exactly one");
  });

  test("emits typed Swift lighting primitives instead of pass-through nodes", () => {
    const swift = convert(`<svg viewBox="0 0 10 10"><defs><filter id="f">
      <feDiffuseLighting><feDistantLight elevation="45"/></feDiffuseLighting>
      <feSpecularLighting><feSpotLight z="10"/></feSpecularLighting>
    </filter></defs><circle cx="5" cy="5" r="4" filter="url(#f)"/></svg>`);
    expect(swift).toContain("case diffuseLighting(input: SVGFilterInput");
    expect(swift).toContain("case specularLighting(input: SVGFilterInput");
    expect(swift).toContain("case distant(x: CGFloat");
    expect(swift).toContain("private static func surfaceNormal");
    expect(swift).not.toContain("unsupported-filter-primitive");
  });
});

describe("SVG filter lighting reference math", () => {
  const ramp = alphaBitmap(3, 3, [0, 0.5, 1, 0, 0.5, 1, 0, 0.5, 1]);
  const expectedRampNormal: FilterVector3 = [-Math.SQRT1_2, 0, Math.SQRT1_2];

  test("uses the exact interior, edge, and corner normal kernels", () => {
    expectVector(surfaceNormal(ramp, 1, 1, { surfaceScale: 1 }), expectedRampNormal);
    expectVector(surfaceNormal(ramp, 0, 1, { surfaceScale: 1 }), expectedRampNormal);
    expectVector(surfaceNormal(ramp, 0, 0, { surfaceScale: 1 }), expectedRampNormal);
    expectVector(surfaceNormal(ramp, 2, 2, { surfaceScale: 1 }), expectedRampNormal);
  });

  test("handles constant, transparent, fractional-kernel, and tiny height maps", () => {
    const flat = alphaBitmap(3, 3, Array(9).fill(0.5));
    expectVector(surfaceNormal(flat, 1, 1, { surfaceScale: 5 }), [0, 0, 1]);
    expectVector(surfaceNormal(alphaBitmap(1, 1, [0]), 0, 0, { surfaceScale: 5 }), [0, 0, 1]);
    expect(surfaceNormal(ramp, 1, 1, { surfaceScale: 1, kernelUnitLengthX: 0.5, kernelUnitLengthY: 0.5 })).toEqual(
      expect.arrayContaining([expect.any(Number), expect.any(Number), expect.any(Number)]),
    );
  });

  test("computes opaque diffuse and max-channel-alpha specular output", () => {
    const flat = alphaBitmap(1, 1, [0.5]);
    const light = { type: "distant", x: 0, y: 0, z: 1 } as const;
    expect(
      lightingFilterBitmap(flat, {
        type: "diffuse",
        surfaceScale: 2,
        constant: 0.5,
        color: [0.8, 0.4, 0.2],
        light,
      }).values,
    ).toEqual([0.4, 0.2, 0.1, 1]);
    expect(
      lightingFilterBitmap(flat, {
        type: "specular",
        surfaceScale: 2,
        constant: 0.5,
        specularExponent: 16,
        color: [0.8, 0.4, 0.2],
        light,
      }).values,
    ).toEqual([0.4, 0.2, 0.1, 0.4]);
  });

  test("applies spotlight attenuation and limiting cones", () => {
    const flat = alphaBitmap(1, 1, [0]);
    const inside = lightingFilterBitmap(flat, {
      type: "diffuse",
      surfaceScale: 1,
      constant: 1,
      color: [1, 1, 1],
      light: {
        type: "spot",
        x: 0,
        y: 0,
        z: 10,
        pointsAtX: 0,
        pointsAtY: 0,
        pointsAtZ: 0,
        specularExponent: 4,
        limitingConeAngle: 30,
      },
    });
    const outside = lightingFilterBitmap(flat, {
      type: "diffuse",
      surfaceScale: 1,
      constant: 1,
      color: [1, 1, 1],
      light: {
        type: "spot",
        x: 0,
        y: 0,
        z: 10,
        pointsAtX: 10,
        pointsAtY: 0,
        pointsAtZ: 0,
        specularExponent: 4,
        limitingConeAngle: 30,
      },
    });
    expect(inside.values).toEqual([1, 1, 1, 1]);
    expect(outside.values).toEqual([0, 0, 0, 1]);
  });
});
