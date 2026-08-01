/** Compile each generated declaration once, render exact document times, and compare every lossless RGBA frame. */
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ExpectedOutputMode } from "../visual-tests/manifest";
import { parseBackground } from "../visual-tests/manifest";
import { comparePngFiles, type RgbaMetrics, type RgbaTolerance } from "../visual-tests/rgba-compare";

const execFile = promisify(execFileCallback);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPPORT_PATH = resolve(__dirname, "../visual-tests/swiftui-renderer-support.swift");
const SWIFT_RENDERER_VERSION = "temporal-swiftui-srgb-v1";

export interface AnimationBatchFrame {
  index: number;
  timeMicroseconds: number;
  stem: string;
  referencePath: string;
}

export interface AnimationBatchItem {
  name: string;
  swiftCode: string;
  swiftTypeName: string;
  width: number;
  height: number;
  scale: number;
  background: string | null;
  fonts: string[];
  expectedMode: ExpectedOutputMode;
  tolerance: RgbaTolerance;
  frames: AnimationBatchFrame[];
}

export interface AnimationFrameResult {
  fixture: string;
  frameIndex: number;
  timeMicroseconds: number;
  status: "pass" | "fail" | "error";
  score: number;
  metrics?: RgbaMetrics;
  referencePath: string;
  swiftPath: string;
  diffPath: string;
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
  return JSON.stringify(value).replaceAll("/", "/");
}

function generatedSource(support: string, items: AnimationBatchItem[]): string {
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
        fputs("SwiftUI temporal render failed: \\(error)\\n", stderr)
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

function framePaths(rendersDir: string, fixture: string, stem: string) {
  const framesDirectory = join(rendersDir, fixture, "frames");
  return {
    framesDirectory,
    swiftPath: join(framesDirectory, `${stem}-swift.png`),
    diffPath: join(framesDirectory, `${stem}-diff.png`),
    receiptPath: join(framesDirectory, `${stem}-time.txt`),
  };
}

export async function runAnimationBatch(
  items: AnimationBatchItem[],
  rendersDir: string,
  fresh = false,
): Promise<AnimationFrameResult[]> {
  if (items.length === 0) return [];
  const support = readFileSync(SUPPORT_PATH, "utf8");
  const source = generatedSource(support, items);
  const sourceHash = hash(source).slice(0, 20);
  const cacheDirectory = join(rendersDir, ".cache");
  const cachePath = join(rendersDir, ".swift-frame-cache.json");
  mkdirSync(cacheDirectory, { recursive: true });
  let cache: Record<string, SwiftRenderCacheEntry> = {};
  try {
    cache = JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {}

  const binaryPath = join(cacheDirectory, `swiftui-animation-${sourceHash}`);
  const temporaryFiles: string[] = [];
  let renderingError: string | undefined;
  try {
    if (fresh || !existsSync(binaryPath)) {
      const sourceDirectory = join(tmpdir(), `svg-swiftui-animation-${sourceHash}`);
      mkdirSync(sourceDirectory, { recursive: true });
      const sourcePath = join(sourceDirectory, "main.swift");
      writeFileSync(sourcePath, source);
      temporaryFiles.push(sourcePath);
      console.log(`  Compiling ${items.length} temporal SwiftUI declaration(s)...`);
      try {
        await execFile(
          "xcrun",
          ["swiftc", "-module-cache-path", join(cacheDirectory, "module-cache"), sourcePath, "-o", binaryPath],
          { timeout: 900_000, maxBuffer: 100 * 1024 * 1024 },
        );
      } catch (error) {
        throw new Error(`Generated temporal SwiftUI compilation failed.\n${compilerFailure(error)}`);
      }
    } else {
      console.log(`  Using cached temporal SwiftUI renderer for ${items.length} fixture(s)`);
    }

    const tasks: object[] = [];
    const pending: { cacheKey: string; itemHash: string }[] = [];
    for (const [itemIndex, item] of items.entries()) {
      for (const frame of item.frames) {
        const paths = framePaths(rendersDir, item.name, frame.stem);
        mkdirSync(paths.framesDirectory, { recursive: true });
        const cacheKey = `${item.name}/${frame.stem}`;
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
            timeMicroseconds: frame.timeMicroseconds,
          }),
          ...item.fonts.map((font) => readFileSync(resolve(__dirname, font))),
        );
        if (
          !fresh &&
          cache[cacheKey]?.hash === itemHash &&
          existsSync(paths.swiftPath) &&
          existsSync(paths.receiptPath) &&
          readFileSync(paths.receiptPath, "utf8") === String(frame.timeMicroseconds)
        )
          continue;
        const [backgroundR, backgroundG, backgroundB, backgroundA] = parseBackground(item.background);
        tasks.push({
          index: itemIndex,
          width: item.width,
          height: item.height,
          scale: item.scale,
          backgroundR,
          backgroundG,
          backgroundB,
          backgroundA,
          fonts: item.fonts.map((font) => resolve(__dirname, font)),
          output: paths.swiftPath,
          timeMicroseconds: frame.timeMicroseconds,
          timeReceipt: paths.receiptPath,
        });
        pending.push({ cacheKey, itemHash });
      }
    }

    if (tasks.length > 0) {
      const tasksPath = join(tmpdir(), `svg-swiftui-animation-tasks-${sourceHash}-${Date.now()}.json`);
      temporaryFiles.push(tasksPath);
      writeFileSync(tasksPath, JSON.stringify(tasks));
      console.log(`  Rendering ${tasks.length} SwiftUI frame(s) at explicit document times...`);
      try {
        await execFile(binaryPath, [tasksPath], { timeout: 900_000, maxBuffer: 100 * 1024 * 1024 });
      } catch (error) {
        throw new Error(`Generated temporal SwiftUI renderer failed.\n${compilerFailure(error)}`);
      }
      for (const { cacheKey, itemHash } of pending) cache[cacheKey] = { hash: itemHash };
    } else {
      console.log("  All SwiftUI temporal frames are valid cache hits");
    }
    writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  } catch (error) {
    renderingError = error instanceof Error ? error.message : String(error);
  } finally {
    for (const path of temporaryFiles) {
      try {
        unlinkSync(path);
      } catch {}
    }
  }

  const results: AnimationFrameResult[] = [];
  for (const item of items) {
    for (const frame of item.frames) {
      const paths = framePaths(rendersDir, item.name, frame.stem);
      if (renderingError) {
        results.push({
          fixture: item.name,
          frameIndex: frame.index,
          timeMicroseconds: frame.timeMicroseconds,
          status: "error",
          score: 0,
          error: renderingError,
          referencePath: frame.referencePath,
          swiftPath: paths.swiftPath,
          diffPath: paths.diffPath,
        });
        continue;
      }
      try {
        const receipt = readFileSync(paths.receiptPath, "utf8");
        if (receipt !== String(frame.timeMicroseconds))
          throw new Error(`Swift time receipt was ${receipt}; expected ${frame.timeMicroseconds}`);
        const comparison = comparePngFiles(frame.referencePath, paths.swiftPath, paths.diffPath, item.tolerance);
        if (comparison.passed && existsSync(paths.diffPath)) unlinkSync(paths.diffPath);
        results.push({
          fixture: item.name,
          frameIndex: frame.index,
          timeMicroseconds: frame.timeMicroseconds,
          status: comparison.passed ? "pass" : "fail",
          score: Math.round((100 - comparison.metrics.outsidePercent) * 100) / 100,
          metrics: comparison.metrics,
          referencePath: frame.referencePath,
          swiftPath: paths.swiftPath,
          diffPath: paths.diffPath,
        });
      } catch (error) {
        results.push({
          fixture: item.name,
          frameIndex: frame.index,
          timeMicroseconds: frame.timeMicroseconds,
          status: "error",
          score: 0,
          error: error instanceof Error ? error.message : String(error),
          referencePath: frame.referencePath,
          swiftPath: paths.swiftPath,
          diffPath: paths.diffPath,
        });
      }
    }
  }
  return results;
}
