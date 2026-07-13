#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { convert } from "../src/index";
import { loadFixtures, outputMode, validateManifest } from "./manifest";

export function verifyFixtureManifest(): string[] {
  const errors = validateManifest();
  if (errors.length > 0) return errors;

  for (const [index, fixture] of loadFixtures().entries()) {
    try {
      const source = readFileSync(fixture.sourcePath, "utf8");
      const swift = convert(source, {
        structName: `ManifestFixture${index}`,
        precision: 5,
        preserveColors: fixture.expectedMode === "view",
      });
      const actualMode = outputMode(swift);
      if (actualMode !== fixture.expectedMode) {
        errors.push(`${fixture.name}: expected ${fixture.expectedMode} output, generated ${actualMode ?? "unknown"}`);
      }
    } catch (error) {
      errors.push(`${fixture.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

if (import.meta.main) {
  const errors = verifyFixtureManifest();
  if (errors.length > 0) {
    console.error(`Fixture manifest failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`Fixture manifest valid: ${loadFixtures().length} deterministic fixtures.`);
}
