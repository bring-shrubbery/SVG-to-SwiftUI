#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAnimationFixtures } from "../animation-tests/manifest";
import { buildAnimationProfile } from "./animation-profile";
import { renderAnimationReport } from "./animation-report";

const profile = buildAnimationProfile();
const fixtureTags = new Set(loadAnimationFixtures().flatMap((fixture) => fixture.tags));
fixtureTags.add("benchmark-ladder");
const ids = new Set<string>();
const errors: string[] = [];
for (const entry of profile.entries) {
  if (ids.has(entry.id)) errors.push(`duplicate entry: ${entry.id}`);
  ids.add(entry.id);
  if (!entry.issue || !entry.permissiveFallback || !entry.strictFallback) errors.push(`incomplete policy: ${entry.id}`);
  for (const evidence of entry.unitEvidence)
    if (!existsSync(resolve(import.meta.dir, "..", evidence))) errors.push(`missing evidence ${evidence}: ${entry.id}`);
  for (const tag of entry.temporalTags)
    if (!fixtureTags.has(tag)) errors.push(`stale temporal tag ${tag}: ${entry.id}`);
}
if (profile.entries.some((entry) => entry.status === "unsupported-blocker"))
  errors.push("dynamic profile has unsupported blockers");
const expectedProfile = `${JSON.stringify(profile, null, 2)}\n`;
if (readFileSync(resolve(import.meta.dir, "svg-animation-profile.json"), "utf8") !== expectedProfile)
  errors.push("svg-animation-profile.json is stale");
if (readFileSync(resolve(import.meta.dir, "ANIMATION_REPORT.md"), "utf8") !== renderAnimationReport())
  errors.push("ANIMATION_REPORT.md is stale");
const rootReadme = readFileSync(resolve(import.meta.dir, "../../..", "README.md"), "utf8");
if (!rootReadme.includes(`${profile.entries.length} classified entries and zero unsupported blockers`))
  errors.push("root README dynamic coverage claim is stale");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Animation conformance current: ${profile.entries.length} entries, 0 blockers`);
