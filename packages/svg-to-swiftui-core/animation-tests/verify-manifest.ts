#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { convert } from "../src/index";
import { outputMode } from "../visual-tests/manifest";
import { loadAnimationFixtures, validateAnimationManifest } from "./manifest";

export function verifyAnimationFixtureManifest(): string[] {
  const errors = validateAnimationManifest();
  if (errors.length > 0) return errors;
  for (const [index, fixture] of loadAnimationFixtures().entries()) {
    if (fixture.mode !== "comparison") continue;
    try {
      const swift = convert(readFileSync(fixture.sourcePath, "utf8"), {
        structName: `AnimationManifestFixture${index}`,
        precision: 5,
        preserveColors: fixture.expectedMode === "view",
      });
      const actualMode = outputMode(swift);
      if (actualMode !== fixture.expectedMode)
        errors.push(`${fixture.name}: expected ${fixture.expectedMode}, generated ${actualMode ?? "unknown"}`);
    } catch (error) {
      errors.push(`${fixture.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

if (import.meta.main) {
  const errors = verifyAnimationFixtureManifest();
  if (errors.length > 0) {
    console.error(`Animation fixture manifest failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  const fixtures = loadAnimationFixtures();
  const frames = fixtures.reduce((total, fixture) => total + fixture.frames.length, 0);
  console.log(`Animation fixture manifest valid: ${fixtures.length} fixtures, ${frames} deterministic frames.`);
}
