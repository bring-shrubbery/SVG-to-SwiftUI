#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { convertAsync } from "../src/index";
import { loadAnimationFixtures } from "./manifest";

const budgets = JSON.parse(readFileSync(resolve(import.meta.dir, "animation-budgets.json"), "utf8")) as {
  version: number;
  limits: Record<string, number>;
  benchmarks: { lightweight: string; heavy: string };
};
const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, "animation-fixture-manifest.json"), "utf8")) as {
  benchmarkLadder: Array<{ fixture: string }>;
};
const ladder = new Set(manifest.benchmarkLadder.map((item) => item.fixture));
const fixtures = loadAnimationFixtures().filter((fixture) => ladder.has(fixture.name));
const errors: string[] = [];
const results = [];
for (const fixture of fixtures) {
  const source = readFileSync(fixture.sourcePath, "utf8");
  const started = performance.now();
  const first = await convertAsync(source, { structName: "AnimationBudget", preserveColors: true });
  const conversionMilliseconds = performance.now() - started;
  const second = await convertAsync(source, { structName: "AnimationBudget", preserveColors: true });
  if (first !== second) errors.push(`${fixture.name}: generated Swift is not deterministic`);
  const metrics = {
    fixture: fixture.name,
    inputBytes: Buffer.byteLength(source),
    generatedSwiftBytes: Buffer.byteLength(first),
    conversionMilliseconds: Math.round(conversionMilliseconds * 100) / 100,
    animationDefinitions: (source.match(/<(?:animate|set|animateTransform|animateMotion|discard)\b/g) ?? []).length,
    keyframeBlocks: (source.match(/(?:from|to|\d+(?:\.\d+)?%)\s*\{/g) ?? []).length,
    eventTraceEntries: fixture.events.length,
    frames: fixture.frames.length,
  };
  if (metrics.inputBytes > budgets.limits.inputBytesPerFixture)
    errors.push(`${fixture.name}: input byte budget exceeded`);
  if (metrics.generatedSwiftBytes > budgets.limits.generatedSwiftBytesPerFixture)
    errors.push(`${fixture.name}: generated Swift byte budget exceeded`);
  if (metrics.conversionMilliseconds > budgets.limits.conversionMillisecondsPerFixture)
    errors.push(`${fixture.name}: conversion time budget exceeded`);
  if (metrics.animationDefinitions > budgets.limits.animationDefinitionsPerDocument)
    errors.push(`${fixture.name}: animation definition budget exceeded`);
  if (metrics.keyframeBlocks > budgets.limits.keyframesPerAnimation)
    errors.push(`${fixture.name}: keyframe budget exceeded`);
  if (metrics.eventTraceEntries > budgets.limits.eventTraceEntries)
    errors.push(`${fixture.name}: event trace budget exceeded`);
  if (metrics.frames > budgets.limits.framesPerFixture) errors.push(`${fixture.name}: frame budget exceeded`);
  results.push(metrics);
}
const totalFrames = results.reduce((sum, item) => sum + item.frames, 0);
if (totalFrames > budgets.limits.framesPerRun) errors.push("total frame budget exceeded");
for (const required of Object.values(budgets.benchmarks))
  if (!results.some((item) => item.fixture === required)) errors.push(`missing benchmark ${required}`);
const report = {
  version: 1,
  budgetVersion: budgets.version,
  deterministicRunsPerFixture: 2,
  totalFrames,
  results,
  errors,
};
const outputDirectory = resolve(import.meta.dir, "renders");
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, "benchmark-summary.json"), `${JSON.stringify(report, null, 2)}\n`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Animation budgets passed: ${results.length} ladder fixtures, ${totalFrames} frames, deterministic Swift`);
