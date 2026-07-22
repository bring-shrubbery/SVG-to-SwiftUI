#!/usr/bin/env bun
import { expandedEntries, loadConformanceManifest, validateConformance } from "./model";

const errors = validateConformance();
if (errors.length > 0) {
  console.error(`Conformance validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const manifest = loadConformanceManifest();
const entries = expandedEntries();
const visuallyExercised = entries.filter((entry) => entry.visualFixtures.length > 0).length;
console.log(
  `Conformance ${manifest.conformanceVersion}: ${entries.length} classified entries; ${visuallyExercised} have direct fixture-tag evidence; no blockers.`,
);
