import { AstroCheck, DiagnosticSeverity } from "@astrojs/language-server";
import glob from "fast-glob";
import * as fs from "fs";
import { bgWhite, black, bold, cyan, red, yellow } from "kleur/colors";
import * as path from "path";
import { pathToFileURL } from "url";
async function openAllDocuments(workspaceUri, filePathsToIgnore, checker) {
  const files = await glob("**/*.astro", {
    cwd: workspaceUri.pathname,
    ignore: ["node_modules/**"].concat(filePathsToIgnore.map((ignore) => `${ignore}/**`))
  });
  const absFilePaths = files.map((f) => path.resolve(workspaceUri.pathname, f));
  for (const absFilePath of absFilePaths) {
    const text = fs.readFileSync(absFilePath, "utf-8");
    checker.upsertDocument({
      uri: pathToFileURL(absFilePath).toString(),
      text
    });
  }
}
function offsetAt({ line, character }, text) {
  let i = 0;
  let l = 0;
  let c = 0;
  while (i < text.length) {
    if (l === line && c === character) {
      break;
    }
    let char = text[i];
    switch (char) {
      case "\n": {
        l++;
        c = 0;
        break;
      }
      default: {
        c++;
        break;
      }
    }
    i++;
  }
  return i;
}
function generateString(str, len) {
  return Array.from({ length: len }, () => str).join("");
}
async function run() {
}
async function check(astroConfig) {
  const root = astroConfig.root;
  let checker = new AstroCheck(root.toString());
  await openAllDocuments(root, [], checker);
  let diagnostics = await checker.getDiagnostics();
  let result = {
    errors: 0,
    warnings: 0
  };
  diagnostics.forEach((diag) => {
    diag.diagnostics.forEach((d) => {
      switch (d.severity) {
        case DiagnosticSeverity.Error: {
          console.error(`${bold(cyan(path.relative(root.pathname, diag.filePath)))}:${bold(yellow(d.range.start.line))}:${bold(yellow(d.range.start.character))} - ${d.message}`);
          let startOffset = offsetAt({ line: d.range.start.line, character: 0 }, diag.text);
          let endOffset = offsetAt({ line: d.range.start.line + 1, character: 0 }, diag.text);
          let str = diag.text.substring(startOffset, endOffset - 1);
          const lineNumStr = d.range.start.line.toString();
          const lineNumLen = lineNumStr.length;
          console.error(`${bgWhite(black(lineNumStr))}  ${str}`);
          let tildes = generateString("~", d.range.end.character - d.range.start.character);
          let spaces = generateString(" ", d.range.start.character + lineNumLen - 1);
          console.error(`   ${spaces}${bold(red(tildes))}
`);
          result.errors++;
          break;
        }
        case DiagnosticSeverity.Warning: {
          result.warnings++;
          break;
        }
      }
    });
  });
  if (result.errors) {
    console.error(`Found ${result.errors} errors.`);
  }
  const exitCode = result.errors ? 1 : 0;
  return exitCode;
}
export {
  check,
  run
};
