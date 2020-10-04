import { select } from "hast-util-select";
import { handleElement } from "./SvgToSwiftConverters";
import { convertToPixels } from "./Utils";

export default function SwiftGenerator(svgJsonTree, options) {
  const { decimalPoints, shapeName } = options;

  const { width, height, viewBox } = parseSvgElement(svgJsonTree);
  const svgPrimitives = getPrimitives(svgJsonTree);

  let swiftString = `struct ${shapeName}: Shape {\n`;
  swiftString += `    func path(in rect: CGRect) -> Path{\n`;
  swiftString += `        var path = Path()\n`;
  swiftString += `        let width = rect.size.width\n`;
  swiftString += `        let height = rect.size.height\n\n`;

  for (const element of svgPrimitives) {
    swiftString += handleElement(element, {
      viewBox,
      width,
      height,
      numberPrecision: decimalPoints,
      lastPathId: 0,
    });
    swiftString += "\n";
  }

  swiftString += `        return path\n`;
  swiftString += `    }\n}`;

  return swiftString;
}

function getPrimitives(svgJsonTree) {
  const svg = select("svg", svgJsonTree);
  const elements = svg.children;
  return elements;
}

function parseSvgElement(svgJsonTree) {
  const svg = select("svg", svgJsonTree);
  const { properties } = svg;
  const { viewBox, width, height } = properties;

  // Parse width and height
  const widthUnit = convertToPixels(width);
  const heightUnit = convertToPixels(height);

  // Validiate and parse view box.
  const viewBoxElements = String(viewBox)
    .split(" ")
    .map((n) => parseFloat(n));
  const [vbx, vby, vbWidth, vbHeight] = viewBoxElements;
  const viewBoxValid =
    !isNaN(vbx) && !isNaN(vby) && !isNaN(vbWidth) && !isNaN(vbHeight);

  return {
    width: widthUnit,
    height: heightUnit,
    viewBox: viewBoxValid
      ? { x: vbx, y: vby, width: vbWidth, height: vbHeight } // If view box is provided, use it.
      : { x: 0, y: 0, width: widthUnit, height: heightUnit }, // Otherwise use width and height.
  };
}

const print = (args) => console.log(args);
