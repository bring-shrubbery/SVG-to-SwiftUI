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
  });
  expect(result).toBe(expectedResult);
});

test("convert-ln", () => {
  const rawSVG = loadContentFile("ln.svg");
  const expectedResult = loadContentFile("ln.swift");
  const result = convert(rawSVG, {
    precision: 6,
    structName: "LnIcon",
  });
  expect(result).toBe(expectedResult);
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
