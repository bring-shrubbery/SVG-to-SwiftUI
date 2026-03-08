#!/usr/bin/env bun
/**
 * Runs visual tests on a random sample of icons from each react-icons set.
 * Usage: bun run visual-tests/run-sample-tests.ts [count-per-set]
 */
import { exec as execCallback } from "child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

import { Resvg } from "@resvg/resvg-js";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { convert } from "../src/index";

const exec = promisify(execCallback);
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures");
const RENDERS_DIR = resolve(__dirname, "renders");
const TEMPLATE_PATH = resolve(__dirname, "swift-template.swift");

const RENDER_WIDTH = 512;
const PASS_THRESHOLD = 98;
const STRUCT_NAME = "TestShape";
const CONCURRENCY = 8;

const PREFIXES = [
  "ai", "bi", "bs", "cg", "ci", "di", "fa-", "fa6", "fc", "fi",
  "gi", "go", "gr", "hi-", "hi2", "im", "io-", "io5", "lia", "lu",
  "md", "pi", "ri", "rx", "si", "sl", "tb", "tfi", "ti", "vsc", "wi",
];

function renderSvg(svg: string) {
  const resvg = new Resvg(svg, {
    background: "#ffffff",
    fitTo: { mode: "width" as const, value: RENDER_WIDTH },
  });
  const rendered = resvg.render();
  return { png: Buffer.from(rendered.asPng()), width: rendered.width, height: rendered.height };
}

function extractDominantFillColor(svgString: string) {
  const fillRegex = /fill\s*[:=]\s*"?([^";>\s]+)/gi;
  const colors: string[] = [];
  let match;
  while ((match = fillRegex.exec(svgString)) !== null) {
    const c = match[1]!.toLowerCase();
    if (c !== "none" && c !== "white" && c !== "#fff" && c !== "#ffffff") colors.push(c);
  }
  for (const c of colors) {
    if (c === "black" || c === "#000" || c === "#000000" || c === "currentcolor") continue;
    if (c.startsWith("#")) {
      const hex = c.slice(1);
      if (hex.length === 3) return { r: parseInt(hex[0]! + hex[0]!, 16) / 255, g: parseInt(hex[1]! + hex[1]!, 16) / 255, b: parseInt(hex[2]! + hex[2]!, 16) / 255 };
      if (hex.length === 6) return { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255 };
    }
  }
  return { r: 0, g: 0, b: 0 };
}

function detectFillRule(svgString: string): string {
  // Check for fill-rule="evenodd" or fillRule="evenodd" in the SVG
  if (/fill-?rule\s*[:=]\s*"?evenodd/i.test(svgString)) return ".evenOdd";
  return ".winding";
}

async function renderSwift(swiftCode: string, width: number, height: number, outputPath: string, fillColor: { r: number; g: number; b: number }, fillRule: string) {
  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  const source = template
    .replaceAll("__SHAPE_CODE__", swiftCode)
    .replaceAll("__SHAPE_NAME__", STRUCT_NAME)
    .replaceAll("__WIDTH__", String(width))
    .replaceAll("__HEIGHT__", String(height))
    .replaceAll("__FILL_RULE__", fillRule)
    .replaceAll("__FILL_R__", String(fillColor.r))
    .replaceAll("__FILL_G__", String(fillColor.g))
    .replaceAll("__FILL_B__", String(fillColor.b));

  const id = `svg-vt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const srcPath = join(tmpdir(), `${id}.swift`);
  const binPath = join(tmpdir(), id);

  try {
    writeFileSync(srcPath, source);
    await exec(`swiftc -framework AppKit "${srcPath}" -o "${binPath}"`, { timeout: 60_000 });
    await exec(`"${binPath}" "${outputPath}"`, { timeout: 10_000 });
  } finally {
    try { unlinkSync(srcPath); } catch {}
    try { unlinkSync(binPath); } catch {}
  }
}

function toBinaryMask(png: PNG): PNG {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.width * png.height; i++) {
    const o = i * 4;
    const r = png.data[o]!;
    const g = png.data[o + 1]!;
    const b = png.data[o + 2]!;
    const a = png.data[o + 3]!;
    const isContent = a > 128 && (r < 240 || g < 240 || b < 240);
    out.data[o] = isContent ? 0 : 255;
    out.data[o + 1] = isContent ? 0 : 255;
    out.data[o + 2] = isContent ? 0 : 255;
    out.data[o + 3] = 255;
  }
  return out;
}

interface TestResult {
  name: string;
  score: number;
  status: "pass" | "fail" | "error";
  error?: string;
}

async function runTest(svgFile: string): Promise<TestResult> {
  const name = basename(svgFile, ".svg");
  const svgPng = resolve(RENDERS_DIR, `${name}-svg.png`);
  const swiftPng = resolve(RENDERS_DIR, `${name}-swift.png`);
  const diffPng = resolve(RENDERS_DIR, `${name}-diff.png`);

  try {
    const svgString = readFileSync(svgFile, "utf-8");
    const svgResult = renderSvg(svgString);
    writeFileSync(svgPng, svgResult.png);

    const swiftCode = convert(svgString, { structName: STRUCT_NAME, precision: 5 });
    const fillColor = extractDominantFillColor(svgString);
    const fillRule = detectFillRule(svgString);
    await renderSwift(swiftCode, svgResult.width, svgResult.height, swiftPng, fillColor, fillRule);

    const svgImg = PNG.sync.read(readFileSync(svgPng));
    const swiftImg = PNG.sync.read(readFileSync(swiftPng));
    const svgMask = toBinaryMask(svgImg);
    const swiftMask = toBinaryMask(swiftImg);

    if (svgMask.width !== swiftMask.width || svgMask.height !== swiftMask.height) {
      throw new Error(`Dimension mismatch`);
    }

    const diff = new PNG({ width: svgMask.width, height: svgMask.height });
    const numDiff = pixelmatch(svgMask.data, swiftMask.data, diff.data, svgMask.width, svgMask.height, { threshold: 0.1 });
    writeFileSync(diffPng, PNG.sync.write(diff));

    const total = svgMask.width * svgMask.height;
    const score = Math.round(((total - numDiff) / total) * 10000) / 100;

    return { name, score, status: score >= PASS_THRESHOLD ? "pass" : "fail" };
  } catch (err: unknown) {
    return { name, score: 0, status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

async function runPool<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number, onResult?: (result: R) => void): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) break;
      const result = await fn(items[idx]!);
      results[idx] = result;
      onResult?.(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main() {
  if (process.platform !== "darwin") {
    console.log("Visual tests require macOS. Skipping.");
    process.exit(0);
  }

  mkdirSync(RENDERS_DIR, { recursive: true });

  const countPerSet = parseInt(process.argv[2] || "20");
  const allFixtures = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".svg")).sort();

  // Select sample per prefix
  const selected: string[] = [];
  for (const prefix of PREFIXES) {
    const matching = allFixtures.filter((f) => f.startsWith(prefix));
    // Take evenly spaced samples
    const step = Math.max(1, Math.floor(matching.length / countPerSet));
    for (let i = 0; i < matching.length && selected.length < selected.length + countPerSet; i += step) {
      selected.push(matching[i]!);
      if (selected.filter((s) => s.startsWith(prefix)).length >= countPerSet) break;
    }
  }

  const svgFiles = selected.map((f) => resolve(FIXTURES_DIR, f));
  console.log(`Running ${svgFiles.length} sample visual tests (${countPerSet} per set) with ${CONCURRENCY} workers...\n`);

  const results = await runPool(svgFiles, runTest, CONCURRENCY, (result) => {
    if (result.status !== "pass") {
      const tag = result.status === "fail" ? "FAIL" : "ERR ";
      const scoreStr = result.status === "error" ? "error" : `${result.score.toFixed(2)}%`;
      const errStr = result.error ? ` (${result.error.substring(0, 80)})` : "";
      console.log(`  [${tag}] ${result.name.padEnd(40)} ${scoreStr}${errStr}`);
    }
  });

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const errors = results.filter((r) => r.status === "error").length;
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length;

  console.log(`\n---`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${errors} errors (of ${results.length} total)`);
  console.log(`Average score: ${avg.toFixed(2)}%`);

  // Show failures grouped by prefix
  if (failed > 0) {
    const failsByPrefix = new Map<string, TestResult[]>();
    for (const r of results.filter((r) => r.status === "fail")) {
      const prefix = r.name.split("-")[0]!;
      if (!failsByPrefix.has(prefix)) failsByPrefix.set(prefix, []);
      failsByPrefix.get(prefix)!.push(r);
    }
    console.log("\nFailures by set:");
    for (const [prefix, fails] of failsByPrefix) {
      console.log(`  ${prefix}: ${fails.length} failures (avg ${(fails.reduce((s, r) => s + r.score, 0) / fails.length).toFixed(1)}%)`);
      for (const f of fails.slice(0, 3)) {
        console.log(`    ${f.name}: ${f.score.toFixed(2)}%`);
      }
      if (fails.length > 3) console.log(`    ... and ${fails.length - 3} more`);
    }
  }

  if (errors > 0) {
    console.log("\nErrors:");
    for (const r of results.filter((r) => r.status === "error").slice(0, 10)) {
      console.log(`  ${r.name}: ${r.error?.substring(0, 100)}`);
    }
  }
}

main();
