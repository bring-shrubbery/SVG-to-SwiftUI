#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAnimationSourceLock } from "./source-lock";

writeFileSync(
  resolve(import.meta.dir, "fixture-source-lock.json"),
  `${JSON.stringify(buildAnimationSourceLock(), null, 2)}\n`,
);
console.log("Updated exact animation fixture source lock");
