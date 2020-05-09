import { select } from "hast-util-select";
import { handleElement } from "./SvgToSwiftConverters";
import { convertToPixels } from "./Utils";

export default function SwiftGenerator(svgJsonTree) {
  const { isSupportedVersion, width, height, viewBox } = parseSvgElement(
    svgJsonTree
  );

  if (!isSupportedVersion) {
    alert("Please pase valid version of SVG! (1.1)");
    return "Please use SVG verison 1.1!";
  }

  const svgPrimitives = getPrimitives(svgJsonTree);

  const numberPrecision = 5;

  const shapeName = "MyCustomShape";
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
      numberPrecision,
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
  const { version, viewBox, width, height } = properties;

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
    isSupportedVersion: version == 1.1,
    width: widthUnit,
    height: heightUnit,
    viewBox: viewBoxValid
      ? { x: vbx, y: vby, width: vbWidth, height: vbHeight } // If view box is provided, use it.
      : { x: 0, y: 0, width: widthUnit, height: heightUnit }, // Otherwise use width and height.
  };
}

// function generateSwiftString() {}

// const generateFinalSwiftString = (props) => {
//   const points = [...props.points];
//   let swiftPoints = [];

//   for (let i = 0; i < points.length; i++) {
//     const p = points[i];
//     switch (p.flag) {
//       case "M":
//         swiftPoints.push(moveToSwiftString(p));
//         break;
//       case "L":
//         swiftPoints.push(lineToSwiftString(p));
//         break;

//       case "C":
//         const c1 = points[i + 1];
//         const c2 = points[i + 2];

//         swiftPoints.push(curveToSwiftString({ p: c2, c1: p, c2: c1 }));

//         break;

//       case "Z":
//         swiftPoints.push(closePathSwiftString(p));
//         break;

//       case "H":
//         console.log("Horizontal lines are not implemented!");
//         break;

//       case "V":
//         console.log("Vertical lines are not implemented!");
//         break;

//       case "S":
//         console.log("S lines are not implemented!");
//         break;

//       case "Q":
//         console.log("Q lines are not implemented!");
//         break;

//       case "T":
//         console.log("T lines are not implemented!");
//         break;

//       case "A":
//         console.log("A lines are not implemented!");
//         break;
//       default:
//         console.log("HMMMMMmmmmm");
//     }
//   }

//   console.log(swiftPoints);

//   return [
//     `struct ${props.title}: Shape {`,
//     `    func path(in rect: CGRect) -> Path {`,
//     `        var path = Path()`,
//     `        let width = rect.size.width`,
//     `        let height = rect.size.height`,
//     ``,
//     ...swiftPoints.map((v) => "        " + v),
//     ``,
//     `        return path`,
//     `    }`,
//     `}`,
//   ].join("\n");
// };

// const closePathSwiftString = (point) => "path.closeSubpath()";

// const curveToSwiftString = (pts) => {
//   return [
//     `path.addCurve(to: CGPoint(x: ${pts.p.x / size.width}*width, y: ${
//       pts.p.y / size.height
//     }*height),`,
//     `control1: CGPoint(x: ${pts.c1.x / size.width}*width, y: ${
//       pts.c1.y / size.height
//     }*height),`,
//     `control2: CGPoint(x: ${pts.c2.x / size.width}*width, y: ${
//       pts.c2.y / size.height
//     }*height))`,
//   ].join(" ");
// };

const print = (args) => console.log(args);
