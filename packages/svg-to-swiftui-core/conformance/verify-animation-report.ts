#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderAnimationReport } from "./animation-report";

const path = resolve(import.meta.dir, "ANIMATION_REPORT.md");
if (readFileSync(path, "utf8") !== renderAnimationReport()) {
  console.error("ANIMATION_REPORT.md is stale; run bun run animation-conformance:report");
  process.exit(1);
}
console.log("Animation conformance report is current");
