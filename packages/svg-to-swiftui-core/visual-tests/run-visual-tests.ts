#!/usr/bin/env bun
/**
 * Visual regression tests — compares SVG renders (resvg) against Swift renders
 * (CoreGraphics) to verify the SVG→SwiftUI conversion produces correct shapes.
 *
 * Uses batch compilation: all shapes compile into ONE Swift binary, then render
 * all PNGs in a single execution.
 *
 * Caching makes subsequent runs fast:
 *   - SVG PNGs are cached by fixture file mtime (skip resvg if unchanged)
 *   - Swift binary is cached by converter output hash (skip compile if unchanged)
 *   - Swift PNGs are cached when binary is unchanged (skip render)
 *
 * Usage:
 *   bun run visual-tests/run-visual-tests.ts          # all fixtures
 *   bun run visual-tests/run-visual-tests.ts star      # filter by name
 *   bun run visual-tests/run-visual-tests.ts --fresh   # ignore caches
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { Resvg } from "@resvg/resvg-js";

import { convert } from "../src/index";
import {
  type BatchTestItem,
  type BatchTestResult,
  detectFillRule,
  extractDominantFillColor,
  runBatchVisualTest,
} from "./batch-render";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures");
const RENDERS_DIR = resolve(__dirname, "renders");
const SVG_CACHE_PATH = resolve(RENDERS_DIR, ".svg-cache.json");

const RENDER_WIDTH = 512;
const PASS_THRESHOLD = 98;

interface SvgCacheEntry {
  w: number;
  h: number;
  mt: number;
}

async function main() {
  if (process.platform !== "darwin") {
    console.error("Visual tests require macOS (swiftc + CoreGraphics). Skipping.");
    process.exit(0);
  }

  mkdirSync(RENDERS_DIR, { recursive: true });

  const fresh = process.argv.includes("--fresh");
  const filter = process.argv.find((a) => a !== "--fresh" && !a.endsWith(".ts") && !a.includes("/"));

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

  // Load SVG dimension cache
  let svgCache: Record<string, SvgCacheEntry> = {};
  if (!fresh) {
    try { svgCache = JSON.parse(readFileSync(SVG_CACHE_PATH, "utf-8")); } catch {}
  }

  console.log(`Processing ${svgFiles.length} fixtures...\n`);

  const items: BatchTestItem[] = [];
  const conversionErrors: BatchTestResult[] = [];
  const t0 = Date.now();
  let svgCacheHits = 0;

  for (const file of svgFiles) {
    const name = basename(file, ".svg");
    const svgString = readFileSync(file, "utf-8");
    const svgPngPath = resolve(RENDERS_DIR, `${name}-svg.png`);

    try {
      let width: number;
      let height: number;

      // Check SVG PNG cache
      const svgMtime = statSync(file).mtimeMs;
      const cached = svgCache[name];

      if (!fresh && cached && cached.mt === svgMtime && existsSync(svgPngPath)) {
        width = cached.w;
        height = cached.h;
        svgCacheHits++;
      } else {
        const resvg = new Resvg(svgString, {
          background: "#ffffff",
          fitTo: { mode: "width" as const, value: RENDER_WIDTH },
        });
        const rendered = resvg.render();
        writeFileSync(svgPngPath, Buffer.from(rendered.asPng()));
        width = rendered.width;
        height = rendered.height;
        svgCache[name] = { w: width, h: height, mt: svgMtime };
      }

      const swiftCode = convert(svgString, {
        structName: `S${items.length}`,
        precision: 5,
      });

      items.push({
        name,
        svgPngPath,
        swiftCode,
        width,
        height,
        fillColor: extractDominantFillColor(svgString),
        fillRule: detectFillRule(svgString),
      });
    } catch (err) {
      conversionErrors.push({
        name,
        score: 0,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Save SVG cache
  writeFileSync(SVG_CACHE_PATH, JSON.stringify(svgCache));

  const prepTime = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  Prepared ${items.length} shapes in ${prepTime}s (${svgCacheHits} SVG cache hits)`);
  if (conversionErrors.length > 0) {
    console.log(`  ${conversionErrors.length} conversion error(s)`);
  }

  // Batch compile, render, compare
  const batchResults = await runBatchVisualTest(items, RENDERS_DIR, PASS_THRESHOLD);
  const results = [...batchResults, ...conversionErrors];

  // Report
  console.log("");
  for (const r of results) {
    const tag = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "ERR ";
    const scoreStr = r.status === "error" ? "error" : `${r.score.toFixed(2)}%`;
    const errStr = r.error ? ` (${r.error.substring(0, 100)})` : "";
    console.log(`  [${tag}] ${r.name.padEnd(25)} ${scoreStr}${errStr}`);
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const errors = results.filter((r) => r.status === "error").length;
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length;

  console.log("\n---");
  console.log(`Results: ${passed} passed, ${failed} failed, ${errors} errors`);
  console.log(`Average score: ${avg.toFixed(2)}%`);
  console.log(`Threshold: ${PASS_THRESHOLD}%`);
  console.log(`Renders: ${RENDERS_DIR}`);

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
  writeFileSync(resolve(RENDERS_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  if (failed > 0 || errors > 0) process.exit(1);
}

main();
