#!/usr/bin/env bun
import { convertDetailed } from "../src/index";

const svg = `<svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;
const iterations = 500;
const started = performance.now();
let sourceLength = 0;
for (let index = 0; index < iterations; index++) {
  const result = convertDetailed(svg, { preserveColors: false, structName: `BenchmarkIcon${index}` });
  if (result.outputMode !== "shape") throw new Error("Simple icon left the Shape fast path");
  sourceLength = Math.max(sourceLength, result.source.length);
}
const elapsed = performance.now() - started;
if (sourceLength > 15_000) throw new Error(`Simple Shape output grew to ${sourceLength} bytes`);
if (elapsed > 10_000) throw new Error(`500 simple conversions took ${elapsed.toFixed(0)}ms`);
console.log(`Shape fast path: ${iterations} conversions in ${elapsed.toFixed(1)}ms; max ${sourceLength} bytes.`);
