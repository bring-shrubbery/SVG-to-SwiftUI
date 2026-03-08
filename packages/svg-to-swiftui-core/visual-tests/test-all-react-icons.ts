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
import { exec as execCallback } from "child_process";
import {
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

import { convert } from "../src/index";

const exec = promisify(execCallback);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DATA_DIR = resolve(__dirname, "../../../apps/nextjs/public/data/icons");
const RENDERS_DIR = resolve(__dirname, "renders");
const TEMPLATE_PATH = resolve(__dirname, "swift-template.swift");

const RENDER_WIDTH = 512;
const PASS_THRESHOLD = 98;
const STRUCT_NAME = "TestShape";
const CONCURRENCY = 8;

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
// Visual test helpers (only used with --visual)
// ---------------------------------------------------------------------------

let Resvg: typeof import("@resvg/resvg-js").Resvg;
let pixelmatch: typeof import("pixelmatch").default;
let PNG: typeof import("pngjs").PNG;

async function loadVisualDeps() {
  const resvgMod = await import("@resvg/resvg-js");
  Resvg = resvgMod.Resvg;
  pixelmatch = (await import("pixelmatch")).default;
  PNG = (await import("pngjs")).PNG;
}

function detectFillRule(svgString: string): string {
  if (/fill-?rule\s*[:=]\s*"?evenodd/i.test(svgString)) return ".evenOdd";
  return ".winding";
}

function extractDominantFillColor(svgString: string): { r: number; g: number; b: number } {
  const fillRegex = /fill\s*[:=]\s*"?([^";>\s]+)/gi;
  const colors: string[] = [];
  let match;
  while ((match = fillRegex.exec(svgString)) !== null) {
    const c = match[1]!.toLowerCase();
    if (c !== "none" && c !== "white" && c !== "#fff" && c !== "#ffffff" && c !== "currentcolor") colors.push(c);
  }
  for (const c of colors) {
    if (c === "black" || c === "#000" || c === "#000000") continue;
    if (c.startsWith("#")) {
      const hex = c.slice(1);
      if (hex.length === 3) return { r: parseInt(hex[0]! + hex[0]!, 16) / 255, g: parseInt(hex[1]! + hex[1]!, 16) / 255, b: parseInt(hex[2]! + hex[2]!, 16) / 255 };
      if (hex.length === 6) return { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255 };
    }
  }
  return { r: 0, g: 0, b: 0 };
}

async function visualTest(name: string, svg: string): Promise<{ score: number; error?: string }> {
  const svgPng = join(RENDERS_DIR, `${name}-svg.png`);
  const swiftPng = join(RENDERS_DIR, `${name}-swift.png`);
  const diffPng = join(RENDERS_DIR, `${name}-diff.png`);

  try {
    // Render SVG
    const resvg = new Resvg(svg, { background: "#ffffff", fitTo: { mode: "width" as const, value: RENDER_WIDTH } });
    const rendered = resvg.render();
    const pngBuf = Buffer.from(rendered.asPng());
    writeFileSync(svgPng, pngBuf);
    const { width, height } = rendered;

    // Convert
    const swiftCode = convert(svg, { structName: STRUCT_NAME, precision: 5 });

    // Render Swift
    const fillColor = extractDominantFillColor(svg);
    const fillRule = detectFillRule(svg);
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
      await exec(`"${binPath}" "${swiftPng}"`, { timeout: 10_000 });
    } finally {
      try { unlinkSync(srcPath); } catch {}
      try { unlinkSync(binPath); } catch {}
    }

    // Compare
    const svgImg = PNG.sync.read(readFileSync(svgPng));
    const swiftImg = PNG.sync.read(readFileSync(swiftPng));

    function toBinaryMask(png: InstanceType<typeof PNG>) {
      const out = new PNG({ width: png.width, height: png.height });
      for (let i = 0; i < png.width * png.height; i++) {
        const o = i * 4;
        const isContent = png.data[o + 3]! > 128 && (png.data[o]! < 240 || png.data[o + 1]! < 240 || png.data[o + 2]! < 240);
        out.data[o] = out.data[o + 1] = out.data[o + 2] = isContent ? 0 : 255;
        out.data[o + 3] = 255;
      }
      return out;
    }

    const svgMask = toBinaryMask(svgImg);
    const swiftMask = toBinaryMask(swiftImg);
    if (svgMask.width !== swiftMask.width || svgMask.height !== swiftMask.height) throw new Error("Dimension mismatch");

    const diff = new PNG({ width: svgMask.width, height: svgMask.height });
    const numDiff = pixelmatch(svgMask.data, swiftMask.data, diff.data, svgMask.width, svgMask.height, { threshold: 0.1 });
    writeFileSync(diffPng, PNG.sync.write(diff));

    const total = svgMask.width * svgMask.height;
    return { score: Math.round(((total - numDiff) / total) * 10000) / 100 };
  } catch (err: unknown) {
    return { score: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const doVisual = process.argv.includes("--visual");
  const countArg = process.argv.find((a) => /^\d+$/.test(a));
  const samplePerSet = countArg ? parseInt(countArg) : 0; // 0 = all

  if (doVisual) {
    if (process.platform !== "darwin") { console.log("Visual tests require macOS."); process.exit(0); }
    await loadVisualDeps();
    mkdirSync(RENDERS_DIR, { recursive: true });
  }

  const manifest = JSON.parse(readFileSync(join(ICONS_DATA_DIR, "manifest.json"), "utf-8")) as { id: string; name: string; count: number }[];

  let totalIcons = 0;
  let totalConvertErrors = 0;
  let totalSkipped = 0;
  let totalVisualPass = 0;
  let totalVisualFail = 0;
  let totalVisualError = 0;

  for (const { id, name } of manifest) {
    let icons: IconEntry[];
    try {
      icons = JSON.parse(readFileSync(join(ICONS_DATA_DIR, `${id}.json`), "utf-8"));
    } catch { continue; }

    // Sample if requested
    if (samplePerSet > 0 && icons.length > samplePerSet) {
      const step = Math.floor(icons.length / samplePerSet);
      icons = icons.filter((_, i) => i % step === 0).slice(0, samplePerSet);
    }

    let convertErrors = 0;
    let skipped = 0;
    let vPass = 0;
    let vFail = 0;
    let vErr = 0;

    for (const [iconName, iconData] of icons) {
      totalIcons++;
      if (usesMultipleColors(iconData)) { skipped++; totalSkipped++; continue; }

      const svg = iconDataToSvg(iconData);

      try {
        convert(svg, { structName: STRUCT_NAME, precision: 5 });
      } catch {
        convertErrors++;
        totalConvertErrors++;
        continue;
      }

      if (doVisual) {
        const testName = `${id}-${iconName}`.replace(/[^a-z0-9-]/g, "-");
        const result = await visualTest(testName, svg);
        if (result.error) {
          vErr++;
          totalVisualError++;
          console.log(`  [ERR ] ${testName.padEnd(45)} ${(result.error || "").substring(0, 60)}`);
        } else if (result.score < PASS_THRESHOLD) {
          vFail++;
          totalVisualFail++;
          console.log(`  [FAIL] ${testName.padEnd(45)} ${result.score.toFixed(2)}%`);
        } else {
          vPass++;
          totalVisualPass++;
        }
      }
    }

    const tested = icons.length - skipped;
    const convertStatus = convertErrors > 0 ? "FAIL" : "OK";
    let line = `  [${convertStatus}] ${name.padEnd(30)} ${String(tested).padStart(5)} tested, ${convertErrors} convert errors`;
    if (skipped > 0) line += ` (${skipped} multi-color skipped)`;
    if (doVisual) line += ` | visual: ${vPass} pass, ${vFail} fail, ${vErr} err`;
    console.log(line);
  }

  console.log("\n---");
  console.log(`Total: ${totalIcons} icons, ${totalConvertErrors} convert errors, ${totalSkipped} multi-color skipped`);
  if (doVisual) {
    console.log(`Visual: ${totalVisualPass} pass, ${totalVisualFail} fail, ${totalVisualError} errors`);
    console.log(`Threshold: ${PASS_THRESHOLD}%`);
  }

  if (totalConvertErrors > 0) process.exit(1);
}

main();
