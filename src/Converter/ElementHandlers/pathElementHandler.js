import { extractProps } from "../StyleUtilities";
import { format } from "mathjs";

export function handlePathElement(element, options) {
  const { properties, style } = extractProps(element, options);
  options.lastPathId++;

  const dataPointElements = parseDataPoints(properties.d);

  const swiftString = convertPathToSwift(dataPointElements, options);

  return swiftString;
}

function convertPathToSwift(dataPointElements, options) {
  console.log(dataPointElements);
  console.log(options);

  const identation = "        ";

  let swiftString = "";
  for (const el of dataPointElements) {
    switch (el.command) {
      case "M":
        swiftString +=
          identation + generateMoveToSwift(el.data, options) + "\n";
        break;
      case "L":
        swiftString +=
          identation + generateLineToSwift(el.data, options) + "\n";
        break;
      case "H":
        break;
      case "V":
        break;
      case "C":
        swiftString +=
          identation + generateCubicCurveSwift(el.data, options) + "\n";
        break;
      case "S":
        break;
      case "Q":
        break;
      case "T":
        break;
      case "A":
        break;
      case "Z":
        swiftString += identation + generateClosePathSwift([], options) + "\n";
        break;
      default:
        console.error(
          `Unsupported path data point, please consider contributing on Github to help bring ${el.command} to this tool.`
        );
    }
  }

  return swiftString;
}

function parseDataPoints(dStr) {
  let elements = [];

  let lastElementId;

  for (let i = 0; i < dStr.length; i++) {
    if (/[a-zA-Z]/.test(dStr[i])) {
      // New command.
      lastElementId = elements.length;
      elements.push([dStr[i]]);
    } else {
      // Continue adding to the previous command
      if (elements[lastElementId].length == 1) {
        elements[lastElementId].push(dStr[i]);
      } else {
        elements[lastElementId][1] += dStr[i];
      }
    }
  }

  elements = elements.map((el) => {
    const command = el[0];
    if (el.length > 1) {
      const data = el[1]
        .trim()
        .split(" ")
        .map((val) =>
          val
            .trim()
            .split(",")
            .map((v) => parseFloat(v))
        );
      return { command, data };
    } else {
      return { command };
    }
  });

  return elements;
}

function generateMoveToSwift(data, options) {
  const [x, y] = data[0];
  const fmtOpts = {
    notation: "fixed",
    precision: options.numberPrecision,
  };

  const px = parseFloat(format(x / options.viewBox.width, fmtOpts));
  const py = parseFloat(format(y / options.viewBox.height, fmtOpts));

  return `path.move(to: CGPoint(x: ${px}*width, y: ${py}*height))`;
}

function generateLineToSwift(data, options) {
  const [x, y] = data[0];
  const fmtOpts = {
    notation: "fixed",
    precision: options.numberPrecision,
  };

  const px = parseFloat(format(x / options.viewBox.width, fmtOpts));
  const py = parseFloat(format(y / options.viewBox.height, fmtOpts));

  return `path.addLine(to: CGPoint(x: ${px}*width, y: ${py}*height))`;
}

function generateClosePathSwift(data, options) {
  return `path.closeSubpath()`;
}

function generateCubicCurveSwift(data, options) {
  const [p2, p3, p1] = data;
  const fmtOpts = {
    notation: "fixed",
    precision: options.numberPrecision,
  };

  const p1x = parseFloat(format(p1[0] / options.viewBox.width, fmtOpts));
  const p1y = parseFloat(format(p1[1] / options.viewBox.height, fmtOpts));

  const p2y = parseFloat(format(p2[1] / options.viewBox.height, fmtOpts));
  const p2x = parseFloat(format(p2[0] / options.viewBox.width, fmtOpts));

  const p3x = parseFloat(format(p3[0] / options.viewBox.width, fmtOpts));
  const p3y = parseFloat(format(p3[1] / options.viewBox.height, fmtOpts));

  return [
    `path.addCurve(to: CGPoint(x: ${p1x}*width, y: ${p1y}*height),`,
    `control1: CGPoint(x: ${p2x}*width, y: ${p2y}*height),`,
    `control2: CGPoint(x: ${p3x}*width, y: ${p3y}*height))`,
  ].join("");
}
