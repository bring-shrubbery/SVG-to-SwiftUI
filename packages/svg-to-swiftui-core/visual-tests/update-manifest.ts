#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { __testing, convert } from "../src";
import { findSvgFiles, fixtureKey, MANIFEST_PATH, outputMode } from "./manifest";

const LOGICAL_WIDTH = 128;

interface ExistingFixture {
  scale?: number;
  background?: string | null;
  fonts?: string[];
  tolerance?: Record<string, number>;
  toleranceReason?: string;
}

let existingFixtures: Record<string, ExistingFixture> = {};
try {
  existingFixtures = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")).fixtures ?? {};
} catch {}

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
  if (name.startsWith("css-")) tags.add("css");
  if (name.startsWith("compositing-")) tags.add("compositing");
  if (name.startsWith("gradient-")) tags.add("gradient");
  if (name.startsWith("pattern-")) tags.add("pattern");
  if (name.startsWith("mask-")) tags.add("mask");
  if (name.startsWith("clip-")) tags.add("clip-path");
  if (name.startsWith("blend-")) tags.add("blend-mode");
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
    "g",
    "linearGradient",
    "radialGradient",
    "stop",
    "pattern",
    "mask",
    "clipPath",
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
  if (/\bvisibility\s*(?:=|:)/.test(source)) tags.add("visibility");
  if (/\bdisplay\s*(?:=|:)/.test(source)) tags.add("display");
  if (/\bpaint-order\s*(?:=|:)/.test(source)) tags.add("paint-order");
  if (/\bgradientUnits\s*=/.test(source)) tags.add("gradient-units");
  if (/\bgradientTransform\s*=/.test(source)) tags.add("gradient-transform");
  if (/\bspreadMethod\s*=/.test(source)) tags.add("gradient-spread");
  if (/<(?:linearGradient|radialGradient)\b[^>]*(?:href|xlink:href)\s*=/.test(source)) tags.add("gradient-href");
  if (/\bpatternUnits\s*=/.test(source)) tags.add("pattern-units");
  if (/\bpatternContentUnits\s*=/.test(source)) tags.add("pattern-content-units");
  if (/\bpatternTransform\s*=/.test(source)) tags.add("pattern-transform");
  if (/\bmaskUnits\s*=/.test(source)) tags.add("mask-units");
  if (/\bmaskContentUnits\s*=/.test(source)) tags.add("mask-content-units");
  if (/\bmask-type\s*(?:=|:)/.test(source)) tags.add("mask-type");
  if (/\bclipPathUnits\s*=/.test(source)) tags.add("clip-path-units");
  if (/\bclip-rule\s*(?:=|:)/.test(source)) tags.add("clip-rule");
  if (/\bmix-blend-mode\s*(?:=|:)/.test(source)) tags.add("blend-mode");
  if (/\bisolation\s*(?:=|:)/.test(source)) tags.add("isolation");
  if (/<pattern\b[^>]*(?:href|xlink:href)\s*=/.test(source)) tags.add("pattern-href");
  if (/var\(\s*--|--[\w-]+\s*:/.test(source)) tags.add("css-variables");
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
  const existing = existingFixtures[name];
  fixtures[name] = {
    width: size.width,
    height: size.height,
    expectedMode,
    tags: tagsFor(basename(name), source, expectedMode),
    ...(existing?.scale === undefined ? {} : { scale: existing.scale }),
    ...(existing?.background === undefined ? {} : { background: existing.background }),
    ...(existing?.fonts === undefined ? {} : { fonts: existing.fonts }),
    ...(existing?.tolerance === undefined ? {} : { tolerance: existing.tolerance }),
    ...(existing?.toleranceReason === undefined ? {} : { toleranceReason: existing.toleranceReason }),
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
