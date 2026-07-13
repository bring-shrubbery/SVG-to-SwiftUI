import { __testing } from "../index";
import type { RenderGroup, RenderNode, RenderShape } from "../renderTree/types";

function flatten(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => [node, ...(node.type === "group" ? flatten(node.children) : [])]);
}

function document(source: string) {
  return __testing.parseRenderDocument(source);
}

function shape(source: string, id = "target"): RenderShape {
  const result = flatten(document(source).children).find(
    (node): node is RenderShape => node.type === "shape" && node.source.id === id,
  );
  if (!result) throw new Error(`Missing shape #${id}`);
  return result;
}

function solid(paint: RenderShape["style"]["fill"]): string | undefined {
  return paint.type === "solid" ? paint.value : undefined;
}

describe("embedded CSS cascade", () => {
  test("orders declarations by importance, specificity, and source order", () => {
    const result = shape(`
      <svg viewBox="0 0 10 10"><style>
        * { fill: red }
        rect { fill: orange }
        .shape { fill: green }
        #target { fill: blue }
        #target { fill: purple }
      </style><rect id="target" class="shape" fill="teal" width="10" height="10" /></svg>
    `);
    expect(solid(result.style.fill)).toBe("purple");
    expect(result.style.provenance.fill?.selector).toBe("#target");

    const important = shape(`
      <svg viewBox="0 0 10 10"><style>.shape { fill: red !important }</style>
      <rect id="target" class="shape" style="fill: blue" width="10" height="10" /></svg>
    `);
    expect(solid(important.style.fill)).toBe("red");

    const inlineImportant = shape(`
      <svg viewBox="0 0 10 10"><style>#target { fill: red !important }</style>
      <rect id="target" style="fill: blue !important" width="10" height="10" /></svg>
    `);
    expect(solid(inlineImportant.style.fill)).toBe("blue");

    const repeatedId = shape(`
      <svg viewBox="0 0 10 10"><style>#target#target { fill: red }</style>
      <rect id="target" style="fill: blue" width="10" height="10" /></svg>
    `);
    expect(solid(repeatedId.style.fill)).toBe("blue");
  });

  test("applies presentation attributes at specificity zero and inline style last", () => {
    const presentation = shape(`
      <svg viewBox="0 0 10 10"><style>* { fill: red }</style>
      <rect id="target" fill="blue" width="10" height="10" /></svg>
    `);
    expect(solid(presentation.style.fill)).toBe("blue");

    const stylesheet = shape(`
      <svg viewBox="0 0 10 10"><style>rect { fill: red }</style>
      <rect id="target" fill="blue" width="10" height="10" /></svg>
    `);
    expect(solid(stylesheet.style.fill)).toBe("red");

    const inline = shape(`
      <svg viewBox="0 0 10 10"><style>#target { fill: red }</style>
      <rect id="target" fill="blue" style="fill: gold" width="10" height="10" /></svg>
    `);
    expect(solid(inline.style.fill)).toBe("gold");
  });

  test("matches lists, combinators, attributes, escaped identifiers, and structural pseudo-classes", () => {
    const result = document(`
      <svg viewBox="0 0 30 10"><style>
        svg:root > g.layer > rect[data-role~="hero"][data-kind^="pri"]:first-child { fill: red }
        rect.accent\\+tone:nth-child(2):is(.accent\\+tone, #unused):not(.skip) { fill: green }
        #unused, g > rect + rect { stroke: blue }
        g rect ~ rect:last-child[data-code$="end"][data-code*="middle"][lang|="en"] { stroke-width: 3 }
        :where(#third) { fill: yellow }
      </style><g class="layer">
        <rect id="first" data-role="hero large" data-kind="primary" width="10" height="10" />
        <rect id="second" class="accent+tone" x="10" width="10" height="10" />
        <rect id="third" data-code="start-middle-end" lang="en-US" x="20" width="10" height="10" fill="purple" />
      </g></svg>
    `);
    const nodes = flatten(result.children).filter((node): node is RenderShape => node.type === "shape");
    expect(solid(nodes.find((node) => node.source.id === "first")!.style.fill)).toBe("red");
    expect(solid(nodes.find((node) => node.source.id === "second")!.style.fill)).toBe("green");
    expect(nodes.find((node) => node.source.id === "second")!.style.stroke).toEqual({ type: "solid", value: "blue" });
    expect(nodes.find((node) => node.source.id === "third")!.style.strokeStyle.width).toBe(3);
    expect(solid(nodes.find((node) => node.source.id === "third")!.style.fill)).toBe("purple");
  });

  test("resolves inheritance, non-inheritance, and CSS-wide keywords", () => {
    const result = document(`
      <svg viewBox="0 0 40 10"><g fill="red" opacity="0.5">
        <rect id="inherit" width="10" height="10" style="fill: inherit; opacity: inherit" />
        <rect id="initial" x="10" width="10" height="10" style="fill: initial; opacity: unset" />
        <rect id="unset" x="20" width="10" height="10" style="fill: unset" />
        <rect id="revert" x="30" width="10" height="10" style="fill: revert" />
      </g></svg>
    `);
    const nodes = flatten(result.children).filter((node): node is RenderShape => node.type === "shape");
    const byId = (id: string) => nodes.find((node) => node.source.id === id)!;
    expect(solid(byId("inherit").style.fill)).toBe("red");
    expect(byId("inherit").style.opacity).toBe(0.5);
    expect(solid(byId("initial").style.fill)).toBe("black");
    expect(byId("initial").style.opacity).toBe(1);
    expect(solid(byId("unset").style.fill)).toBe("red");
    expect(solid(byId("revert").style.fill)).toBe("red");
  });

  test("resolves nested variables, fallbacks, cycles, and currentColor", () => {
    const result = document(`
      <svg viewBox="0 0 20 10"><style>
        :root { --base: #123456; --nested: var(--missing, var(--base)); color: var(--nested) }
        #cycle { --a: var(--b); --b: var(--a); fill: var(--a, orange) }
        #self { --self: var(--self, red); fill: var(--self, purple) }
      </style>
      <rect id="target" width="10" height="10" style="fill: currentColor; stroke: var(--missing, rgb(1, 2, 3))" />
      <rect id="cycle" x="10" width="5" height="10" />
      <rect id="self" x="15" width="5" height="10" />
      </svg>
    `);
    const nodes = flatten(result.children).filter((node): node is RenderShape => node.type === "shape");
    const byId = (id: string) => nodes.find((node) => node.source.id === id)!;
    expect(solid(byId("target").style.fill)).toBe("#123456");
    expect(byId("target").style.stroke).toEqual({ type: "solid", value: "rgb(1, 2, 3)" });
    expect(solid(byId("cycle").style.fill)).toBe("orange");
    expect(solid(byId("self").style.fill)).toBe("purple");
    expect(result.diagnostics.filter(({ code }) => code === "css-variable-cycle")).toHaveLength(2);

    const keywords = shape(`
      <svg viewBox="0 0 10 10" style="--tone: red; color: green">
        <g color="blue"><rect id="target" width="10" height="10"
          style="--tone: inherit; color: currentColor; fill: var(--tone)" /></g>
      </svg>
    `);
    expect(solid(keywords.style.fill)).toBe("red");
    expect(keywords.style.color).toBe("blue");
  });

  test("inherits instance styles into referenced use content without mutating definitions", () => {
    const result = document(`
      <svg viewBox="0 0 20 10"><style>#symbolChild { stroke: var(--instance-stroke); fill: inherit }</style>
        <defs><symbol id="mark" viewBox="0 0 10 10"><rect id="symbolChild" width="10" height="10" /></symbol></defs>
        <use id="instance" href="#mark" width="10" height="10" fill="red" opacity="0.5" style="--instance-stroke: blue" />
      </svg>
    `);
    const nodes = flatten(result.children);
    const instance = nodes.find((node): node is RenderGroup => node.type === "group" && node.source.id === "instance")!;
    const referenced = nodes.find(
      (node): node is RenderShape => node.type === "shape" && node.source.id === "symbolChild",
    )!;
    expect(instance.style.opacity).toBe(0.5);
    expect(referenced.style.opacity).toBe(1);
    expect(solid(referenced.style.fill)).toBe("red");
    expect(referenced.style.stroke).toEqual({ type: "solid", value: "blue" });
  });

  test("recovers malformed CSS and reports unsupported static contexts", () => {
    const result = document(`
      <svg viewBox="0 0 10 10"><style>
        rect { fill: red; broken; stroke: blue; made-up-property: 2 }
        rect:hover { fill: green }
        @media (prefers-color-scheme: dark) { rect { fill: black } }
      </style><rect id="target" width="10" height="10" /></svg>
    `);
    const target = flatten(result.children).find(
      (node): node is RenderShape => node.type === "shape" && node.source.id === "target",
    )!;
    expect(solid(target.style.fill)).toBe("red");
    expect(target.style.stroke).toEqual({ type: "solid", value: "blue" });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "invalid-css-syntax",
        "unsupported-css-property",
        "unsupported-dynamic-selector",
        "unsupported-dynamic-media",
      ]),
    );
    const unsupported = result.diagnostics.find(({ code }) => code === "unsupported-css-property")!;
    expect(unsupported.css).toMatchObject({
      source: "embedded-style",
      selector: "rect",
      property: "made-up-property",
    });

    const styleAttributes = document(`
      <svg viewBox="0 0 10 10">
        <style type="text/less">rect { fill: red }</style>
        <style media="screen">rect { fill: blue }</style>
        <rect id="target" width="10" height="10" />
      </svg>
    `);
    const unstyled = flatten(styleAttributes.children).find(
      (node): node is RenderShape => node.type === "shape" && node.source.id === "target",
    )!;
    expect(solid(unstyled.style.fill)).toBe("black");
    expect(styleAttributes.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["unsupported-style-type", "unsupported-dynamic-media"]),
    );
  });

  test("canonicalizes camel-case parser aliases and exposes computed-style inspection", () => {
    const styles = __testing.inspectComputedStyles(`
      <svg viewBox="0 0 10 10"><rect id="target" width="10" height="10" style="strokeWidth: 4; fillRule: evenodd" /></svg>
    `);
    const target = styles.find(({ source }) => source.id === "target")!;
    expect(target.style.strokeStyle.width).toBe(4);
    expect(target.style.fillRule).toBe("evenodd");
    expect(target.style.presentation).toMatchObject({ "paint-order": "normal", isolation: "auto" });
    expect(target.style.presentation).toMatchObject({
      "font-feature-settings": "normal",
      "text-overflow": "clip",
      "vertical-align": "baseline",
    });
  });

  test("applies cascaded SVG 2 geometry properties", () => {
    const target = shape(`
      <svg viewBox="0 0 20 20"><style>
        rect { x: 2px; y: 3px; width: 14px; height: 12px; rx: 2px }
      </style><rect id="target" x="1" y="1" width="1" height="1" /></svg>
    `);
    expect(target.geometry).toEqual({ type: "rect", x: 2, y: 3, width: 14, height: 12, rx: 2, ry: 2 });

    const invalid = document(`
      <svg viewBox="0 0 20 20"><style>#bad { width: definitely-not-a-length }</style>
        <rect id="bad" height="10" />
      </svg>
    `);
    expect(invalid.diagnostics.find(({ code }) => code === "invalid-length")?.css).toMatchObject({
      source: "embedded-style",
      selector: "#bad",
      property: "width",
    });
  });
});
