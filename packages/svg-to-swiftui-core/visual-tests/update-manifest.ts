#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { findSvgFiles, fixtureKey, MANIFEST_PATH } from "./manifest";

const LOGICAL_WIDTH = 128;

function needsView(source: string): boolean {
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

function logicalSize(source: string): { width: number; height: number } {
  const opening = /<svg\b([^>]*)>/i.exec(source)?.[1] ?? "";
  const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/i
    .exec(opening)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  let aspect = viewBox?.length === 4 ? viewBox[3]! / viewBox[2]! : Number.NaN;
  if (!Number.isFinite(aspect) || aspect <= 0) {
    const width = Number(/\bwidth\s*=\s*["']([\d.]+)/i.exec(opening)?.[1]);
    const height = Number(/\bheight\s*=\s*["']([\d.]+)/i.exec(opening)?.[1]);
    aspect = Number.isFinite(width) && Number.isFinite(height) && width > 0 ? height / width : 1;
  }
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
  if (/\bstroke\s*(?:=|:)/.test(source)) tags.add("stroke");
  if (/\bopacity\s*(?:=|:)/.test(source)) tags.add("opacity");
  return [...tags].sort();
}

const fixtures: Record<string, object> = {};
for (const sourcePath of findSvgFiles()) {
  const source = readFileSync(sourcePath, "utf8");
  const name = fixtureKey(sourcePath);
  const size = logicalSize(source);
  const expectedMode = needsView(source) ? "view" : "shape";
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
