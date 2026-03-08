#!/usr/bin/env bun

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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures");
const RENDERS_DIR = resolve(__dirname, "renders");
const TEMPLATE_PATH = resolve(__dirname, "swift-template.swift");

const RENDER_WIDTH = 512;
const PASS_THRESHOLD = 98; // percent
const STRUCT_NAME = "TestShape";
const CONCURRENCY = 4;

// ---------------------------------------------------------------------------
// SVG → PNG  (resvg)
// ---------------------------------------------------------------------------

function renderSvg(
  svg: string,
): { png: Buffer; width: number; height: number } {
  const resvg = new Resvg(svg, {
    background: "#ffffff",
    fitTo: { mode: "width", value: RENDER_WIDTH },
  });
  const rendered = resvg.render();
  return {
    png: Buffer.from(rendered.asPng()),
    width: rendered.width,
    height: rendered.height,
  };
}

// ---------------------------------------------------------------------------
// Swift → PNG  (swiftc + CoreGraphics)
// ---------------------------------------------------------------------------

interface FillColor {
  r: number;
  g: number;
  b: number;
}

function extractDominantFillColor(svgString: string): FillColor {
  // Find all fill color attributes (not "none" or "white")
  const fillRegex = /fill\s*[:=]\s*"?([^";>\s]+)/gi;
  const colors: string[] = [];
  let match;
  while ((match = fillRegex.exec(svgString)) !== null) {
    const c = match[1]!.toLowerCase();
    if (c !== "none" && c !== "white" && c !== "#fff" && c !== "#ffffff") {
      colors.push(c);
    }
  }

  // Parse the most common non-black fill color
  for (const c of colors) {
    if (c === "black" || c === "#000" || c === "#000000") continue;
    const parsed = parseColor(c);
    if (parsed) return parsed;
  }

  return { r: 0, g: 0, b: 0 }; // default black
}

function parseColor(c: string): FillColor | null {
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0]! + hex[0]!, 16) / 255,
        g: parseInt(hex[1]! + hex[1]!, 16) / 255,
        b: parseInt(hex[2]! + hex[2]!, 16) / 255,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
      };
    }
  }
  return null;
}

async function renderSwift(
  swiftCode: string,
  width: number,
  height: number,
  outputPath: string,
  fillColor: FillColor,
): Promise<void> {
  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  const source = template
    .replaceAll("__SHAPE_CODE__", swiftCode)
    .replaceAll("__SHAPE_NAME__", STRUCT_NAME)
    .replaceAll("__WIDTH__", String(width))
    .replaceAll("__HEIGHT__", String(height))
    .replaceAll("__FILL_RULE__", ".winding")
    .replaceAll("__FILL_R__", String(fillColor.r))
    .replaceAll("__FILL_G__", String(fillColor.g))
    .replaceAll("__FILL_B__", String(fillColor.b));

  const id = `svg-swiftui-vtest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const srcPath = join(tmpdir(), `${id}.swift`);
  const binPath = join(tmpdir(), id);

  try {
    writeFileSync(srcPath, source);
    await exec(`swiftc -framework AppKit "${srcPath}" -o "${binPath}"`, {
      timeout: 60_000,
    });
    await exec(`"${binPath}" "${outputPath}"`, {
      timeout: 10_000,
    });
  } finally {
    try {
      unlinkSync(srcPath);
    } catch {}
    try {
      unlinkSync(binPath);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Binary mask conversion (for shape‑only comparison)
// ---------------------------------------------------------------------------

function toBinaryMask(png: PNG): PNG {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.width * png.height; i++) {
    const o = i * 4;
    const r = png.data[o]!;
    const g = png.data[o + 1]!;
    const b = png.data[o + 2]!;
    const a = png.data[o + 3]!;

    // "content" = not transparent AND not near‑white
    const isContent = a > 128 && (r < 240 || g < 240 || b < 240);

    out.data[o] = isContent ? 0 : 255;
    out.data[o + 1] = isContent ? 0 : 255;
    out.data[o + 2] = isContent ? 0 : 255;
    out.data[o + 3] = 255;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pixel comparison
// ---------------------------------------------------------------------------

function compareImages(
  svgPngPath: string,
  swiftPngPath: string,
  diffPath: string,
): number {
  const svgImg = PNG.sync.read(readFileSync(svgPngPath));
  const swiftImg = PNG.sync.read(readFileSync(swiftPngPath));

  const svgMask = toBinaryMask(svgImg);
  const swiftMask = toBinaryMask(swiftImg);

  if (
    svgMask.width !== swiftMask.width ||
    svgMask.height !== swiftMask.height
  ) {
    throw new Error(
      `Dimension mismatch: SVG ${svgMask.width}x${svgMask.height} vs Swift ${swiftMask.width}x${swiftMask.height}`,
    );
  }

  const diff = new PNG({ width: svgMask.width, height: svgMask.height });
  const numDiff = pixelmatch(
    svgMask.data,
    swiftMask.data,
    diff.data,
    svgMask.width,
    svgMask.height,
    { threshold: 0.1 },
  );

  writeFileSync(diffPath, PNG.sync.write(diff));

  const total = svgMask.width * svgMask.height;
  return ((total - numDiff) / total) * 100;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

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

    // 1. Render SVG
    const svgResult = renderSvg(svgString);
    writeFileSync(svgPng, svgResult.png);

    // 2. Convert SVG → Swift
    const swiftCode = convert(svgString, {
      structName: STRUCT_NAME,
      precision: 5,
    });

    // 3. Render Swift (using SVG's dominant fill color for accurate comparison)
    const fillColor = extractDominantFillColor(svgString);
    await renderSwift(swiftCode, svgResult.width, svgResult.height, swiftPng, fillColor);

    // 4. Compare
    const score = compareImages(svgPng, swiftPng, diffPng);

    return {
      name,
      score: Math.round(score * 100) / 100,
      status: score >= PASS_THRESHOLD ? "pass" : "fail",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { name, score: 0, status: "error", error: message };
  }
}

// ---------------------------------------------------------------------------
// Concurrency pool
// ---------------------------------------------------------------------------

async function runPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  onResult?: (result: R) => void,
): Promise<R[]> {
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (process.platform !== "darwin") {
    console.error(
      "Visual tests require macOS (swiftc + CoreGraphics). Skipping.",
    );
    process.exit(0);
  }

  mkdirSync(RENDERS_DIR, { recursive: true });

  // Optional filter via CLI args
  const filter = process.argv[2];

  const svgFiles = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".svg"))
    .filter((f) => !filter || f.includes(filter))
    .sort()
    .map((f) => resolve(FIXTURES_DIR, f));

  if (svgFiles.length === 0) {
    console.error(
      filter
        ? `No SVG fixtures matching "${filter}" in ${FIXTURES_DIR}`
        : `No SVG fixtures found in ${FIXTURES_DIR}`,
    );
    process.exit(1);
  }

  console.log(`Running ${svgFiles.length} visual test(s) with ${CONCURRENCY} workers...\n`);

  const results = await runPool(
    svgFiles,
    runTest,
    CONCURRENCY,
    (result) => {
      const tag =
        result.status === "pass"
          ? "PASS"
          : result.status === "fail"
            ? "FAIL"
            : "ERR ";
      const scoreStr =
        result.status === "error" ? "error" : `${result.score.toFixed(2)}%`;
      const errStr = result.error
        ? ` (${result.error.substring(0, 100)})`
        : "";
      console.log(`  [${tag}] ${result.name.padEnd(25)} ${scoreStr}${errStr}`);
    },
  );

  // Summary
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const errors = results.filter((r) => r.status === "error").length;
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length;

  console.log("\n---");
  console.log(`Results: ${passed} passed, ${failed} failed, ${errors} errors`);
  console.log(`Average score: ${avg.toFixed(2)}%`);
  console.log(`Threshold: ${PASS_THRESHOLD}%`);
  console.log(`Renders: ${RENDERS_DIR}`);

  // JSON summary for machine consumption
  const summary = {
    timestamp: new Date().toISOString(),
    threshold: PASS_THRESHOLD,
    averageScore: Math.round(avg * 100) / 100,
    results: results.map((r) => ({
      name: r.name,
      score: r.score,
      status: r.status,
      ...(r.error ? { error: r.error } : {}),
    })),
  };
  writeFileSync(
    resolve(RENDERS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
  );

  if (failed > 0 || errors > 0) {
    process.exit(1);
  }
}

main();
