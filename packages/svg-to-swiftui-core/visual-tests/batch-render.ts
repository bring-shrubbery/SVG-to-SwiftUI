/** Compile generated declarations with real SwiftUI, render exact RGBA canvases, and compare them to resvg references. */
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ExpectedOutputMode } from "./manifest";
import { parseBackground } from "./manifest";
import { comparePngFiles, type RgbaMetrics, type RgbaTolerance } from "./rgba-compare";

const execFile = promisify(execFileCallback);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPPORT_PATH = resolve(__dirname, "swiftui-renderer-support.swift");
// Keep each generated Swift source small enough for slower GitHub macOS runners.
// Swift type-checking this many independent View declarations is superlinear;
// one monolithic corpus can exceed the per-process timeout without a code error.
const MAX_BATCH_SIZE = 500;
const SWIFT_RENDERER_VERSION = "real-swiftui-srgb-v2";

export interface BatchTestItem {
  name: string;
  svgPngPath: string;
  swiftCode: string;
  swiftTypeName: string;
  width: number;
  height: number;
  scale: number;
  background: string | null;
  fonts: string[];
  expectedMode: ExpectedOutputMode;
  tags: string[];
  tolerance: RgbaTolerance;
}

export interface BatchTestResult {
  name: string;
  score: number;
  status: "pass" | "fail" | "error";
  metrics?: RgbaMetrics;
  referencePath?: string;
  swiftPath?: string;
  diffPath?: string;
  error?: string;
}

interface SwiftRenderCacheEntry {
  hash: string;
}

function hash(...values: (string | Buffer)[]): string {
  const digest = createHash("sha256");
  for (const value of values) digest.update(value);
  return digest.digest("hex");
}

function swiftString(value: string): string {
  return JSON.stringify(value).replaceAll("\\/", "/");
}

function generatedSource(support: string, items: BatchTestItem[]): string {
  const declarations = items
    .map(
      (item) =>
        `#sourceLocation(file: ${swiftString(`${item.name}.generated.swift`)}, line: 1)\n${item.swiftCode}\n#sourceLocation()`,
    )
    .join("\n\n");
  const factories = items
    .map((item) =>
      item.expectedMode === "shape"
        ? `    { AnyView(${item.swiftTypeName}().fill(Color.black)) }`
        : `    { AnyView(${item.swiftTypeName}()) }`,
    )
    .join(",\n");
  return `${support}

${declarations}

let _visualFactories: [() -> AnyView] = [
${factories}
]
let _visualTaskData = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let _visualTasks = try JSONDecoder().decode([_VisualTask].self, from: _visualTaskData)
Task { @MainActor in
    do {
        for task in _visualTasks {
            try _renderVisualTask(task, factories: _visualFactories)
        }
        exit(0)
    } catch {
        fputs("SwiftUI visual render failed: \\(error)\\n", stderr)
        exit(1)
    }
}
RunLoop.main.run()
`;
}

function compilerFailure(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const typed = error as { stderr?: string; stdout?: string; message?: string };
    return [typed.message, typed.stdout, typed.stderr].filter(Boolean).join("\n").trim();
  }
  return String(error);
}

async function compileAndRenderBatch(
  support: string,
  items: BatchTestItem[],
  rendersDir: string,
  cache: Record<string, SwiftRenderCacheEntry>,
  fresh: boolean,
): Promise<void> {
  const source = generatedSource(support, items);
  const sourceHash = hash(source).slice(0, 20);
  const cacheDir = join(rendersDir, ".cache");
  mkdirSync(cacheDir, { recursive: true });
  const binaryPath = join(cacheDir, `swiftui-${sourceHash}`);
  const temporaryFiles: string[] = [];

  try {
    if (fresh || !existsSync(binaryPath)) {
      const sourceDirectory = join(tmpdir(), `svg-swiftui-${sourceHash}`);
      mkdirSync(sourceDirectory, { recursive: true });
      const sourcePath = join(sourceDirectory, "main.swift");
      writeFileSync(sourcePath, source);
      temporaryFiles.push(sourcePath);
      console.log(`  Compiling ${items.length} generated SwiftUI view(s)...`);
      const started = Date.now();
      try {
        await execFile("xcrun", ["swiftc", sourcePath, "-o", binaryPath], {
          timeout: 900_000,
          maxBuffer: 100 * 1024 * 1024,
        });
      } catch (error) {
        throw new Error(
          `Generated SwiftUI compilation failed. Compiler locations name the fixture.\n${compilerFailure(error)}`,
        );
      }
      console.log(`  Compiled in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } else {
      console.log(`  Using cached SwiftUI renderer for ${items.length} fixture(s)`);
    }

    const renderTasks: object[] = [];
    const pending: { item: BatchTestItem; itemHash: string }[] = [];
    for (const [index, item] of items.entries()) {
      const output = join(rendersDir, `${item.name}-swift.png`);
      mkdirSync(dirname(output), { recursive: true });
      const itemHash = hash(
        SWIFT_RENDERER_VERSION,
        support,
        item.swiftCode,
        JSON.stringify({
          width: item.width,
          height: item.height,
          scale: item.scale,
          background: item.background,
          fonts: item.fonts,
          expectedMode: item.expectedMode,
        }),
        ...item.fonts.map((font) => readFileSync(resolve(__dirname, font))),
      );
      if (!fresh && cache[item.name]?.hash === itemHash && existsSync(output)) continue;
      const [backgroundR, backgroundG, backgroundB, backgroundA] = parseBackground(item.background);
      renderTasks.push({
        index,
        width: item.width,
        height: item.height,
        scale: item.scale,
        backgroundR,
        backgroundG,
        backgroundB,
        backgroundA,
        fonts: item.fonts.map((font) => resolve(__dirname, font)),
        output,
      });
      pending.push({ item, itemHash });
    }

    if (renderTasks.length === 0) {
      console.log("  All SwiftUI PNGs are valid cache hits");
      return;
    }
    const tasksPath = join(tmpdir(), `svg-swiftui-tasks-${sourceHash}-${Date.now()}.json`);
    temporaryFiles.push(tasksPath);
    writeFileSync(tasksPath, JSON.stringify(renderTasks));
    console.log(`  Rendering ${renderTasks.length} SwiftUI view(s) at exact size and scale...`);
    const started = Date.now();
    try {
      await execFile(binaryPath, [tasksPath], { timeout: 900_000, maxBuffer: 100 * 1024 * 1024 });
    } catch (error) {
      throw new Error(`Generated SwiftUI renderer failed.\n${compilerFailure(error)}`);
    }
    for (const { item, itemHash } of pending) cache[item.name] = { hash: itemHash };
    console.log(`  Rendered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } finally {
    for (const path of temporaryFiles) {
      try {
        unlinkSync(path);
      } catch {}
    }
  }
}

export async function runBatchVisualTest(
  items: BatchTestItem[],
  rendersDir: string,
  fresh = false,
): Promise<BatchTestResult[]> {
  if (items.length === 0) return [];
  const support = readFileSync(SUPPORT_PATH, "utf8");
  const swiftCachePath = join(rendersDir, ".swift-render-cache.json");
  let swiftCache: Record<string, SwiftRenderCacheEntry> = {};
  if (!fresh) {
    try {
      swiftCache = JSON.parse(readFileSync(swiftCachePath, "utf8"));
    } catch {}
  }

  const renderingErrors = new Map<string, string>();
  for (let start = 0; start < items.length; start += MAX_BATCH_SIZE) {
    const batch = items.slice(start, start + MAX_BATCH_SIZE);
    try {
      await compileAndRenderBatch(support, batch, rendersDir, swiftCache, fresh);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const item of batch) renderingErrors.set(item.name, message);
    }
  }
  writeFileSync(swiftCachePath, JSON.stringify(swiftCache, null, 2));

  const results: BatchTestResult[] = [];
  const started = Date.now();
  for (const item of items) {
    const swiftPath = join(rendersDir, `${item.name}-swift.png`);
    const diffPath = join(rendersDir, `${item.name}-diff.png`);
    const paths = { referencePath: item.svgPngPath, swiftPath, diffPath };
    const renderingError = renderingErrors.get(item.name);
    if (renderingError) {
      results.push({ name: item.name, score: 0, status: "error", error: renderingError, ...paths });
      continue;
    }
    try {
      const comparison = comparePngFiles(item.svgPngPath, swiftPath, diffPath, item.tolerance);
      if (comparison.passed && existsSync(diffPath)) unlinkSync(diffPath);
      results.push({
        name: item.name,
        score: Math.round((100 - comparison.metrics.outsidePercent) * 100) / 100,
        status: comparison.passed ? "pass" : "fail",
        metrics: comparison.metrics,
        ...paths,
      });
    } catch (error) {
      results.push({
        name: item.name,
        score: 0,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        ...paths,
      });
    }
  }
  console.log(`  Compared full RGBA in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return results;
}
