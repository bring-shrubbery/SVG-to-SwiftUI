#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { __testing, convert } from "../src";
import { findSvgFiles, fixtureKey, MANIFEST_PATH, outputMode } from "./manifest";

const LOGICAL_WIDTH = 128;

function needsPreservedPaint(source: string): boolean {
  const paintPattern = /\b(?:fill|stroke)\s*(?:=\s*["']([^"']+)["']|:\s*([^;"']+))/gi;
  for (const match of source.matchAll(paintPattern)) {
    const paint = (match[1] ?? match[2] ?? "").trim().toLowerCase();
    if (!["none", "black", "#000", "#000000", "currentcolor"].includes(paint)) return true;
  }
  for (const match of source.matchAll(
    /\b(?:opacity|fill-opacity|stroke-opacity)\s*(?:=\s*["']([^"']+)["']|:\s*([^;"']+))/gi,
  )) {
    if (Number(match[1] ?? match[2]) !== 1) return true;
  }
  return false;
}

function logicalSize(name: string, source: string): { width: number; height: number } {
  const document = __testing.parseRenderDocument(source);
  if (name.startsWith("viewport-")) {
    return { width: document.viewport.width, height: document.viewport.height };
  }
  const aspect = document.viewport.height / document.viewport.width;
  return { width: LOGICAL_WIDTH, height: Math.max(1, Math.round(LOGICAL_WIDTH * aspect)) };
}

function tagsFor(name: string, source: string, expectedMode: "shape" | "view"): string[] {
  const tags = new Set<string>([expectedMode, "geometry"]);
  if (name.startsWith("lucide-")) {
    tags.add("lucide");
    tags.add("realistic");
  }
  if (name.startsWith("harness-")) {
    tags.add("harness");
    tags.add("rgba");
  }
  if (name.startsWith("structure-")) tags.add("structure");
  if (name.startsWith("viewport-")) tags.add("viewport");
  if (name.startsWith("viewport-realistic-")) tags.add("realistic");
  for (const element of [
    "path",
    "circle",
    "ellipse",
    "rect",
    "line",
    "polyline",
    "polygon",
    "use",
    "symbol",
    "switch",
  ]) {
    if (new RegExp(`<${element}\\b`, "i").test(source)) tags.add(element);
  }
  if (/\btransform\s*=/.test(source)) tags.add("transform");
  if (/\bpreserveAspectRatio\s*=/.test(source)) tags.add("preserve-aspect-ratio");
  if (/(?:\d|\.)\s*%|(?:\d|\.)\s*(?:px|in|cm|mm|q|pt|pc|em|ex|ch|rem|vw|vh|vmin|vmax)\b/i.test(source))
    tags.add("units");
  if (/<svg\b[\s\S]*<svg\b/i.test(source)) tags.add("nested-svg");
  if (/\boverflow\s*=/.test(source) || /<svg\b[\s\S]*<svg\b/i.test(source)) tags.add("overflow");
  if (/\bstroke\s*(?:=|:)/.test(source)) tags.add("stroke");
  if (/\bopacity\s*(?:=|:)/.test(source)) tags.add("opacity");
  return [...tags].sort();
}

const fixtures: Record<string, object> = {};
for (const sourcePath of findSvgFiles()) {
  const source = readFileSync(sourcePath, "utf8");
  const name = fixtureKey(sourcePath);
  const size = logicalSize(name, source);
  const automaticMode = outputMode(convert(source, { structName: "ManifestFixture" }));
  if (!automaticMode) throw new Error(`Could not determine generated output mode for ${name}.`);
  const expectedMode = needsPreservedPaint(source) || automaticMode === "view" ? "view" : "shape";
  fixtures[name] = {
    width: size.width,
    height: size.height,
    expectedMode,
    tags: tagsFor(basename(name), source, expectedMode),
  };
}

const manifest = {
  version: 1,
  defaults: {
    scale: 2,
    background: null,
    fonts: [],
    tolerance: {
      channel: 24,
      maxOutsidePercent: 3,
      maxMeanRgbError: 3,
      maxMeanAlphaError: 3,
    },
  },
  fixtures,
};
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
const formatted = Bun.spawnSync(["bunx", "biome", "format", "--write", MANIFEST_PATH], {
  stdout: "ignore",
  stderr: "inherit",
});
if (formatted.exitCode !== 0) throw new Error("Could not format the generated fixture manifest.");
console.log(`Updated ${MANIFEST_PATH} with ${Object.keys(fixtures).length} fixtures.`);
