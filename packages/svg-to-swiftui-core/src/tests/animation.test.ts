import { __testing, convert, convertWithDiagnostics, sampleNumericAnimation } from "../index";

const numericAnimation = `
  <svg viewBox="0 0 100 40">
    <circle id="dot" cx="16" cy="20" r="8" fill="#38bdf8">
      <animate id="move" attributeName="cx" begin="250ms" dur="1s" from="16" to="80" fill="freeze"/>
    </circle>
  </svg>`;

describe("typed SVG animation program", () => {
  test("preserves parent and href targets, typed timing, base values, dependencies, and source order", () => {
    const document = __testing.parseRenderDocument(`
      <svg viewBox="0 0 20 20">
        <circle id="parent" cx="2" cy="2" r="2">
          <animate id="first" attributeName="cx" from="2" to="10" dur="1s"/>
        </circle>
        <animate id="second" href="#parent" attributeName="cx" from="10" to="2" begin="first.end+250ms" dur="2s"/>
      </svg>`);

    expect(document.animationProgram.animations).toHaveLength(2);
    expect(document.animationProgram.animations[0]).toMatchObject({
      stableId: "first",
      kind: "animate",
      target: { key: "id:parent", reference: { type: "parent" }, renderable: true },
      attributeName: "cx",
      value: { type: "number", base: 2, from: 2, to: 10 },
      timing: { begin: [{ type: "offset", seconds: 0 }], duration: { type: "seconds", seconds: 1 } },
      documentOrder: expect.any(Number),
    });
    expect(document.animationProgram.animations[1]).toMatchObject({
      stableId: "second",
      target: { reference: { type: "local", id: "parent" } },
      dependencies: ["first"],
      timing: { begin: [{ type: "syncbase", animationId: "first", phase: "end", offsetSeconds: 0.25 }] },
    });
    expect(document.animationProgram.evaluationOrder).toEqual(["first", "second"]);
  });

  test("assigns deterministic stable ids without changing authored targets", () => {
    const first = __testing.parseRenderDocument(numericAnimation).animationProgram;
    const second = __testing.parseRenderDocument(numericAnimation).animationProgram;
    expect(second).toEqual(first);
    expect(first.animations[0]?.stableId).toBe("move");

    const anonymous = __testing.parseRenderDocument(
      `<svg viewBox="0 0 10 10"><rect id="box" width="2" height="2"><animate attributeName="x" from="0" to="8" dur="1s"/></rect></svg>`,
    );
    expect(anonymous.animationProgram.animations[0]?.stableId).toMatch(/^animation-\d{6}$/);
  });

  test("emits structured target, value, dependency, and cycle diagnostics", () => {
    const result = convertWithDiagnostics(`
      <svg viewBox="0 0 20 20">
        <rect id="duplicate" width="2" height="2"/><circle id="duplicate" r="1"/>
        <animate id="missing" href="#nope" attributeName="x" from="0" to="1" dur="1s"/>
        <animate id="ambiguous" href="#duplicate" attributeName="x" from="0" to="1" dur="1s"/>
        <animate id="wrong" href="#missing" attributeName="x" from="0" to="1" dur="1s"/>
        <animate id="color" href="#duplicate" attributeName="fill" from="red" to="blue" dur="1s"/>
        <animate id="a" href="#duplicate" attributeName="x" from="0" to="1" begin="b.end" dur="1s"/>
        <animate id="b" href="#duplicate" attributeName="x" from="0" to="1" begin="a.end" dur="1s"/>
      </svg>`);
    const codes = result.diagnostics.map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "missing-animation-target",
        "duplicate-animation-target-id",
        "wrong-animation-target-type",
        "unsupported-animation-value",
        "cyclic-animation-dependency",
      ]),
    );
    expect(result.diagnostics.every((item) => item.source && item.fallback)).toBe(true);
  });
});

describe("generated animation clock", () => {
  test("samples negative, zero, fractional, non-finite, and very large exact times deterministically", () => {
    const animation = __testing.parseRenderDocument(numericAnimation).animationProgram.animations[0]!;
    expect(sampleNumericAnimation(animation, -1)).toBe(16);
    expect(sampleNumericAnimation(animation, 0)).toBe(16);
    expect(sampleNumericAnimation(animation, 0.25)).toBe(16);
    expect(sampleNumericAnimation(animation, 0.75)).toBe(48);
    expect(sampleNumericAnimation(animation, Number.NaN)).toBe(16);
    expect(sampleNumericAnimation(animation, Number.MAX_VALUE)).toBe(80);
  });

  test("emits one document clock, exact injection, and a production TimelineView adapter", () => {
    const swift = convert(numericAnimation, { structName: "AnimatedDot", strict: true });
    expect(swift).toContain("struct AnimatedDot: View");
    expect(swift).toContain("init(documentTime: Double? = nil, respectsReducedMotion: Bool = false)");
    expect(swift).toContain("TimelineView(.animation(paused:");
    expect(swift).toContain("content(at: Self.sanitizedDocumentTime(documentTime))");
    expect(swift).toContain("svgAnimatedNumber(documentTime: documentTime");
    expect(swift).toContain(".offset(x:");
    expect(swift.match(/TimelineView/g)).toHaveLength(1);
  });

  test("keeps static output on the Shape fast path without animation runtime code", () => {
    const source = `<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`;
    const first = convert(source, { structName: "StaticBox" });
    const second = convert(source, { structName: "StaticBox" });
    expect(first).toBe(second);
    expect(first).toContain("struct StaticBox: Shape");
    expect(first).not.toContain("TimelineView");
    expect(first).not.toContain("documentTime");
  });
});
