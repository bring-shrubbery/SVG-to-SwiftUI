import type { SwiftUIGeneratorConfig, ViewBoxData } from "./types";

export const createUsageCommentTemplate = ({
  config,
  viewBox,
  preservesColors = false,
}: {
  config: SwiftUIGeneratorConfig;
  viewBox: ViewBoxData;
  preservesColors?: boolean;
}) => [
  `// To use this ${preservesColors ? "view" : "shape"}, just add it to your SwiftUI View:`,
  `// ${config.structName}()${preservesColors ? "" : ".fill()"}.frame(width: ${viewBox.width}, height: ${viewBox.height})`,
];

type ParameterName = string;
type ParameterType = string;

const indentStrings = ({ indent, body }: { indent: number; body: string[] }) => {
  return body.map((row) => `${new Array(indent).fill(" ").join("")}${row}`);
};

const parametersToStrings = (parameters: [ParameterName, ParameterType][]) => {
  return parameters.map(([name, type]) => `${name}: ${type}`).join(", ");
};

export const createFunctionTemplate = ({
  name,
  parameters,
  returnType,
  body,
  indent = 4,
}: {
  name: string;
  parameters: [ParameterName, ParameterType][];
  returnType: string;
  body: string[];
  indent?: number;
}) => {
  const parametersString = parametersToStrings(parameters);

  return [`func ${name}(${parametersString}) -> ${returnType} {`, ...indentStrings({ body, indent }), `}`];
};

export const createStructTemplate = ({
  name,
  returnType,
  body,
  indent = 4,
}: {
  name: string;
  returnType: string;
  body: string[];
  indent?: number;
}) => {
  return [`struct ${name}: ${returnType} {`, ...indentStrings({ body, indent }), `}`];
};
