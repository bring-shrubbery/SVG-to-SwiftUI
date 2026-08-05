import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import type { LoadedAnimationFixture } from "./manifest";
import { loadAnimationBenchmarkSuites } from "./manifest";

const TESTS_DIR = import.meta.dir;
const REPOSITORY_ROOT = resolve(TESTS_DIR, "../../..");
const RENDERS_DIR = resolve(TESTS_DIR, "renders");
const CACHE_DIR = resolve(RENDERS_DIR, ".cache");
const SOURCE_PATH = resolve(TESTS_DIR, "gif-encoder.swift");
const BINARY_PATH = resolve(CACHE_DIR, "animation-gif-encoder");
const FRAME_COUNT = 16;
const FRAMES_PER_SECOND = 16;
const CANVAS_WIDTH = 432;
const CANVAS_HEIGHT = 288;
const CELL_SIZE = 112;
const GAP = 16;
const PADDING_X = 32;
const PADDING_Y = 24;
const PALETTE = [
  [56, 189, 248],
  [167, 139, 250],
  [244, 114, 182],
  [251, 146, 60],
  [74, 222, 128],
  [250, 204, 21],
] as const;

function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function ensureEncoder(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const source = readFileSync(SOURCE_PATH);
  const stampPath = `${BINARY_PATH}.sha256`;
  const expected = hash(Buffer.concat([Buffer.from("spinner-showcase-gif-v1"), source]));
  let actual = "";
  try {
    actual = readFileSync(stampPath, "utf8");
  } catch {}
  if (existsSync(BINARY_PATH) && actual === expected) return;
  execFileSync(
    "xcrun",
    [
      "swiftc",
      "-module-cache-path",
      resolve(CACHE_DIR, "module-cache"),
      SOURCE_PATH,
      "-framework",
      "AppKit",
      "-framework",
      "ImageIO",
      "-framework",
      "UniformTypeIdentifiers",
      "-o",
      BINARY_PATH,
    ],
    { stdio: "pipe" },
  );
  writeFileSync(stampPath, expected);
}

function roundedRectContains(x: number, y: number, left: number, top: number, size: number, radius: number): boolean {
  const nearestX = Math.max(left + radius, Math.min(x, left + size - radius));
  const nearestY = Math.max(top + radius, Math.min(y, top + size - radius));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
}

function baseFrame(): PNG {
  const output = new PNG({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const offset = (y * CANVAS_WIDTH + x) * 4;
      const glow = Math.max(0, 1 - Math.hypot(x - CANVAS_WIDTH / 2, y - CANVAS_HEIGHT / 2) / 280);
      output.data[offset] = Math.round(6 + glow * 5);
      output.data[offset + 1] = Math.round(14 + glow * 12);
      output.data[offset + 2] = Math.round(28 + glow * 22);
      output.data[offset + 3] = 255;
    }
  }
  for (let index = 0; index < 6; index++) {
    const left = PADDING_X + (index % 3) * (CELL_SIZE + GAP);
    const top = PADDING_Y + Math.floor(index / 3) * (CELL_SIZE + GAP);
    for (let y = top; y < top + CELL_SIZE; y++) {
      for (let x = left; x < left + CELL_SIZE; x++) {
        if (!roundedRectContains(x, y, left, top, CELL_SIZE, 20)) continue;
        const offset = (y * CANVAS_WIDTH + x) * 4;
        output.data[offset] = 15;
        output.data[offset + 1] = 30;
        output.data[offset + 2] = 52;
      }
    }
  }
  return output;
}

function swiftFramePath(fixture: LoadedAnimationFixture, frameIndex: number): string {
  const frame = fixture.frames[Math.min(frameIndex, fixture.frames.length - 2)]!;
  return resolve(RENDERS_DIR, fixture.name, "frames", `${frame.stem}-swift.png`);
}

function compositeSpinner(output: PNG, input: PNG, index: number): void {
  const left = PADDING_X + (index % 3) * (CELL_SIZE + GAP) + (CELL_SIZE - input.width) / 2;
  const top = PADDING_Y + Math.floor(index / 3) * (CELL_SIZE + GAP) + (CELL_SIZE - input.height) / 2;
  const color = PALETTE[index]!;
  for (let y = 0; y < input.height; y++) {
    for (let x = 0; x < input.width; x++) {
      const sourceOffset = (y * input.width + x) * 4;
      const alpha = input.data[sourceOffset + 3]! / 255;
      if (alpha === 0) continue;
      const targetOffset = ((top + y) * output.width + left + x) * 4;
      output.data[targetOffset] = Math.round(color[0] * alpha + output.data[targetOffset]! * (1 - alpha));
      output.data[targetOffset + 1] = Math.round(color[1] * alpha + output.data[targetOffset + 1]! * (1 - alpha));
      output.data[targetOffset + 2] = Math.round(color[2] * alpha + output.data[targetOffset + 2]! * (1 - alpha));
    }
  }
}

export function generateSpinnerShowcaseGif(fixtures: LoadedAnimationFixture[]): string | undefined {
  const suite = loadAnimationBenchmarkSuites().find((candidate) => candidate.id === "svg-spinners");
  if (!suite) return undefined;
  const selected = suite.fixtures.map((name) => fixtures.find((fixture) => fixture.name === name));
  if (selected.some((fixture) => !fixture)) return undefined;
  const showcaseFixtures = selected as LoadedAnimationFixture[];
  const framesDirectory = resolve(RENDERS_DIR, "spinner-showcase", "frames");
  mkdirSync(framesDirectory, { recursive: true });
  const outputFrames = Array.from({ length: FRAME_COUNT }, (_, frameIndex) => {
    const output = baseFrame();
    showcaseFixtures.forEach((fixture, fixtureIndex) => {
      const path = swiftFramePath(fixture, frameIndex);
      if (!existsSync(path)) throw new Error(`Missing verified SwiftUI showcase frame: ${path}`);
      compositeSpinner(output, PNG.sync.read(readFileSync(path)), fixtureIndex);
    });
    const outputPath = resolve(framesDirectory, `${String(frameIndex).padStart(3, "0")}.png`);
    writeFileSync(outputPath, PNG.sync.write(output));
    return outputPath;
  });

  ensureEncoder();
  const output = resolve(RENDERS_DIR, "spinner-showcase", "svg-spinners-benchmark.gif");
  const taskPath = resolve(CACHE_DIR, "spinner-showcase-gif-task.json");
  writeFileSync(taskPath, JSON.stringify({ output, framesPerSecond: FRAMES_PER_SECOND, frames: outputFrames }));
  execFileSync(BINARY_PATH, [taskPath], { stdio: "pipe", timeout: 120_000 });
  copyFileSync(output, resolve(REPOSITORY_ROOT, "content/svg-spinners-benchmark.gif"));
  return output;
}
