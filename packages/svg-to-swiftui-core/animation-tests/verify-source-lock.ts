#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAnimationSourceLock } from "./source-lock";

const expected = `${JSON.stringify(buildAnimationSourceLock(), null, 2)}\n`;
const path = resolve(import.meta.dir, "fixture-source-lock.json");
if (readFileSync(path, "utf8") !== expected) {
  console.error(
    "Animation source hashes or attribution changed; run bun run animation-test:update-source-lock after reviewing provenance",
  );
  process.exit(1);
}
console.log(`Animation source lock verified (${buildAnimationSourceLock().fixtures.length} fixtures)`);
