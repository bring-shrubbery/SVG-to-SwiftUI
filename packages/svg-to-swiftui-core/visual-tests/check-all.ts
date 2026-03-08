import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { convert } from "../src/index";

const dir = join(import.meta.dir, "fixtures");
const files = readdirSync(dir).filter(f => f.endsWith(".svg")).sort();
let pass = 0;
let fail = 0;
const errors: { file: string; error: string }[] = [];

for (const file of files) {
  try {
    const svg = readFileSync(join(dir, file), "utf8");
    const result = convert(svg, { structName: "TestShape", precision: 5 });
    if (result && result.length > 0) {
      pass++;
    } else {
      errors.push({ file, error: "Empty output" });
      fail++;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.substring(0, 120) : String(e);
    errors.push({ file, error: msg });
    fail++;
  }
}

console.log(`Total: ${files.length}  Pass: ${pass}  Fail: ${fail}`);
if (errors.length > 0) {
  console.log("\nErrors:");
  for (const e of errors) {
    console.log(`  ${e.file}: ${e.error}`);
  }
}
if (fail > 0) process.exit(1);
