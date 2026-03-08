/**
 * Batch visual test renderer — compiles ALL shapes into a single Swift binary,
 * then renders all PNGs in one execution. This turns N compilations into 1.
 *
 * Caching:
 *   - Compiled binary is cached by hash of all Swift source code.
 *     If the converter hasn't changed, compilation is skipped entirely.
 *   - Swift PNGs are skipped if the binary is cached and all PNGs exist.
 */
import { createHash } from "crypto";
import { exec as execCallback } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const exec = promisify(execCallback);
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(__dirname, "swift-template.swift");
const MAX_BATCH_SIZE = 2000;

export interface FillColor {
  r: number;
  g: number;
  b: number;
}

export interface BatchTestItem {
  name: string;
  svgPngPath: string;
  swiftCode: string;
  width: number;
  height: number;
  fillColor: FillColor;
  fillRule: string;
}

export interface BatchTestResult {
  name: string;
  score: number;
  status: "pass" | "fail" | "error";
  error?: string;
}

export function extractDominantFillColor(svgString: string): FillColor {
  const fillRegex = /fill\s*[:=]\s*"?([^";>\s]+)/gi;
  const colors: string[] = [];
  let match;
  while ((match = fillRegex.exec(svgString)) !== null) {
    const c = match[1]!.toLowerCase();
    if (c !== "none" && c !== "white" && c !== "#fff" && c !== "#ffffff" && c !== "currentcolor") {
      colors.push(c);
    }
  }
  for (const c of colors) {
    if (c === "black" || c === "#000" || c === "#000000") continue;
    if (c.startsWith("#")) {
      const hex = c.slice(1);
      if (hex.length === 3)
        return {
          r: parseInt(hex[0]! + hex[0]!, 16) / 255,
          g: parseInt(hex[1]! + hex[1]!, 16) / 255,
          b: parseInt(hex[2]! + hex[2]!, 16) / 255,
        };
      if (hex.length === 6)
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
        };
    }
  }
  return { r: 0, g: 0, b: 0 };
}

export function detectFillRule(svgString: string): string {
  if (/fill-?rule\s*[:=]\s*"?evenodd/i.test(svgString)) return ".evenOdd";
  return ".winding";
}

function toBinaryMask(png: PNG): PNG {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.width * png.height; i++) {
    const o = i * 4;
    const isContent =
      png.data[o + 3]! > 128 && (png.data[o]! < 240 || png.data[o + 1]! < 240 || png.data[o + 2]! < 240);
    out.data[o] = out.data[o + 1] = out.data[o + 2] = isContent ? 0 : 255;
    out.data[o + 3] = 255;
  }
  return out;
}

function compareImages(svgPngPath: string, swiftPngPath: string, diffPath: string, threshold: number): number {
  const svgImg = PNG.sync.read(readFileSync(svgPngPath));
  const swiftImg = PNG.sync.read(readFileSync(swiftPngPath));
  const svgMask = toBinaryMask(svgImg);
  const swiftMask = toBinaryMask(swiftImg);
  if (svgMask.width !== swiftMask.width || svgMask.height !== swiftMask.height) {
    throw new Error(
      `Dimension mismatch: SVG ${svgMask.width}x${svgMask.height} vs Swift ${swiftMask.width}x${swiftMask.height}`,
    );
  }
  const diff = new PNG({ width: svgMask.width, height: svgMask.height });
  const numDiff = pixelmatch(svgMask.data, swiftMask.data, diff.data, svgMask.width, svgMask.height, {
    threshold: 0.1,
  });
  const total = svgMask.width * svgMask.height;
  const score = ((total - numDiff) / total) * 100;
  // Only write diff PNG for failures (saves significant I/O)
  if (score < threshold) {
    writeFileSync(diffPath, PNG.sync.write(diff));
  }
  return score;
}

function generateBatchSwift(shim: string, items: BatchTestItem[], startIndex: number): string {
  const shapeDefs = items.map((item) => item.swiftCode).join("\n\n");
  const entries = items.map((_, i) => `    { rect in S${startIndex + i}().path(in: rect) }`).join(",\n");

  return `${shim}

${shapeDefs}

// --- Batch Renderer ---
struct _Task: Decodable {
    let index: Int
    let width: Int
    let height: Int
    let fillRule: String
    let fillR: Double
    let fillG: Double
    let fillB: Double
    let output: String
}

let _data = try! Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let _tasks = try! JSONDecoder().decode([_Task].self, from: _data)
let _cs = CGColorSpaceCreateDeviceRGB()

let _fns: [(CGRect) -> Path] = [
${entries}
]

for t in _tasks {
    guard t.index >= 0 && t.index < _fns.count else { continue }
    let sz = CGSize(width: t.width, height: t.height)
    let r = CGRect(origin: .zero, size: sz)
    let p = _fns[t.index](r)
    guard let ctx = CGContext(data: nil, width: t.width, height: t.height, bitsPerComponent: 8, bytesPerRow: t.width * 4, space: _cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
    ctx.setFillColor(red: 1, green: 1, blue: 1, alpha: 1)
    ctx.fill(r)
    ctx.translateBy(x: 0, y: CGFloat(t.height))
    ctx.scaleBy(x: 1, y: -1)
    ctx.addPath(p.cgPath)
    ctx.setFillColor(red: t.fillR, green: t.fillG, blue: t.fillB, alpha: 1)
    ctx.fillPath(using: t.fillRule == ".evenOdd" ? .evenOdd : .winding)
    guard let img = ctx.makeImage() else { continue }
    let rep = NSBitmapImageRep(cgImage: img)
    guard let png = rep.representation(using: .png, properties: [:]) else { continue }
    try? png.write(to: URL(fileURLWithPath: t.output))
}
`;
}

export async function runBatchVisualTest(
  items: BatchTestItem[],
  rendersDir: string,
  threshold: number,
): Promise<BatchTestResult[]> {
  if (items.length === 0) return [];

  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  const shimEnd = template.indexOf("// --- Generated SwiftUI Shape ---");
  const shim = template.substring(0, shimEnd).trim();

  // Split into batches
  const batches: { items: BatchTestItem[]; startIndex: number }[] = [];
  for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
    batches.push({ items: items.slice(i, i + MAX_BATCH_SIZE), startIndex: i });
  }

  // --- Binary caching (single-batch only) ---
  const cacheDir = join(rendersDir, ".cache");
  mkdirSync(cacheDir, { recursive: true });

  const canCache = batches.length === 1;
  let swiftHash = "";

  if (canCache) {
    const h = createHash("sha256");
    h.update(shim);
    for (const item of items) h.update(item.swiftCode);
    swiftHash = h.digest("hex").slice(0, 16);
  }

  const cachedBinPath = join(cacheDir, "batch-bin");
  const cachedHashPath = join(cacheDir, "batch-hash");

  let binPath = "";
  let tasksPath = "";
  const tempFiles: string[] = [];

  try {
    let binaryCached = false;

    if (canCache) {
      try {
        const storedHash = readFileSync(cachedHashPath, "utf-8").trim();
        if (storedHash === swiftHash && existsSync(cachedBinPath)) {
          binPath = cachedBinPath;
          binaryCached = true;
        }
      } catch {}
    }

    if (!binaryCached) {
      // Generate Swift source and compile
      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b]!;
        const src = generateBatchSwift(shim, batch.items, batch.startIndex);
        const id = `svg-vt-batch-${Date.now()}-${b}`;
        const srcPath = join(tmpdir(), `${id}.swift`);
        tempFiles.push(srcPath);

        writeFileSync(srcPath, src);

        if (canCache) {
          binPath = cachedBinPath;
        } else {
          binPath = join(tmpdir(), id);
          tempFiles.push(binPath);
        }

        console.log(`  Compiling ${batches.length} batch(es) (${items.length} shapes)...`);
        const t0 = Date.now();
        await exec(`swiftc -framework AppKit "${srcPath}" -o "${binPath}"`, {
          timeout: 600_000,
          maxBuffer: 50 * 1024 * 1024,
        });
        console.log(`  Compiled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

        if (canCache) {
          writeFileSync(cachedHashPath, swiftHash);
        }
      }
    } else {
      console.log("  Using cached batch renderer (converter unchanged)");
    }

    // --- Render Swift PNGs ---
    // Check which Swift PNGs need rendering
    const renderTasks: { index: number; item: BatchTestItem }[] = [];
    for (let i = 0; i < items.length; i++) {
      const swiftPng = join(rendersDir, `${items[i]!.name}-swift.png`);
      if (!binaryCached || !existsSync(swiftPng)) {
        renderTasks.push({ index: i, item: items[i]! });
      }
    }

    if (renderTasks.length > 0) {
      console.log(`  Rendering ${renderTasks.length} shape(s)...`);
      const t1 = Date.now();

      const id = `svg-vt-tasks-${Date.now()}`;
      tasksPath = join(tmpdir(), `${id}.json`);
      tempFiles.push(tasksPath);

      const tasks = renderTasks.map((rt) => ({
        index: rt.index,
        width: rt.item.width,
        height: rt.item.height,
        fillRule: rt.item.fillRule,
        fillR: rt.item.fillColor.r,
        fillG: rt.item.fillColor.g,
        fillB: rt.item.fillColor.b,
        output: join(rendersDir, `${rt.item.name}-swift.png`),
      }));
      writeFileSync(tasksPath, JSON.stringify(tasks));
      await exec(`"${binPath}" "${tasksPath}"`, {
        timeout: 600_000,
        maxBuffer: 50 * 1024 * 1024,
      });
      console.log(`  Rendered in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    } else {
      console.log("  All Swift PNGs cached, skipping render");
    }
  } finally {
    for (const f of tempFiles) {
      try { unlinkSync(f); } catch {}
    }
  }

  // Compare
  const t2 = Date.now();
  const results: BatchTestResult[] = [];
  for (const item of items) {
    const swiftPng = join(rendersDir, `${item.name}-swift.png`);
    const diffPng = join(rendersDir, `${item.name}-diff.png`);
    try {
      const score = compareImages(item.svgPngPath, swiftPng, diffPng, threshold);
      results.push({
        name: item.name,
        score: Math.round(score * 100) / 100,
        status: score >= threshold ? "pass" : "fail",
      });
    } catch (err) {
      results.push({
        name: item.name,
        score: 0,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  console.log(`  Compared in ${((Date.now() - t2) / 1000).toFixed(1)}s`);

  return results;
}
