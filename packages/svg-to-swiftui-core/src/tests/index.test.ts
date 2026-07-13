import { convert } from "../index";
import { loadContentFile } from "./utils";

test("conversion-1", () => {
  const rawSVG = loadContentFile("plusRounded.svg");
  const expectedResult = loadContentFile("plusRounded.swift");
  const result = convert(rawSVG, {
    precision: 5,
  });
  expect(result).toBe(expectedResult);
});

test("convert-circle", () => {
  const rawSVG = loadContentFile("circle.svg");
  const expectedResult = loadContentFile("circle.swift");

  const result = convert(rawSVG, {
    precision: 2,
    structName: "CircleShape",
  });
  expect(result).toBe(expectedResult);
});

test("convert-ellipse", () => {
  const rawSVG = loadContentFile("ellipse.svg");
  const expectedResult = loadContentFile("ellipse.swift");
  const result = convert(rawSVG, {
    precision: 4,
    structName: "EllipseShape",
  });
  expect(result).toBe(expectedResult);
});

test("convert-rectangle", () => {
  const rawSVG = loadContentFile("rect.svg");
  const expectedResult = loadContentFile("rect.swift");
  const result = convert(rawSVG, {
    precision: 6,
    structName: "RectangleShape",
  });
  expect(result).toBe(expectedResult);
});

test("convert-github-transat", () => {
  const rawSVG = loadContentFile("transat.svg");
  const expectedResult = loadContentFile("transat.swift");
  const result = convert(rawSVG, {
    precision: 6,
    structName: "GithubTransatShape",
  });
  expect(result).toBe(expectedResult);
});

test("convert-f", () => {
  const rawSVG = loadContentFile("f.svg");
  const expectedResult = loadContentFile("f.swift");
  const result = convert(rawSVG, {
    precision: 6,
    structName: "FaIcon",
    preserveColors: false,
  });
  expect(result).toBe(expectedResult);
});

test("convert-ln", () => {
  const rawSVG = loadContentFile("ln.svg");
  const expectedResult = loadContentFile("ln.swift");
  const result = convert(rawSVG, {
    precision: 6,
    structName: "LnIcon",
    preserveColors: false,
  });
  expect(result).toBe(expectedResult);
});

test("convert-comma-separated-viewbox", () => {
  const rawSVG = `
    <svg width="400" height="564.2679900744417" viewBox="0, 0, 400,564.2679900744417">
      <path d="M259.712 14.780" />
    </svg>
  `;

  const result = convert(rawSVG, { precision: 5 });

  expect(result).toContain("path.move(to: CGPoint(x: 0.64928*width, y: 0.02619*height))");
  expect(result).not.toContain("NaN");
});

test("convert-translated-group", () => {
  const rawSVG = `
    <svg width="150" height="167" viewBox="0 0 150 167">
      <g transform="translate(-106, -5)">
        <path d="M112.409713 5 L256 5 L256 172 L106 172 Z" />
      </g>
    </svg>
  `;

  const result = convert(rawSVG, { precision: 6 });

  expect(result).toContain("CGAffineTransform(a: 1, b: 0, c: 0, d: 1, tx: -0.706667*width, ty: -0.02994*height)");
});

test("convert-multicolor-svg-to-layered-view", () => {
  const rawSVG = `
    <svg viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#ff0000" />
      <circle cx="50" cy="50" r="25" fill="rgb(0, 128, 255)" />
    </svg>
  `;

  const result = convert(rawSVG, {
    structName: "MulticolorIcon",
    precision: 3,
    usageCommentPrefix: true,
  });

  expect(result).toContain("// MulticolorIcon().frame(width: 100, height: 100)");
  expect(result).toContain("struct MulticolorIcon: View");
  expect(result).toContain("Layer0().fill(Color(red: 1, green: 0, blue: 0))");
  expect(result).toContain("Layer1().fill(Color(red: 0, green: 0.502, blue: 1))");
  expect(result.indexOf("Layer0().fill")).toBeLessThan(result.indexOf("Layer1().fill"));
});

test("preserve inherited fill and contrasting stroke colors", () => {
  const rawSVG = `
    <svg viewBox="0 0 100 100">
      <g fill="#00ff00" transform="translate(5 10)">
        <rect x="10" y="10" width="60" height="50" stroke="#0000ff" stroke-width="4" />
      </g>
    </svg>
  `;

  const result = convert(rawSVG, { structName: "PaintedIcon", precision: 3 });

  expect(result).toContain("Layer0().fill(Color(red: 0, green: 1, blue: 0))");
  expect(result).toContain("Layer1().fill(Color(red: 0, green: 0, blue: 1))");
  expect(result).toContain(".strokedPath(StrokeStyle(lineWidth: 0.04*width");
  expect(result).toContain("tx: 0.05*width, ty: 0.1*height");
  expect(result).not.toContain("cwStrokedPath");
});

test("preserve paint opacity and inline style precedence", () => {
  const rawSVG = `
    <svg viewBox="0 0 20 20" opacity="0.5">
      <rect width="20" height="20" fill="#ff0000" style="fill-opacity: 0.5" />
      <circle cx="10" cy="10" r="5" fill="blue" />
    </svg>
  `;

  const result = convert(rawSVG, { structName: "TransparentIcon" });

  expect(result).toContain("Layer0().fill(Color(red: 1, green: 0, blue: 0, opacity: 0.5))");
  expect(result).toContain("Layer1().fill(Color(red: 0, green: 0, blue: 1))");
  expect(result).toMatch(/\.compositingGroup\(\)\s+\.opacity\(0\.5\)/);
});

test("allow callers to keep legacy single-shape output", () => {
  const rawSVG = `
    <svg viewBox="0 0 10 10">
      <rect width="10" height="10" fill="red" />
      <circle cx="5" cy="5" r="2" fill="blue" />
    </svg>
  `;

  const result = convert(rawSVG, { structName: "TintableIcon", preserveColors: false });

  expect(result).toContain("struct TintableIcon: Shape");
  expect(result).not.toContain("Color(");
});

// evenodd → nonzero conversion: SwiftUI's Path uses non-zero winding by default,
// so paths with fill-rule="evenodd" need nested subpaths reversed at odd depths
// to preserve the original hole semantics.

test("convert-evenodd-donut", () => {
  const rawSVG = loadContentFile("evenodd-donut.svg");
  const expectedResult = loadContentFile("evenodd-donut.swift");
  const result = convert(rawSVG, {
    precision: 4,
    structName: "EvenOddDonutShape",
  });
  expect(result).toBe(expectedResult);
});

test("convert-evenodd-nested-deep", () => {
  const rawSVG = loadContentFile("evenodd-nested-deep.svg");
  const expectedResult = loadContentFile("evenodd-nested-deep.swift");
  const result = convert(rawSVG, {
    precision: 4,
    structName: "EvenOddNestedDeepShape",
  });
  expect(result).toBe(expectedResult);
});

test("convert-evenodd-moon", () => {
  const rawSVG = loadContentFile("evenodd-moon.svg");
  const expectedResult = loadContentFile("evenodd-moon.swift");
  const result = convert(rawSVG, {
    precision: 4,
    structName: "EvenOddMoonShape",
  });
  expect(result).toBe(expectedResult);
});

test("convert-evenodd-arc-donut", () => {
  const rawSVG = loadContentFile("evenodd-arc-donut.svg");
  const expectedResult = loadContentFile("evenodd-arc-donut.swift");
  const result = convert(rawSVG, {
    precision: 4,
    structName: "EvenOddArcDonutShape",
  });
  expect(result).toBe(expectedResult);
});

test("convert-nonzero-two-rects", () => {
  const rawSVG = loadContentFile("nonzero-two-rects.svg");
  const expectedResult = loadContentFile("nonzero-two-rects.swift");
  const result = convert(rawSVG, {
    precision: 4,
    structName: "NonZeroTwoRectsShape",
  });
  expect(result).toBe(expectedResult);
});

describe("structural SVG elements", () => {
  test("renders defs through href and xlink:href use elements", () => {
    const result = convert(
      `<svg viewBox="0 0 40 20" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs><path id="diamond" d="M5 0 10 5 5 10 0 5Z" /></defs>
        <use href="#diamond" x="2" y="5" />
        <use xlink:href="#diamond" x="22" y="5" />
      </svg>`,
      { precision: 4 },
    );

    expect(result.match(/var transformPath/g)).toHaveLength(2);
    expect(result).toContain("tx: 0.05*width");
    expect(result).toContain("tx: 0.55*width");
  });

  test("renders a symbol into the use viewport", () => {
    const result = convert(
      `<svg viewBox="0 0 100 50">
        <defs><symbol id="icon" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" /></symbol></defs>
        <use href="#icon" x="25" width="50" height="50" />
      </svg>`,
      { precision: 4 },
    );

    expect(result).toContain("a: 5");
    expect(result).toContain("tx: 0.25*width");
    expect(result).toContain("path.addPath(transformPath");
  });

  test("supports transforms on groups and shapes", () => {
    const result = convert(
      `<svg viewBox="0 0 100 100"><g transform="translate(10 20) rotate(45)"><rect width="20" height="10" /></g></svg>`,
      { precision: 4 },
    );

    expect(result).toContain("CGAffineTransform(a: 0.7071");
    expect(result).toContain("tx: 0.1*width");
    expect(result).toContain("ty: 0.2*height");
  });

  test("renders links and only the first switch fallback", () => {
    const result = convert(
      `<svg viewBox="0 0 20 20"><switch><a href="/first"><circle cx="5" cy="5" r="5" /></a><rect width="20" height="20" /></switch></svg>`,
    );

    expect(result).toContain("path.addEllipse");
    expect(result).not.toContain("path.addRect");
  });

  test("ignores definition and accessibility-only elements", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const result = convert(
      `<svg viewBox="0 0 10 10"><title>Square</title><desc>An icon</desc><metadata>data</metadata><defs><style>.x{fill:black}</style></defs><rect width="10" height="10" /></svg>`,
    );

    expect(result).toContain("path.addRect");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("rejects missing and circular use references", () => {
    expect(() => convert(`<svg viewBox="0 0 10 10"><use href="#missing" /></svg>`)).toThrow("missing element #missing");
    expect(() =>
      convert(`<svg viewBox="0 0 10 10"><defs><g id="loop"><use href="#loop" /></g></defs><use href="#loop" /></svg>`),
    ).toThrow("circular reference");
  });
});
