import {
  __testing,
  ANIMATION_ATTRIBUTE_REGISTRY,
  animationAttributeSpec,
  convert,
  convertWithDiagnostics,
  parseAnimationValue,
  sampleAnimatedPresentationValue,
  serializeAnimationValue,
} from "../index";

describe("animation target registry", () => {
  test("is machine-readable, unique, and declares invalidation for every supported property", () => {
    const names = ANIMATION_ATTRIBUTE_REGISTRY.map((entry) => entry.canonicalName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        "display",
        "visibility",
        "fill",
        "stroke",
        "opacity",
        "stroke-width",
        "stroke-dasharray",
        "x",
        "cx",
        "points",
        "d",
        "viewBox",
        "preserveAspectRatio",
        "textLength",
        "flood-color",
        "baseFrequency",
      ]),
    );
    expect(ANIMATION_ATTRIBUTE_REGISTRY.every((entry) => entry.invalidates.length > 0)).toBe(true);
    expect(animationAttributeSpec("d")).toMatchObject({ invalidates: expect.arrayContaining(["geometry", "bounds"]) });
    expect(animationAttributeSpec("fill")).toMatchObject({ invalidates: expect.arrayContaining(["paint"]) });
    expect(animationAttributeSpec("viewBox")).toMatchObject({ namespaces: ["XML"] });
    expect(ANIMATION_ATTRIBUTE_REGISTRY.find((entry) => entry.canonicalName === "fill")?.runtimeBinding).toBe(
      "render-node",
    );
    expect(ANIMATION_ATTRIBUTE_REGISTRY.find((entry) => entry.canonicalName === "stop-color")?.runtimeBinding).toBe(
      "gradient-stop",
    );
    expect(ANIMATION_ATTRIBUTE_REGISTRY.find((entry) => entry.canonicalName === "baseFrequency")?.runtimeBinding).toBe(
      "pending-resource",
    );
  });

  test("uses the computed cascade and inherited presentation value as the immutable base", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 40 20">
        <style>#box { x: 12px; opacity: .4 } g { fill: rgb(255, 0, 0) }</style>
        <g><rect id="box" x="2" width="8" height="8">
          <animate attributeName="x" to="20" dur="1s"/>
          <animate attributeName="fill" to="blue" dur="1s"/>
          <animate attributeName="opacity" to="1" dur="1s"/>
        </rect></g>
      </svg>`);
    expect(document.animationProgram.animations[0]?.value).toMatchObject({ base: { family: "length", value: 12 } });
    expect(document.animationProgram.animations[1]?.value).toMatchObject({
      base: { family: "paint", value: { type: "color", color: { red: 1, green: 0, blue: 0 } } },
    });
    expect(document.animationProgram.animations[2]?.value).toMatchObject({ base: { family: "opacity", value: 0.4 } });
  });

  test("resolves anonymous parent, href, and xlink:href targets to the same stable source identity", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20">
        <rect id="named" width="4" height="4"><animate attributeName="x" to="4" dur="1s"/></rect>
        <animate href="#named" attributeName="y" to="4" dur="1s"/>
        <animate xlink:href="#named" attributeName="opacity" to="0" dur="1s"/>
        <circle cx="2" cy="2" r="2"><set attributeName="visibility" to="hidden" dur="1s"/></circle>
      </svg>`);
    expect(document.animationProgram.animations.slice(0, 3).map((item) => item.target?.key)).toEqual([
      "id:named",
      "id:named",
      "id:named",
    ]);
    expect(document.animationProgram.animations[3]?.target?.key).toMatch(/^source:/);
    expect(document.animationProgram.animations.every((item) => item.runtimeSupport === "typed")).toBe(true);
  });

  test("diagnoses namespace, applicability, resource, and non-rendered target errors with stable codes", () => {
    const result = convertWithDiagnostics(`
      <svg viewBox="0 0 20 20">
        <animate attributeName="viewBox" attributeType="CSS" from="0 0 20 20" to="0 0 10 10" dur="1s"/>
        <circle id="dot" r="2"><animate attributeName="x1" from="0" to="2" dur="1s"/></circle>
        <rect id="paint" width="2" height="2"><animate attributeName="fill" to="url(#missing)" dur="1s"/></rect>
        <defs><rect id="unused" width="2" height="2"><animate attributeName="x" to="2" dur="1s"/></rect></defs>
      </svg>`);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "incompatible-animation-attribute-type",
        "non-animatable-target-property",
        "unresolved-animation-resource-reference",
        "wrong-animation-target-type",
      ]),
    );
    expect(() =>
      convert(`<svg viewBox="0 0 10 10"><animate attributeName="viewBox" attributeType="CSS" to="0 0 5 5"/></svg>`, {
        strict: true,
      }),
    ).toThrow(/incompatible-animation-attribute-type/);
  });
});

describe("pure animate/set presentation sampling", () => {
  const source = `
    <svg viewBox="0 0 20 10">
      <rect id="box" x="2" width="4" height="4" fill="red">
        <animate attributeName="x" from="2" to="10" begin=".25s" dur="1s" fill="freeze"/>
        <set attributeName="fill" to="blue" begin=".5s" dur=".25s"/>
      </rect>
    </svg>`;

  test("set applies discretely at begin and removes exactly at end", () => {
    const program = __testing.parseRenderDocument(source).animationProgram;
    const fill = parseAnimationValue(animationAttributeSpec("fill")!, "red", {
      length: {
        viewport: { width: 20, height: 10 },
        rootViewport: { width: 20, height: 10 },
        fontMetrics: { fontSize: 16, rootFontSize: 16, xHeight: 8, zeroAdvance: 8 },
        percentageBasis: "viewport-diagonal",
        axis: "other",
      },
      colorSpace: "sRGB",
    })!;
    const sample = (time: number) =>
      serializeAnimationValue(sampleAnimatedPresentationValue(program, "id:box", "fill", fill, time));
    expect(sample(0.499999)).toContain("255 0 0");
    expect(sample(0.5)).toContain("0 0 255");
    expect(sample(0.749999)).toContain("0 0 255");
    expect(sample(0.75)).toContain("255 0 0");
  });

  test("arbitrary timestamp order has no retained state", () => {
    const program = __testing.parseRenderDocument(source).animationProgram;
    const base = parseAnimationValue(animationAttributeSpec("x")!, "2", {
      length: {
        viewport: { width: 20, height: 10 },
        rootViewport: { width: 20, height: 10 },
        fontMetrics: { fontSize: 16, rootFontSize: 16, xHeight: 8, zeroAdvance: 8 },
        percentageBasis: "viewport-diagonal",
        axis: "horizontal",
      },
    })!;
    const sample = (time: number) =>
      serializeAnimationValue(sampleAnimatedPresentationValue(program, "id:box", "x", base, time));
    const forward = [0, 0.25, 0.75, 1.25, 3].map(sample);
    const shuffled = [3, 0.75, 0, 1.25, 0.25].map((time) => [time, sample(time)] as const);
    expect(Object.fromEntries(shuffled)).toEqual(
      Object.fromEntries([0, 0.25, 0.75, 1.25, 3].map((time, i) => [time, forward[i]])),
    );
  });

  test("generated Swift wires geometry, path, points, stroke, paint, opacity, and set without mutable frame state", () => {
    const swift = convert(
      `
      <svg viewBox="0 0 60 30">
        <g opacity="1"><animate attributeName="opacity" to=".5" dur="1s"/>
          <rect x="1" y="1" width="8" height="6" fill="red" stroke="white" stroke-width="1">
            <animate attributeName="width" to="16" dur="1s"/><animate attributeName="fill" to="blue" dur="1s"/>
            <animate attributeName="stroke-width" to="3" dur="1s"/><set attributeName="visibility" to="hidden" begin=".5s" dur=".1s"/>
          </rect>
          <polygon points="20,2 28,2 24,9"><animate attributeName="points" values="20,2 28,2 24,9;18,8 30,8 24,1" dur="1s"/></polygon>
          <path d="M35 2 L45 2 L40 9 Z"><animate attributeName="d" values="M35 2 L45 2 L40 9 Z;M33 8 L47 8 L40 1 Z" dur="1s"/></path>
        </g>
      </svg>`,
      { structName: "AnimatedProperties", strict: true },
    );
    expect(swift).toContain("svgAnimatedValue(documentTime: documentTime");
    expect(swift).toContain("svgAnimationColor(");
    expect(swift).toContain("strokedPath(StrokeStyle(lineWidth:");
    expect(swift).toContain("switch svgGeometry.signature");
    expect(swift).toContain("switch svgGeometry.components.count / 2");
    expect(swift).toContain('!= "hidden"');
    expect(swift).not.toContain("@State private var");
  });

  test("propagates group presentation animations through inheritance and currentColor", () => {
    const swift = convert(
      `
      <svg viewBox="0 0 30 12">
        <g fill="currentColor" color="red" stroke="black" stroke-width="1">
          <animate attributeName="color" from="red" to="blue" dur="1s"/>
          <animate attributeName="stroke-width" from="1" to="3" dur="1s"/>
          <rect width="8" height="8"/>
          <circle cx="15" cy="4" r="4" fill="green"/>
        </g>
      </svg>`,
      { structName: "InheritedPresentation", strict: true },
    );
    expect(swift).toContain("kind: .paintColor, components: [1, 0, 0, 1]");
    expect(swift).toContain("kind: .paintColor, components: [0, 0, 1, 1]");
    expect(swift).toMatch(/svgAnimationColor\([\s\S]*svgAnimatedValue\(documentTime: documentTime/);
    expect(swift).toMatch(/strokedPath\(StrokeStyle\(lineWidth:[\s\S]*svgAnimatedValue\(documentTime: documentTime/);
  });

  test("wires animated gradient stop offset, color, and opacity as resource presentation", () => {
    const source = `
      <svg viewBox="0 0 30 12">
        <defs><linearGradient id="paint">
          <stop id="animated-stop" offset="0" stop-color="red" stop-opacity="1">
            <animate attributeName="offset" from="0" to=".7" dur="1s"/>
            <animate attributeName="stop-color" from="red" to="blue" dur="1s"/>
            <animate attributeName="stop-opacity" from="1" to=".4" dur="1s"/>
          </stop>
          <stop offset="1" stop-color="white"/>
        </linearGradient></defs>
        <rect width="30" height="12" fill="url(#paint)"/>
      </svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(document.animationProgram.animations).toHaveLength(3);
    expect(document.animationProgram.animations.every((item) => item.runtimeSupport === "typed")).toBe(true);
    expect(document.animationProgram.animations[0]?.target).toMatchObject({
      key: "id:animated-stop",
      binding: "resource",
    });
    const swift = convert(source, { structName: "AnimatedGradient", strict: true });
    expect(swift).toContain("svgAnimatedGradientStop(offset:");
    expect(swift).toContain("svgNormalizedGradientStops");
    expect(swift).toContain("kind: .color");
    expect(swift).toContain("kind: .opacity");
  });

  test("recomputes nested viewport mapping from the sampled viewBox", () => {
    const swift = convert(
      `
      <svg viewBox="0 0 40 20">
        <svg id="nested" x="10" y="2" width="20" height="16" viewBox="0 0 20 16">
          <rect width="8" height="8"/>
        </svg>
        <animate href="#nested" attributeName="viewBox" values="0 0 20 16;4 2 12 10" dur="1s"/>
      </svg>`,
      { structName: "AnimatedViewport", strict: true },
    );
    expect(swift).toContain("GeometryReader { proxy in");
    expect(swift).toContain("svgAnimatedViewBoxTransform(value:");
    expect(swift).toContain("outputSize: proxy.size");
    expect(swift).toContain("staticTransform: CGAffineTransform");
  });
});
