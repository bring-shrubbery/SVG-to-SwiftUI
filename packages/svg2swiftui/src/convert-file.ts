import fs from "node:fs";
import path from "node:path";
import { convert } from "svg-to-swiftui-core";
import { deriveStructName } from "./derive-struct-name";

export interface ConvertFileOptions {
  input: string;
  output: string;
  structName?: string;
  precision?: number;
  indentation?: number;
  usageComment?: boolean;
}

export function convertFile(options: ConvertFileOptions): void {
  const { input, output, structName, precision, indentation, usageComment } = options;

  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const svg = fs.readFileSync(input, "utf8");
  const effectiveStructName = structName ?? deriveStructName(output);

  const swift = convert(svg, {
    structName: effectiveStructName,
    precision,
    indentationSize: indentation,
    usageCommentPrefix: usageComment,
  });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, swift, "utf8");
}
