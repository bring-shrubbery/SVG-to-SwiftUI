import { __testing, convert, convertWithDiagnostics, type StaticEnvironment } from "../index";
import type { RenderNode } from "../renderTree/types";

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => (node.type === "group" ? [node, ...flatten(node.children)] : [node]));
}

function document(source: string, staticEnvironment?: StaticEnvironment) {
  return __testing.parseRenderDocument(source, { staticEnvironment });
}

function node(source: string, id: string, staticEnvironment?: StaticEnvironment): RenderNode | undefined {
  return flatten(document(source, staticEnvironment).children).find((candidate) => candidate.source.id === id);
}

describe("static SVG accessibility semantics", () => {
  test("maps title and desc onto a generated View without rendering metadata", () => {
    const source = `<svg viewBox="0 0 10 10"><title>Unicode ✓ icon</title><desc> A  concise\n description </desc><metadata>do-not-render-metadata</metadata><rect width="10" height="10"/></svg>`;
    const output = convert(source);

    expect(output).toContain("struct MyCustomShape: View");
    expect(output).toContain('.accessibilityLabel("Unicode ✓ icon")');
    expect(output).toContain('.accessibilityHint("A concise description")');
    expect(output).toContain(".accessibilityElement(children: .contain)");
    expect(output).toContain(".accessibilityAddTraits(.isImage)");
    expect(output).not.toContain("do-not-render-metadata");
  });

  test("uses ARIA precedence and concatenates multiple labelled references", () => {
    const source = `
      <svg viewBox="0 0 10 10"><defs>
        <g id="first"><title>Primary</title></g>
        <text id="second">status ✓</text>
        <desc id="details">Detailed explanation</desc>
      </defs>
      <rect id="target" width="10" height="10" aria-labelledby="first second" aria-label="Ignored"
        aria-describedby="details"><title>Fallback title</title><desc>Fallback desc</desc></rect></svg>
    `;

    expect(node(source, "target")?.accessibility).toMatchObject({
      label: "Primary status ✓",
      description: "Detailed explanation",
      role: "graphics-symbol",
    });
  });

  test("keeps group and child semantics on their closest generated views", () => {
    const output = convert(`
      <svg viewBox="0 0 10 10"><g><title>Controls</title>
        <rect width="5" height="10"><title>Decrease</title></rect>
        <rect x="5" width="5" height="10" role="button" aria-label="Increase"/>
      </g></svg>
    `);

    expect(output).toContain('.accessibilityLabel("Controls")');
    expect(output).toContain('.accessibilityLabel("Decrease")');
    expect(output).toContain('.accessibilityLabel("Increase")');
    expect(output).toContain(".accessibilityAddTraits(.isButton)");
  });

  test("honors aria-hidden ancestry and selects localized descriptive siblings", () => {
    const source = `
      <svg viewBox="0 0 10 10"><g aria-hidden="true"><rect id="hidden" width="2" height="2" aria-hidden="false"><title>Hidden</title></rect></g>
      <rect id="localized" width="10" height="10"><title lang="en">Favorite</title><title xml:lang="lt">Mėgstamiausia</title>
        <desc lang="en">English detail</desc><desc xml:lang="lt">Lietuviškas aprašas</desc></rect></svg>
    `;

    expect(node(source, "hidden")?.accessibility).toMatchObject({ hidden: true });
    expect(
      node(source, "localized", { preferredLanguages: ["en"], accessibilityLocale: "lt-LT" })?.accessibility,
    ).toMatchObject({ label: "Mėgstamiausia", description: "Lietuviškas aprašas", language: "lt" });
    const output = convert(source, { staticEnvironment: { preferredLanguages: ["lt"] } });
    expect(output).toContain(".accessibilityHidden(true)");
    expect(output).toContain('.accessibilityLabel("Mėgstamiausia")');
  });

  test("diagnoses broken and cyclic ARIA ID references without crashing", () => {
    const result = convertWithDiagnostics(`
      <svg viewBox="0 0 10 10"><g id="a" aria-labelledby="b"><title>Alpha</title><rect width="2" height="2"/></g>
        <g id="b" aria-labelledby="a missing"><title>Beta</title><rect x="2" width="2" height="2"/></g></svg>
    `);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["broken-accessibility-reference", "cyclic-accessibility-reference"]),
    );
    expect(result.swift).toContain("struct MyCustomShape: View");
  });

  test("uses meaningful text as the text element's accessible name", () => {
    expect(convert(`<svg viewBox="0 0 20 10"><text x="1" y="8"> Hello <tspan>world</tspan> </text></svg>`)).toContain(
      '.accessibilityLabel("Hello world")',
    );
    expect(
      node(
        `<svg viewBox="0 0 20 10"><text id="labelled" aria-label="Override"><title>Tooltip</title>Visible</text></svg>`,
        "labelled",
      )?.accessibility,
    ).toMatchObject({ label: "Override", description: "Visible" });
  });
});

describe("static SVG conditional processing", () => {
  const switchSource = `
    <svg viewBox="0 0 10 10"><switch>
      <rect id="extension" width="1" height="1" requiredExtensions="https://example.test/a https://example.test/b"/>
      <circle id="language" cx="2" cy="2" r="2" systemLanguage="en-US, de"/>
      <path id="fallback" d="M0 0h3v3z"/>
    </switch></svg>
  `;

  test("selects the first matching child, a later language match, or the fallback", () => {
    expect(
      node(switchSource, "extension", {
        supportedExtensions: ["https://example.test/a", "https://example.test/b"],
      }),
    ).toBeDefined();
    expect(node(switchSource, "language", { preferredLanguages: ["en"] })).toBeDefined();
    expect(node(switchSource, "fallback")).toBeDefined();
  });

  test("requires every extension and renders nothing when no child matches", () => {
    expect(node(switchSource, "extension", { supportedExtensions: ["https://example.test/a"] })).toBeUndefined();
    const noMatch = document(
      `<svg viewBox="0 0 10 10"><switch><rect id="one" requiredExtensions="x"/><circle id="two" systemLanguage="fr"/></switch></svg>`,
      { preferredLanguages: ["en"] },
    );
    const switchNode = flatten(noMatch.children).find((candidate) => candidate.source.element === "switch");
    expect(switchNode?.type === "group" ? switchNode.children : undefined).toEqual([]);
  });

  test.each([
    [["en"], "en-US", true],
    [["en-US"], "en", false],
    [["lt", "de"], "fr, de-DE", true],
    [[], "en", false],
  ] as const)("matches language preferences %p against %s", (preferredLanguages, systemLanguage, expected) => {
    const source = `<svg viewBox="0 0 10 10"><rect id="target" width="10" height="10" systemLanguage="${systemLanguage}"/></svg>`;
    expect(node(source, "target", { preferredLanguages })).toEqual(expected ? expect.anything() : undefined);
  });

  test("selects display-none children without falling through", () => {
    const selected = document(`
      <svg viewBox="0 0 10 10"><switch><rect id="selected" display="none" width="5" height="5"/>
        <circle id="not-selected" r="4"/></switch></svg>
    `);
    expect(
      node(
        `<svg viewBox="0 0 10 10"><switch><rect id="selected" display="none"/><circle id="not-selected"/></switch></svg>`,
        "selected",
      ),
    ).toBeDefined();
    expect(flatten(selected.children).some((candidate) => candidate.source.id === "not-selected")).toBe(false);
  });

  test("uses explicit SVG 1.1 feature support and documents SVG 2 legacy behavior", () => {
    const source = `<svg viewBox="0 0 10 10"><switch><rect id="feature" width="2" height="2" requiredFeatures="feature:a"/><circle id="fallback" r="2"/></switch></svg>`;
    expect(node(source, "fallback", { svgVersion: "1.1" })).toBeDefined();
    expect(node(source, "feature", { svgVersion: "1.1", supportedFeatures: ["feature:a"] })).toBeDefined();
    const svg2 = convertWithDiagnostics(source);
    expect(svg2.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "obsolete-required-features" })]),
    );
    expect(node(source, "feature")).toBeDefined();
  });

  test("applies conditionals outside switch and inside referenced use content", () => {
    const source = `
      <svg viewBox="0 0 10 10"><defs><g id="asset"><rect id="referenced" width="4" height="4" requiredExtensions="asset:v1"/></g></defs>
        <use id="host" href="#asset"/><circle id="outside" r="2" systemLanguage="fr"/>
        <use id="suppressed-use" href="#asset" requiredExtensions="missing"/>
      </svg>
    `;
    const resolved = document(source, { preferredLanguages: ["en"], supportedExtensions: ["asset:v1"] });
    const ids = flatten(resolved.children).map((candidate) => candidate.source.id);
    expect(ids).toContain("referenced");
    expect(ids).not.toContain("outside");
    expect(ids).not.toContain("suppressed-use");
  });

  test("keeps scripts non-visual and makes static conformance observable", () => {
    const source = `<svg viewBox="0 0 10 10"><script>bad()</script><metadata>data</metadata><rect width="10" height="10"/></svg>`;
    expect(convertWithDiagnostics(source).diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unsupported-script" })]),
    );
    expect(() => convert(source, { strict: true })).toThrow("scripts are not executed");
  });
});
