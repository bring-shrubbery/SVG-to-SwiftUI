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
      "resource",
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

  test("rejects attributes that do not apply to a filter primitive", () => {
    const result = convertWithDiagnostics(`
      <svg><defs><filter id="f"><feGaussianBlur id="blur"><animate attributeName="cx" values="0;10" dur="1s"/></feGaussianBlur></filter></defs><rect width="10" height="10" filter="url(#f)"/></svg>
    `);
    expect(result.diagnostics.map((item) => item.code)).toContain("non-animatable-target-property");
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

  test("wires animated gradient coordinates, transforms, spread, and interpolation", () => {
    const source = `
      <svg viewBox="0 0 40 20"><defs>
        <linearGradient id="paint" x2="40%" spreadMethod="pad">
          <animate attributeName="x2" values="40%;100%" dur="2s"/>
          <animate attributeName="spreadMethod" values="pad;reflect" dur="2s" calcMode="discrete"/>
          <animate attributeName="color-interpolation" values="sRGB;linearRGB" dur="2s" calcMode="discrete"/>
          <animate attributeName="gradientTransform" values="rotate(0 .5 .5);rotate(25 .5 .5)" dur="2s"/>
          <stop stop-color="#38bdf8"/><stop offset="1" stop-color="#f97316"/>
        </linearGradient>
      </defs><rect width="40" height="20" fill="url(#paint)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(document.animationProgram.animations).toHaveLength(4);
    expect(document.animationProgram.animations.every((item) => item.runtimeSupport === "typed")).toBe(true);
    const swift = convert(source, { structName: "AnimatedGradientGeometry", strict: true });
    expect(swift).toContain("svgAnimationNumber(");
    expect(swift).toContain("svgAnimationTransform(");
    expect(swift).toContain('== "reflect"');
    expect(swift).toContain('lowercased() == "linearrgb"');
  });

  test("renders animated pattern, clip, mask, and marker content at document time", () => {
    const source = `
      <svg viewBox="0 0 80 30"><defs>
        <pattern id="p" x="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <animate attributeName="x" values="0;4" dur="2s"/><animate attributeName="width" values="10;5" dur="2s"/>
          <animate attributeName="patternTransform" values="translate(0 0);translate(3 1)" dur="2s"/>
          <rect width="4" height="10" fill="#38bdf8"><animate attributeName="width" values="2;8" dur="2s"/></rect>
        </pattern>
        <clipPath id="c" transform="translate(0 0)"><animateTransform attributeName="transform" type="translate" values="0 0;2 1" dur="2s"/><circle cx="15" cy="15" r="4"><animate attributeName="r" values="4;12" dur="2s"/></circle></clipPath>
        <mask id="m" x="-10%" width="120%"><animate attributeName="x" values="-10%;0%" dur="2s"/><animate attributeName="width" values="120%;100%" dur="2s"/><rect x="0" width="30" height="30" fill="white"><animate attributeName="x" values="0;12" dur="2s"/></rect></mask>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="0" markerUnits="userSpaceOnUse"><animate attributeName="orient" values="0;45" dur="2s"/><animate attributeName="markerUnits" values="userSpaceOnUse;strokeWidth" dur="2s" calcMode="discrete"/><path d="M0 0L8 4L0 8Z" fill="red"><animate attributeName="fill" values="red;yellow" dur="2s"/></path></marker>
      </defs>
      <rect width="30" height="30" fill="url(#p)" clip-path="url(#c)" mask="url(#m)"/>
      <path d="M40 15H75" stroke="white" marker-end="url(#arrow)"/>
      </svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(document.animationProgram.animations).toHaveLength(12);
    expect(document.animationProgram.animations.every((item) => item.runtimeSupport === "typed")).toBe(true);
    const swift = convert(source, { structName: "AnimatedResourceContent", strict: true });
    expect(swift.match(/svgAnimatedValue\(documentTime: documentTime/g)?.length).toBeGreaterThanOrEqual(4);
    expect(swift).toContain("graphics.concatenate(AnimatedResourceContent.svgMultiplyTransform(");
    expect(swift).toContain("svgAnimatedTransformCorrection(animatedBase:");
    expect(swift).toMatch(/MaskClip\d+\(documentTime: documentTime\)/);
    expect(swift).toContain('== "strokeWidth"');
    expect(swift).toMatch(/columnX:|let offsetX/);
    expect(swift).not.toContain("@State private var");
  });

  test("samples filter parameters per consumer without mutable frame caches", () => {
    const source = `
      <svg viewBox="0 0 80 30"><defs><filter id="fx" x="-10%" width="120%" primitiveUnits="objectBoundingBox">
        <animate attributeName="x" values="-10%;-20%" dur="2s"/>
        <animate attributeName="width" values="120%;150%" dur="2s"/>
        <feGaussianBlur stdDeviation=".02 .04"><animate attributeName="stdDeviation" values=".02 .04;.08 .02" dur="2s"/></feGaussianBlur>
        <feOffset x="-.1" width="1.2" dx=".02" dy=".04"><animate attributeName="x" values="-.1;0" dur="2s"/><animate attributeName="width" values="1.2;.9" dur="2s"/><animate attributeName="dx" values=".02;.12" dur="2s"/><animate attributeName="dy" values=".04;-.04" dur="2s"/></feOffset>
      </filter></defs>
      <rect x="5" y="5" width="25" height="20" fill="#38bdf8" filter="url(#fx)"/>
      <rect x="45" y="8" width="30" height="14" fill="#f97316" filter="url(#fx)"/>
      </svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(document.animationProgram.animations).toHaveLength(7);
    expect(document.animationProgram.animations.every((item) => item.runtimeSupport === "typed")).toBe(true);
    const swift = convert(source, { structName: "AnimatedFilterParameters", strict: true });
    expect(swift).toContain("svgAnimationComponent(");
    expect(swift).toMatch(/sigmaX: hypot\(/);
    expect(swift).toMatch(/dx: 1 \* \(/);
    expect(swift.match(/svgTransformedFilterRegion\(x:/g)?.length).toBeGreaterThanOrEqual(2);
    expect(swift).not.toContain("@State private var");
  });

  test("wires animated filter matrices, transfer functions, colors, noise, convolution, and lights", () => {
    const source = `
      <svg viewBox="0 0 80 40"><defs><filter id="fx" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence baseFrequency=".02 .03" numOctaves="1" seed="2" result="noise">
          <animate attributeName="baseFrequency" values=".02 .03;.06 .04" dur="2s"/>
          <animate attributeName="numOctaves" values="1;2" dur="2s"/>
          <animate attributeName="seed" values="2;8" dur="2s"/>
          <animate attributeName="stitchTiles" values="noStitch;stitch" dur="2s" calcMode="discrete"/>
          <animate attributeName="type" values="turbulence;fractalNoise" dur="2s" calcMode="discrete"/>
        </feTurbulence>
        <feColorMatrix in="noise" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="matrix">
          <animate attributeName="values" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0;.5 0 0 0 0 0 .8 0 0 0 0 0 1 0 0 0 0 0 1 0" dur="2s"/>
        </feColorMatrix>
        <feComponentTransfer in="matrix" result="transfer"><feFuncR type="linear" slope="1" intercept="0">
          <animate attributeName="slope" values="1;.5" dur="2s"/><animate attributeName="intercept" values="0;.2" dur="2s"/>
        </feFuncR></feComponentTransfer>
        <feConvolveMatrix in="transfer" order="3" kernelMatrix="0 0 0 0 1 0 0 0 0" divisor="1" bias="0" result="convolved">
          <animate attributeName="kernelMatrix" values="0 0 0 0 1 0 0 0 0;0 -1 0 -1 5 -1 0 -1 0" dur="2s"/>
          <animate attributeName="bias" values="0;.05" dur="2s"/>
          <animate attributeName="edgeMode" values="none;wrap" dur="2s" calcMode="discrete"/>
          <animate attributeName="preserveAlpha" values="false;true" dur="2s" calcMode="discrete"/>
        </feConvolveMatrix>
        <feComposite in="convolved" in2="SourceGraphic" operator="arithmetic" k1="0" k2="1" k3="0" k4="0" result="composite">
          <animate attributeName="k3" values="0;.5" dur="2s"/>
          <animate attributeName="operator" values="arithmetic;over" dur="2s" calcMode="discrete"/>
        </feComposite>
        <feFlood flood-color="#38bdf8" flood-opacity="1" result="flood">
          <animate attributeName="flood-color" values="#38bdf8;#f97316" dur="2s"/>
          <animate attributeName="flood-opacity" values="1;.4" dur="2s"/>
        </feFlood>
        <feDiffuseLighting in="composite" surfaceScale="1" diffuseConstant="1" lighting-color="white" result="lit">
          <animate attributeName="surfaceScale" values="1;3" dur="2s"/>
          <animate attributeName="lighting-color" values="white;#facc15" dur="2s"/>
          <fePointLight x="20" y="10" z="30"><animate attributeName="x" values="20;60" dur="2s"/></fePointLight>
        </feDiffuseLighting>
        <feBlend in="lit" in2="flood" mode="screen"><animate attributeName="in" values="lit;flood" dur="2s" calcMode="discrete"/><animate attributeName="in2" values="flood;lit" dur="2s" calcMode="discrete"/><animate attributeName="mode" values="screen;multiply" dur="2s" calcMode="discrete"/></feBlend>
      </filter></defs><rect x="10" y="8" width="60" height="24" fill="#a78bfa" filter="url(#fx)"/></svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(document.animationProgram.animations).toHaveLength(22);
    expect(document.animationProgram.animations.every((item) => item.runtimeSupport === "typed")).toBe(true);
    const swift = convert(source, { structName: "AnimatedFilterGraph", strict: true });
    expect(swift).toContain(".components");
    expect(swift).toContain("svgAnimationFilterColor(");
    expect(swift).toContain(".linear(slope:");
    expect(swift).toContain(".point(x:");
    expect(swift).toContain("octaves: Int(");
    expect(swift).toContain('== "stitch"');
    expect(swift).toContain("? .multiply");
    expect(swift).toMatch(/input: \([^\n]+\? \.result\(/);
    expect(swift).toContain("? .wrap");
    expect(swift).not.toContain("@State private var");
  });

  test("wires tspan positioning, length, paint, typography, and textPath offset", () => {
    const source = `
      <svg viewBox="0 0 160 50"><defs><path id="curve" d="M10 35H150"/></defs>
        <text x="10" y="18" font-size="10"><tspan x="12" dx="0 1 2 3 4" rotate="0 2 4 6 8" textLength="44" fill="red">Swift
          <animate attributeName="x" values="12;70" dur="2s"/>
          <animate attributeName="textLength" values="44;70" dur="2s"/>
          <animate attributeName="font-size" values="10;16" dur="2s"/>
          <animate attributeName="fill" values="red;blue" dur="2s"/>
          <animate attributeName="dx" values="0 1 2 3 4;4 3 2 1 0" dur="2s"/>
          <animate attributeName="rotate" values="0 2 4 6 8;8 6 4 2 0" dur="2s"/>
        </tspan></text>
        <text font-size="9"><textPath href="#curve" startOffset="0">Path
          <animate attributeName="startOffset" values="0;100" dur="2s"/>
        </textPath></text>
      </svg>`;
    const document = __testing.parseRenderDocument(source);
    expect(document.animationProgram.animations).toHaveLength(7);
    expect(document.animationProgram.animations.every((item) => item.runtimeSupport === "typed")).toBe(true);
    const swift = convert(source, { structName: "AnimatedTextResources", strict: true });
    expect(swift).toMatch(/SVGTextChunk\(x: AnimatedTextResources\.svgAnimationNumber/);
    expect(swift).toMatch(/target: \(AnimatedTextResources\.svgAnimationNumber/);
    expect(swift).toMatch(/startOffset: AnimatedTextResources\.svgAnimationNumber/);
    expect(swift).toMatch(/size: AnimatedTextResources\.svgAnimationNumber/);
    expect(swift).toContain("svgAnimationColor(");
    expect(swift).toMatch(/SVGTextCharacter\(text: "S", dx: AnimatedTextResources\.svgAnimationComponent/);
    expect(swift).toMatch(/rotation: AnimatedTextResources\.svgAnimationComponent/);
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

  test("keeps shared animated resources deterministic and bounded across many consumers", () => {
    const consumers = Array.from({ length: 48 }, (_, index) => {
      const x = (index % 12) * 10;
      const y = Math.floor(index / 12) * 10;
      const width = 5 + (index % 4);
      return `<rect x="${x}" y="${y}" width="${width}" height="7" fill="url(#p)" filter="url(#f)"/>`;
    }).join("");
    const source = `<svg viewBox="0 0 120 40"><defs>
      <pattern id="p" width=".25" height=".25"><rect width=".15" height=".25" fill="red"><animate attributeName="width" values=".15;.25" dur="1s" repeatCount="indefinite"/></rect></pattern>
      <filter id="f" primitiveUnits="objectBoundingBox"><feGaussianBlur stdDeviation=".01"><animate attributeName="stdDeviation" values=".01;.04" dur="1s" repeatCount="indefinite"/></feGaussianBlur></filter>
    </defs>${consumers}</svg>`;
    const started = performance.now();
    const first = convert(source, { structName: "ManyAnimatedConsumers", strict: true });
    const elapsed = performance.now() - started;
    const second = convert(source, { structName: "ManyAnimatedConsumers", strict: true });
    expect(second).toBe(first);
    expect(first.length).toBeLessThan(2_000_000);
    expect(elapsed).toBeLessThan(2_000);
    expect(first).not.toContain("Dictionary<Double");
    expect(first).not.toContain("lastDocumentTime");
  });
});
