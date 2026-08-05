#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAnimationProfile } from "./animation-profile";
import { renderAnimationReport } from "./animation-report";

writeFileSync(
  resolve(import.meta.dir, "svg-animation-profile.json"),
  `${JSON.stringify(buildAnimationProfile(), null, 2)}\n`,
);
writeFileSync(resolve(import.meta.dir, "ANIMATION_REPORT.md"), renderAnimationReport());
console.log("Generated dynamic profile and animation report");
