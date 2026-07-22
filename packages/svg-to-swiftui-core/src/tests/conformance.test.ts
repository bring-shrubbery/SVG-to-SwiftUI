import { validateConformance } from "../../conformance/model";
import { convert, convertDetailed, convertWithDiagnostics } from "../index";

describe("static SVG conformance contract", () => {
  test("classifies the complete normative inventory with terminal evidence", () => {
    expect(validateConformance()).toEqual([]);
  });

  test("returns the detailed result contract and exact exercised vocabulary", () => {
    const result = convertDetailed(
      `<svg viewBox="0 0 20 20"><rect id="box" width="20" height="20" style="fill:red;opacity:.5"/></svg>`,
    );

    expect(result.outputMode).toBe("view");
    expect(result.source).toContain("struct MyCustomShape: View");
    expect(result.artifacts).toEqual([]);
    expect(result.conformance).toMatchObject({
      manifestVersion: "1.0.0",
      profile: "svg2-static-swiftui",
      warningCount: 0,
      errorCount: 0,
    });
    expect(result.conformance.exercised).toEqual(
      expect.arrayContaining([
        { kind: "element", name: "rect", status: "supported" },
        { kind: "attribute", name: "width", status: "supported" },
        { kind: "property", name: "fill", status: "supported" },
      ]),
    );
  });

  test("diagnoses every excluded dynamic element, event handler, and navigation", () => {
    const tags = [
      "animate",
      "animateMotion",
      "animateTransform",
      "audio",
      "canvas",
      "discard",
      "iframe",
      "mpath",
      "script",
      "set",
      "video",
    ];
    const source = `<svg viewBox="0 0 10 10" onload="boot()"><a id="link" href="/next"><rect width="10" height="10"/></a>${tags
      .map((tag) => `<${tag} id="${tag}"/>`)
      .join("")}</svg>`;
    const result = convertWithDiagnostics(source);

    expect(result.swift).toContain("path.addRect");
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "dynamic-event-handler",
        "dynamic-navigation",
        ...tags.map((tag) => (tag === "script" ? "unsupported-script" : `dynamic-${tag.toLowerCase()}`)),
      ]),
    );
    expect(result.diagnostics.every((item) => item.location && item.fallback)).toBe(true);
    expect(result.diagnostics.find((item) => item.code === "dynamic-event-handler")?.attribute).toBe("onload");
  });

  test("reports diagnostics once in deterministic source order and strict mode fails visibly", () => {
    const source = `<svg viewBox="0 0 10 10"><video id="first"/><script id="second"/></svg>`;
    const reported: string[] = [];
    const permissive = convertWithDiagnostics(source, { onDiagnostic: (diagnostic) => reported.push(diagnostic.code) });

    expect(reported).toEqual(permissive.diagnostics.map((item) => item.code));
    expect(permissive.diagnostics.map((item) => item.source.id)).toEqual(["first", "second"]);
    expect(() => convert(source, { strict: true })).toThrow(/\[dynamic-video\].*at 1:\d+/);
  });

  test("keeps embeddedOnly conversion free of ambient resource I/O", () => {
    const resolver = jest.fn();
    const result = convertDetailed(`<svg viewBox="0 0 10 10"><image href="https://example.test/pixel.png"/></svg>`, {
      resources: { policy: "embeddedOnly", resolver },
    });

    expect(resolver).not.toHaveBeenCalled();
    expect(result.diagnostics.some((item) => /resource|image/.test(item.code))).toBe(true);
  });

  test("fuzzes deterministic numeric lists, references, and cycles without unstable ordering", () => {
    let state = 0x5eed;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    for (let sample = 0; sample < 100; sample++) {
      const list = Array.from({ length: 1 + Math.floor(random() * 8) }, () => (random() * 20 - 5).toFixed(3)).join(",");
      const source = `<svg viewBox="0 0 20 20"><defs><linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/></defs><path d="M0 0L20 20" stroke="url(#missing) red" stroke-dasharray="${list}"/></svg>`;
      const first = convertWithDiagnostics(source).diagnostics.map((item) => item.code);
      const second = convertWithDiagnostics(source).diagnostics.map((item) => item.code);
      expect(second).toEqual(first);
    }
  });

  test("never writes unsupported elements to console", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const result = convertWithDiagnostics(`<svg viewBox="0 0 10 10"><mesh id="future"/></svg>`);
    expect(result.diagnostics.map((item) => item.code)).toContain("unsupported-element");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
