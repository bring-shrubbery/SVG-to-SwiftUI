import { Command } from "commander";
import pkg from "../package.json";
import { convertFile } from "./convert-file";

function main(argv: string[]): void {
  const program = new Command();

  program
    .name("svg2swiftui")
    .description("Convert an SVG file into a SwiftUI Shape struct.")
    .version(pkg.version)
    .argument("<input>", "Path to input SVG file")
    .argument("<output>", "Path to output Swift file")
    .option("--struct-name <name>", "SwiftUI struct name (default: derived from output filename)")
    .option("--precision <n>", "Decimal precision for path coordinates", Number, 10)
    .option("--indentation <n>", "Indentation width in spaces", Number, 4)
    .option("--usage-comment", "Include SwiftUI usage example as a leading comment", false)
    .action(
      (
        input: string,
        output: string,
        opts: {
          structName?: string;
          precision: number;
          indentation: number;
          usageComment: boolean;
        },
      ) => {
        convertFile({
          input,
          output,
          structName: opts.structName,
          precision: opts.precision,
          indentation: opts.indentation,
          usageComment: opts.usageComment,
        });
      },
    );

  program.parse(argv);
}

try {
  main(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
}
