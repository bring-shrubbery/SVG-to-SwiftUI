#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderAnimationReport } from "./animation-report";

writeFileSync(resolve(import.meta.dir, "ANIMATION_REPORT.md"), renderAnimationReport());
console.log("Generated conformance/ANIMATION_REPORT.md");
