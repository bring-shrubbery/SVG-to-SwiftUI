#!/usr/bin/env bun
/**
 * Tests all react-icons by converting SVG → SwiftUI and optionally running
 * pixel-level visual comparison. Works directly from JSON data files — no
 * fixture files are generated.
 *
 * Usage:
 *   bun run visual-tests/test-all-react-icons.ts                # conversion-only (fast)
 *   bun run visual-tests/test-all-react-icons.ts --visual        # full visual test
 *   bun run visual-tests/test-all-react-icons.ts --visual 50     # visual test, 50 per set
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import { convert } from "../src/index";
import {
  type BatchTestItem,
  type BatchTestResult,
  detectFillRule,
  extractDominantFillColor,
  runBatchVisualTest,
} from "./batch-render";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DATA_DIR = resolve(__dirname, "../../../apps/nextjs/public/data/icons");
const RENDERS_DIR = resolve(__dirname, "renders");

const RENDER_WIDTH = 512;
const PASS_THRESHOLD = 98;
const STRUCT_NAME = "TestShape";

// ---------------------------------------------------------------------------
// SVG reconstruction from react-icons data
// ---------------------------------------------------------------------------

interface IconNode {
  tag: string;
  attr: Record<string, string>;
  child: IconNode[];
}

interface IconData {
  attr: Record<string, string>;
  child: IconNode[];
}

type IconEntry = [string, IconData];

const CAMEL_TO_KEBAB: Record<string, string> = {
  strokeWidth: "stroke-width", strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin", strokeMiterlimit: "stroke-miterlimit",
  strokeDasharray: "stroke-dasharray", strokeDashoffset: "stroke-dashoffset",
  strokeOpacity: "stroke-opacity", fillRule: "fill-rule", clipRule: "clip-rule",
  fillOpacity: "fill-opacity", clipPath: "clip-path", enableBackground: "enable-background",
};

function attrToString(attr: Record<string, string>): string {
  return Object.entries(attr)
    .map(([k, v]) => `${CAMEL_TO_KEBAB[k] || k}="${v}"`)
    .join(" ");
}

function nodeToSvg(node: IconNode, indent: string): string {
  const attrStr = node.attr && Object.keys(node.attr).length > 0 ? ` ${attrToString(node.attr)}` : "";
  if (node.child == null || node.child.length === 0) return `${indent}<${node.tag}${attrStr} />`;
  const children = node.child.map((c: IconNode) => nodeToSvg(c, indent + "  ")).join("\n");
  return `${indent}<${node.tag}${attrStr}>\n${children}\n${indent}</${node.tag}>`;
}

function iconDataToSvg(data: IconData): string {
  const svgAttr = { ...data.attr, xmlns: "http://www.w3.org/2000/svg" };
  const attrStr = attrToString(svgAttr);
  const children = data.child.map((c: IconNode) => nodeToSvg(c, "  ")).join("\n");
  return `<svg ${attrStr}>\n${children}\n</svg>`;
}

function usesMultipleColors(data: IconData): boolean {
  const colors = new Set<string>();
  function scan(node: IconNode) {
    if (node.attr?.fill) {
      const c = node.attr.fill.toLowerCase();
      if (c !== "none" && c !== "currentColor") colors.add(c);
    }
    node.child?.forEach(scan);
  }
  data.child.forEach(scan);
  return colors.size > 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const doVisual = process.argv.includes("--visual");
  const countArg = process.argv.find((a) => /^\d+$/.test(a));
  const samplePerSet = countArg ? parseInt(countArg) : 0;

  if (doVisual) {
    if (process.platform !== "darwin") { console.log("Visual tests require macOS."); process.exit(0); }
    const { Resvg } = await import("@resvg/resvg-js");

    mkdirSync(RENDERS_DIR, { recursive: true });

    const manifest = JSON.parse(readFileSync(join(ICONS_DATA_DIR, "manifest.json"), "utf-8")) as { id: string; name: string; count: number }[];

    let totalIcons = 0;
    let totalConvertErrors = 0;
    let totalSkipped = 0;

    // Collect all visual items across all sets, tracking which set each belongs to
    const visualItems: (BatchTestItem & { setId: string })[] = [];
    const setStats = new Map<string, { name: string; tested: number; convertErrors: number; skipped: number }>();

    for (const { id, name } of manifest) {
      let icons: IconEntry[];
      try {
        icons = JSON.parse(readFileSync(join(ICONS_DATA_DIR, `${id}.json`), "utf-8"));
      } catch { continue; }

      if (samplePerSet > 0 && icons.length > samplePerSet) {
        const step = Math.floor(icons.length / samplePerSet);
        icons = icons.filter((_, i) => i % step === 0).slice(0, samplePerSet);
      }

      let convertErrors = 0;
      let skipped = 0;

      for (const [iconName, iconData] of icons) {
        totalIcons++;
        if (usesMultipleColors(iconData)) { skipped++; totalSkipped++; continue; }

        const svg = iconDataToSvg(iconData);

        try {
          const swiftCode = convert(svg, { structName: `S${visualItems.length}`, precision: 5 });

          const testName = `${id}-${iconName}`.replace(/[^a-z0-9-]/g, "-");
          const resvg = new Resvg(svg, { background: "#ffffff", fitTo: { mode: "width" as const, value: RENDER_WIDTH } });
          const rendered = resvg.render();
          const svgPngPath = join(RENDERS_DIR, `${testName}-svg.png`);
          writeFileSync(svgPngPath, Buffer.from(rendered.asPng()));

          visualItems.push({
            name: testName,
            svgPngPath,
            swiftCode,
            width: rendered.width,
            height: rendered.height,
            fillColor: extractDominantFillColor(svg),
            fillRule: detectFillRule(svg),
            setId: id,
          });
        } catch {
          convertErrors++;
          totalConvertErrors++;
        }
      }

      setStats.set(id, { name, tested: icons.length - skipped, convertErrors, skipped });

      const tested = icons.length - skipped;
      const convertStatus = convertErrors > 0 ? "FAIL" : "OK";
      let line = `  [${convertStatus}] ${name.padEnd(30)} ${String(tested).padStart(5)} tested, ${convertErrors} convert errors`;
      if (skipped > 0) line += ` (${skipped} multi-color skipped)`;
      console.log(line);
    }

    console.log(`\nConversion: ${totalIcons} icons, ${totalConvertErrors} errors, ${totalSkipped} multi-color skipped`);
    console.log(`\nPreparing ${visualItems.length} visual tests...\n`);

    // Batch visual test
    const batchResults = await runBatchVisualTest(visualItems, RENDERS_DIR, PASS_THRESHOLD);

    // Per-set visual results
    const setVisualResults = new Map<string, BatchTestResult[]>();
    for (let i = 0; i < visualItems.length; i++) {
      const setId = visualItems[i]!.setId;
      if (!setVisualResults.has(setId)) setVisualResults.set(setId, []);
      setVisualResults.get(setId)!.push(batchResults[i]!);
    }

    let totalVisualPass = 0;
    let totalVisualFail = 0;
    let totalVisualError = 0;

    console.log("");
    for (const [setId, results] of setVisualResults) {
      const stats = setStats.get(setId)!;
      const pass = results.filter((r) => r.status === "pass").length;
      const fail = results.filter((r) => r.status === "fail").length;
      const err = results.filter((r) => r.status === "error").length;
      totalVisualPass += pass;
      totalVisualFail += fail;
      totalVisualError += err;

      // Print failures/errors
      for (const r of results) {
        if (r.status === "fail") {
          console.log(`  [FAIL] ${r.name.padEnd(45)} ${r.score.toFixed(2)}%`);
        } else if (r.status === "error") {
          console.log(`  [ERR ] ${r.name.padEnd(45)} ${(r.error || "").substring(0, 60)}`);
        }
      }

      console.log(`  ${stats.name.padEnd(30)} visual: ${pass} pass, ${fail} fail, ${err} err`);
    }

    console.log("\n---");
    console.log(`Total: ${totalIcons} icons, ${totalConvertErrors} convert errors, ${totalSkipped} multi-color skipped`);
    console.log(`Visual: ${totalVisualPass} pass, ${totalVisualFail} fail, ${totalVisualError} errors`);
    console.log(`Threshold: ${PASS_THRESHOLD}%`);

    if (totalConvertErrors > 0 || totalVisualFail > 0) process.exit(1);
  } else {
    // Conversion-only mode (no visual rendering)
    const manifest = JSON.parse(readFileSync(join(ICONS_DATA_DIR, "manifest.json"), "utf-8")) as { id: string; name: string; count: number }[];

    let totalIcons = 0;
    let totalConvertErrors = 0;
    let totalSkipped = 0;

    for (const { id, name } of manifest) {
      let icons: IconEntry[];
      try {
        icons = JSON.parse(readFileSync(join(ICONS_DATA_DIR, `${id}.json`), "utf-8"));
      } catch { continue; }

      if (samplePerSet > 0 && icons.length > samplePerSet) {
        const step = Math.floor(icons.length / samplePerSet);
        icons = icons.filter((_, i) => i % step === 0).slice(0, samplePerSet);
      }

      let convertErrors = 0;
      let skipped = 0;

      for (const [iconName, iconData] of icons) {
        totalIcons++;
        if (usesMultipleColors(iconData)) { skipped++; totalSkipped++; continue; }

        const svg = iconDataToSvg(iconData);
        try {
          convert(svg, { structName: STRUCT_NAME, precision: 5 });
        } catch {
          convertErrors++;
          totalConvertErrors++;
        }
      }

      const tested = icons.length - skipped;
      const convertStatus = convertErrors > 0 ? "FAIL" : "OK";
      let line = `  [${convertStatus}] ${name.padEnd(30)} ${String(tested).padStart(5)} tested, ${convertErrors} convert errors`;
      if (skipped > 0) line += ` (${skipped} multi-color skipped)`;
      console.log(line);
    }

    console.log("\n---");
    console.log(`Total: ${totalIcons} icons, ${totalConvertErrors} convert errors, ${totalSkipped} multi-color skipped`);

    if (totalConvertErrors > 0) process.exit(1);
  }
}

main();
