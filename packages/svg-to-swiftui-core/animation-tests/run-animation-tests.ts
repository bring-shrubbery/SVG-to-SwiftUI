#!/usr/bin/env bun
/** Deterministic SVG animation conformance runner: seek, compile, render, and compare lossless RGBA frames. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { convertAsync } from "../src/index";
import type { ResolvedResource } from "../src/types";
import { outputMode, withPixelViewport } from "../visual-tests/manifest";
import { type AnimationBatchItem, type AnimationFrameResult, runAnimationBatch } from "./batch-render";
import {
  ANIMATION_FIXTURES_DIR,
  type LoadedAnimationFixture,
  loadAnimationFixtures,
  validateAnimationManifest,
} from "./manifest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(__dirname, "../../..");
const RENDERS_DIR = resolve(__dirname, "renders");
const CACHE_DIR = resolve(RENDERS_DIR, ".cache");
const REFERENCE_CACHE_PATH = resolve(RENDERS_DIR, ".reference-frame-cache.json");
const REFERENCE_RENDERER_SOURCE = resolve(__dirname, "webkit-animation-reference.swift");
const REFERENCE_RENDERER_BINARY = resolve(CACHE_DIR, "webkit-animation-reference");
const REFERENCE_RENDERER_VERSION = "webkit-explicit-smil-wa-time-v1";
const VIDEO_ENCODER_SOURCE = resolve(__dirname, "video-encoder.swift");
const VIDEO_ENCODER_BINARY = resolve(CACHE_DIR, "animation-video-encoder");

interface ReferenceCacheEntry {
  hash: string;
}

function hash(...values: (string | Buffer)[]): string {
  const digest = createHash("sha256");
  for (const value of values) digest.update(value);
  return digest.digest("hex");
}

function resourceMime(path: string): string | undefined {
  const extension = path.split(/[?#]/, 1)[0]!.split(".").pop()?.toLowerCase();
  return extension === "png"
    ? "image/png"
    : extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "webp"
        ? "image/webp"
        : extension === "gif"
          ? "image/gif"
          : extension === "svg"
            ? "image/svg+xml"
            : extension === "ttf"
              ? "font/ttf"
              : extension === "otf"
                ? "font/otf"
                : extension === "woff"
                  ? "font/woff"
                  : extension === "woff2"
                    ? "font/woff2"
                    : undefined;
}

function collectFixtureResources(
  source: string,
  sourceURL: URL,
): { supplied: Record<string, ResolvedResource>; bytes: Buffer[] } {
  const supplied: Record<string, ResolvedResource> = {};
  const bytes: Buffer[] = [];
  const visited = new Set<string>();
  const visit = (document: string, documentURL: URL): void => {
    for (const match of document.matchAll(/<(?:image|feImage)\b[^>]*\b(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)) {
      const href = match[1]!;
      if (/^(?:data:|#)/i.test(href)) continue;
      const resourceURL = new URL(href, documentURL);
      const resourceBytes = readFileSync(fileURLToPath(resourceURL));
      const resource: ResolvedResource = {
        bytes: Uint8Array.from(resourceBytes),
        mimeType: resourceMime(resourceURL.pathname),
        canonicalURL: resourceURL.href,
      };
      supplied[href] ??= resource;
      supplied[resourceURL.href] = resource;
      if (visited.has(resourceURL.href)) continue;
      visited.add(resourceURL.href);
      bytes.push(resourceBytes);
      if (resource.mimeType === "image/svg+xml") visit(resourceBytes.toString("utf8"), resourceURL);
    }
  };
  visit(source, sourceURL);
  return { supplied, bytes };
}

function inlineFixtureImages(source: string, sourceURL: URL): string {
  return source.replace(
    /(<(?:image|feImage)\b[^>]*\b(?:href|xlink:href)\s*=\s*)(["'])([^"']+)\2/gi,
    (match, prefix: string, quote: string, href: string) => {
      if (/^(?:data:|#|https?:)/i.test(href)) return match;
      const resourceURL = new URL(href, sourceURL);
      const mimeType = resourceMime(resourceURL.pathname);
      if (!mimeType) return match;
      let bytes = readFileSync(fileURLToPath(resourceURL));
      if (mimeType === "image/svg+xml")
        bytes = Buffer.from(inlineFixtureImages(bytes.toString("utf8"), resourceURL), "utf8");
      return `${prefix}${quote}data:${mimeType};base64,${bytes.toString("base64")}${quote}`;
    },
  );
}

function inlineFixtureFonts(source: string, fixture: LoadedAnimationFixture): string {
  if (fixture.fonts.length === 0) return source;
  const rules = fixture.fonts.map((font, index) => {
    const path = resolve(__dirname, font);
    const mime = resourceMime(path);
    const family = (
      fixture.fontFamilies[index] ??
      fixture.fontFamilies[0] ??
      `AnimationFixtureFont${index}`
    ).replaceAll("'", "\\'");
    return `@font-face{font-family:'${family}';src:url(data:${mime};base64,${readFileSync(path).toString("base64")})}`;
  });
  return source.replace(/<svg\b([^>]*)>/i, (match) => `${match}<style>${rules.join("")}</style>`);
}

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function changedFixtureNames(): Set<string> {
  const paths = new Set<string>();
  for (const args of [
    ["diff", "--name-only", "origin/main...HEAD"],
    ["diff", "--name-only", "HEAD"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    try {
      const output = execFileSync("git", args, { cwd: REPOSITORY_ROOT, encoding: "utf8" });
      for (const line of output.split("\n")) if (line.trim()) paths.add(line.trim());
    } catch {}
  }
  const fixturePrefix = relative(REPOSITORY_ROOT, ANIMATION_FIXTURES_DIR).replaceAll("\\", "/");
  return new Set(
    [...paths]
      .map((path) => path.replaceAll("\\", "/"))
      .filter((path) => path.startsWith(`${fixturePrefix}/`) && path.endsWith(".svg"))
      .map((path) => path.slice(fixturePrefix.length + 1, -4)),
  );
}

function ensureReferenceRenderer(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const source = readFileSync(REFERENCE_RENDERER_SOURCE);
  const stampPath = `${REFERENCE_RENDERER_BINARY}.sha256`;
  const expectedHash = hash(REFERENCE_RENDERER_VERSION, source);
  let actualHash = "";
  try {
    actualHash = readFileSync(stampPath, "utf8");
  } catch {}
  if (existsSync(REFERENCE_RENDERER_BINARY) && actualHash === expectedHash) return;
  execFileSync(
    "xcrun",
    [
      "swiftc",
      "-module-cache-path",
      resolve(CACHE_DIR, "module-cache"),
      REFERENCE_RENDERER_SOURCE,
      "-framework",
      "WebKit",
      "-framework",
      "AppKit",
      "-o",
      REFERENCE_RENDERER_BINARY,
    ],
    { stdio: "pipe" },
  );
  writeFileSync(stampPath, expectedHash);
}

function ensureVideoEncoder(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const source = readFileSync(VIDEO_ENCODER_SOURCE);
  const stampPath = `${VIDEO_ENCODER_BINARY}.sha256`;
  const expectedHash = hash("animation-review-video-v1", source);
  let actualHash = "";
  try {
    actualHash = readFileSync(stampPath, "utf8");
  } catch {}
  if (existsSync(VIDEO_ENCODER_BINARY) && actualHash === expectedHash) return;
  execFileSync(
    "xcrun",
    [
      "swiftc",
      "-module-cache-path",
      resolve(CACHE_DIR, "module-cache"),
      VIDEO_ENCODER_SOURCE,
      "-framework",
      "AVFoundation",
      "-framework",
      "AppKit",
      "-o",
      VIDEO_ENCODER_BINARY,
    ],
    { stdio: "pipe" },
  );
  writeFileSync(stampPath, expectedHash);
}

function referencePath(fixture: LoadedAnimationFixture, stem: string): string {
  return resolve(RENDERS_DIR, fixture.name, "frames", `${stem}-svg.png`);
}

function sourceWithBackground(source: string, fixture: LoadedAnimationFixture): string {
  const sized = withPixelViewport(source, fixture.width, fixture.height);
  if (!fixture.background) return sized;
  return sized.replace(/<svg\b([^>]*)>/i, (match) => `${match}<style>:root{background:${fixture.background}}</style>`);
}

function renderReferenceFrames(fixture: LoadedAnimationFixture, source: string): void {
  ensureReferenceRenderer();
  const fixtureDirectory = resolve(RENDERS_DIR, fixture.name);
  const framesDirectory = resolve(fixtureDirectory, "frames");
  mkdirSync(framesDirectory, { recursive: true });
  const inputPath = resolve(CACHE_DIR, `${fixture.name}-${hash(source).slice(0, 12)}.svg`);
  const taskPath = resolve(CACHE_DIR, `${fixture.name}-reference-task.json`);
  writeFileSync(inputPath, sourceWithBackground(source, fixture));
  writeFileSync(
    taskPath,
    JSON.stringify({
      input: inputPath,
      width: fixture.width,
      height: fixture.height,
      pixelWidth: Math.round(fixture.width * fixture.scale),
      pixelHeight: Math.round(fixture.height * fixture.scale),
      frames: fixture.frames.map((frame) => ({
        timeMicroseconds: frame.timeMicroseconds,
        output: referencePath(fixture, frame.stem),
      })),
    }),
  );
  execFileSync(REFERENCE_RENDERER_BINARY, [taskPath], { stdio: "pipe", timeout: 120_000 });
}

function verifyDistinctReferenceFrames(fixture: LoadedAnimationFixture): void {
  if (!fixture.expectDistinctReferenceFrames) return;
  const hashes = fixture.frames.map((frame) => hash(readFileSync(referencePath(fixture, frame.stem))));
  if (new Set(hashes).size !== hashes.length)
    throw new Error(
      `Reference seek probe produced only ${new Set(hashes).size}/${hashes.length} distinct frame hashes`,
    );
}

function reviewSequence(fixture: LoadedAnimationFixture, paths: string[]): string[] {
  const videoFrameCount = Math.max(
    1,
    Math.round((fixture.timeline.durationMicroseconds * fixture.timeline.framesPerSecond) / 1_000_000),
  );
  return Array.from({ length: videoFrameCount + 1 }, (_, index) => {
    const time = Math.min(
      fixture.timeline.durationMicroseconds,
      Math.floor((index * 1_000_000) / fixture.timeline.framesPerSecond),
    );
    let nearest = 0;
    for (let frame = 1; frame < fixture.frames.length; frame++) {
      if (
        Math.abs(fixture.frames[frame]!.timeMicroseconds - time) <
        Math.abs(fixture.frames[nearest]!.timeMicroseconds - time)
      )
        nearest = frame;
    }
    return paths[nearest]!;
  });
}

function encodeReviewVideo(
  output: string,
  width: number,
  height: number,
  framesPerSecond: number,
  frames: string[],
): void {
  ensureVideoEncoder();
  const taskPath = resolve(CACHE_DIR, `${hash(output).slice(0, 12)}-video-task.json`);
  writeFileSync(taskPath, JSON.stringify({ output, width, height, framesPerSecond, frames }));
  execFileSync(VIDEO_ENCODER_BINARY, [taskPath], { stdio: "pipe", timeout: 120_000 });
}

function sideBySideFrame(reference: string, swift: string, output: string): void {
  const left = PNG.sync.read(readFileSync(reference));
  const right = PNG.sync.read(readFileSync(swift));
  if (left.width !== right.width || left.height !== right.height)
    throw new Error(`Cannot compose review frame with mismatched dimensions: ${reference} and ${swift}`);
  const gap = 8;
  const result = new PNG({ width: left.width * 2 + gap, height: left.height });
  result.data.fill(255);
  PNG.bitblt(left, result, 0, 0, left.width, left.height, 0, 0);
  PNG.bitblt(right, result, 0, 0, right.width, right.height, left.width + gap, 0);
  writeFileSync(output, PNG.sync.write(result));
}

function generateReviewVideos(fixtures: LoadedAnimationFixture[], comparisonItems: AnimationBatchItem[]): void {
  const compared = new Map(comparisonItems.map((item) => [item.name, item]));
  for (const fixture of fixtures) {
    const fixtureDirectory = resolve(RENDERS_DIR, fixture.name);
    const pixelWidth = Math.round(fixture.width * fixture.scale);
    const pixelHeight = Math.round(fixture.height * fixture.scale);
    const references = fixture.frames.map((frame) => referencePath(fixture, frame.stem));
    encodeReviewVideo(
      resolve(fixtureDirectory, "reference.mp4"),
      pixelWidth,
      pixelHeight,
      fixture.timeline.framesPerSecond,
      reviewSequence(fixture, references),
    );
    const item = compared.get(fixture.name);
    if (!item) continue;
    const swiftFrames = fixture.frames.map((frame) => resolve(fixtureDirectory, "frames", `${frame.stem}-swift.png`));
    encodeReviewVideo(
      resolve(fixtureDirectory, "swiftui.mp4"),
      pixelWidth,
      pixelHeight,
      fixture.timeline.framesPerSecond,
      reviewSequence(fixture, swiftFrames),
    );
    const sideBySide = fixture.frames.map((frame, index) => {
      const output = resolve(fixtureDirectory, "frames", `${frame.stem}-side-by-side.png`);
      sideBySideFrame(references[index]!, swiftFrames[index]!, output);
      return output;
    });
    encodeReviewVideo(
      resolve(fixtureDirectory, "side-by-side.mp4"),
      pixelWidth * 2 + 8,
      pixelHeight,
      fixture.timeline.framesPerSecond,
      reviewSequence(fixture, sideBySide),
    );
  }
}

function formatMetrics(result: AnimationFrameResult): string {
  if (!result.metrics) return result.error ?? "unknown error";
  return [
    `outside=${result.metrics.outsidePercent.toFixed(3)}%`,
    `meanRGB=${result.metrics.meanRgbError.toFixed(3)}`,
    `meanA=${result.metrics.meanAlphaError.toFixed(3)}`,
    `max=${result.metrics.maxChannelError}`,
  ].join(" ");
}

function worstFrame(
  results: AnimationFrameResult[],
  value: (result: AnimationFrameResult) => number | undefined,
): AnimationFrameResult | undefined {
  let worst: AnimationFrameResult | undefined;
  let worstValue = Number.NEGATIVE_INFINITY;
  for (const result of results) {
    const candidate = value(result);
    if (candidate !== undefined && candidate > worstValue) {
      worst = result;
      worstValue = candidate;
    }
  }
  return worst;
}

function frameSummary(result: AnimationFrameResult | undefined): object | null {
  return result
    ? {
        fixture: result.fixture,
        frameIndex: result.frameIndex,
        timeMicroseconds: result.timeMicroseconds,
        metrics: result.metrics,
      }
    : null;
}

async function main(): Promise<void> {
  const manifestErrors = validateAnimationManifest();
  if (manifestErrors.length > 0) {
    console.error(`Animation fixture manifest failed with ${manifestErrors.length} error(s):`);
    for (const error of manifestErrors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const fresh = process.argv.includes("--fresh");
  const videos = process.argv.includes("--videos");
  const requestedFixture = optionValue("--fixture");
  const requestedTag = optionValue("--tag");
  const changed = process.argv.includes("--changed") ? changedFixtureNames() : undefined;
  const fixtures = loadAnimationFixtures().filter(
    (fixture) =>
      (!requestedFixture || fixture.name.includes(requestedFixture)) &&
      (!requestedTag || fixture.tags.includes(requestedTag)) &&
      (!changed || changed.has(fixture.name)),
  );
  if (fixtures.length === 0) {
    console.error("No animation fixtures matched the requested fixture/tag/changed filters.");
    process.exit(1);
  }
  const frameCount = fixtures.reduce((total, fixture) => total + fixture.frames.length, 0);
  if (process.platform !== "darwin") {
    console.log(
      `Animation manifest valid (${fixtures.length} fixtures, ${frameCount} frames selected); rendering requires macOS.`,
    );
    return;
  }

  mkdirSync(RENDERS_DIR, { recursive: true });
  let referenceCache: Record<string, ReferenceCacheEntry> = {};
  try {
    referenceCache = JSON.parse(readFileSync(REFERENCE_CACHE_PATH, "utf8"));
  } catch {}

  console.log(`Processing ${fixtures.length} animation fixture(s), ${frameCount} exact frame time(s)...`);
  const comparisonItems: AnimationBatchItem[] = [];
  const preparationErrors: { fixture: string; error: string }[] = [];
  let referenceProbesPassed = 0;
  for (const fixture of fixtures) {
    try {
      const source = readFileSync(fixture.sourcePath, "utf8");
      const sourceURL = pathToFileURL(fixture.sourcePath);
      const fixtureResources = collectFixtureResources(source, sourceURL);
      const referenceSource = inlineFixtureFonts(inlineFixtureImages(source, sourceURL), fixture);
      const referenceHash = hash(
        REFERENCE_RENDERER_VERSION,
        readFileSync(REFERENCE_RENDERER_SOURCE),
        source,
        JSON.stringify({
          width: fixture.width,
          height: fixture.height,
          scale: fixture.scale,
          background: fixture.background,
          referenceBackend: fixture.referenceBackend,
          frames: fixture.frames,
        }),
        ...fixture.fonts.map((font) => readFileSync(resolve(__dirname, font))),
        ...fixtureResources.bytes,
      );
      const allFramesExist = fixture.frames.every((frame) => existsSync(referencePath(fixture, frame.stem)));
      if (fresh || referenceCache[fixture.name]?.hash !== referenceHash || !allFramesExist) {
        renderReferenceFrames(fixture, referenceSource);
        referenceCache[fixture.name] = { hash: referenceHash };
      }
      verifyDistinctReferenceFrames(fixture);
      if (fixture.mode === "reference-probe") referenceProbesPassed++;

      if (fixture.mode === "comparison") {
        const expectedMode = fixture.expectedMode!;
        const swiftTypeName = `AnimationFixture${comparisonItems.length}`;
        const swiftCode = await convertAsync(source, {
          structName: swiftTypeName,
          precision: 5,
          preserveColors: expectedMode === "view",
          fonts: {
            availableFamilies: fixture.fontFamilies,
            fallbackFamily: fixture.fontFamilies[0] ?? "Helvetica",
          },
          resources: {
            baseURL: sourceURL.href,
            supplied: fixtureResources.supplied,
          },
        });
        const actualMode = outputMode(swiftCode);
        if (actualMode !== expectedMode)
          throw new Error(`Manifest expects ${expectedMode}; converter generated ${actualMode ?? "unknown"}`);
        comparisonItems.push({
          name: fixture.name,
          swiftCode,
          swiftTypeName,
          width: fixture.width,
          height: fixture.height,
          scale: fixture.scale,
          background: fixture.background,
          fonts: fixture.fonts,
          expectedMode,
          usesDocumentTime: swiftCode.includes("init(documentTime: Double? = nil"),
          tolerance: fixture.tolerance,
          frames: fixture.frames.map((frame) => ({
            ...frame,
            referencePath: referencePath(fixture, frame.stem),
          })),
        });
      }
    } catch (error) {
      preparationErrors.push({ fixture: fixture.name, error: error instanceof Error ? error.message : String(error) });
    }
  }
  writeFileSync(REFERENCE_CACHE_PATH, JSON.stringify(referenceCache, null, 2));

  const results = await runAnimationBatch(comparisonItems, RENDERS_DIR, fresh);
  if (videos && preparationErrors.length === 0 && results.every((result) => result.status === "pass")) {
    console.log("  Encoding review-only MP4 artifacts...");
    generateReviewVideos(fixtures, comparisonItems);
  }
  const failures = results.filter((result) => result.status !== "pass");
  if (preparationErrors.length > 0 || failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of preparationErrors) console.log(`  [ERR ] ${failure.fixture}: ${failure.error}`);
    for (const result of failures) {
      console.log(
        `  [${result.status === "fail" ? "FAIL" : "ERR "}] ${result.fixture} frame ${result.frameIndex} ` +
          `at ${result.timeMicroseconds}us: ${formatMetrics(result)}`,
      );
      console.log(`         reference: ${result.referencePath}`);
      console.log(`         SwiftUI:   ${result.swiftPath}`);
      console.log(`         diff:      ${result.diffPath}`);
    }
  }

  const worstFrames = {
    outsidePercent: worstFrame(results, (result) => result.metrics?.outsidePercent),
    meanRgbError: worstFrame(results, (result) => result.metrics?.meanRgbError),
    meanAlphaError: worstFrame(results, (result) => result.metrics?.meanAlphaError),
    maxChannelError: worstFrame(results, (result) => result.metrics?.maxChannelError),
  };
  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  const errors = results.filter((result) => result.status === "error").length + preparationErrors.length;
  writeFileSync(
    resolve(RENDERS_DIR, "summary.json"),
    JSON.stringify(
      {
        comparison: "lossless-frame-sequence-premultiplied-srgb-rgba",
        fixtureCount: fixtures.length,
        selectedFrameCount: frameCount,
        comparedFrameCount: results.length,
        passed,
        failed,
        errors,
        worstFrames: Object.fromEntries(
          Object.entries(worstFrames).map(([metric, result]) => [metric, frameSummary(result)]),
        ),
        preparationErrors,
        results,
      },
      null,
      2,
    ),
  );

  console.log("\n---");
  console.log(`Reference probes: ${referenceProbesPassed} passed`);
  console.log(`Compared frames: ${passed} passed, ${failed} failed, ${errors} errors`);
  if (worstFrames.outsidePercent)
    console.log(
      `Worst frame: ${worstFrames.outsidePercent.fixture} #${worstFrames.outsidePercent.frameIndex} ` +
        `at ${worstFrames.outsidePercent.timeMicroseconds}us (${formatMetrics(worstFrames.outsidePercent)})`,
    );
  console.log("Oracle: lossless premultiplied-sRGB RGBA frames; encoded video is review-only");
  console.log(`Artifacts: ${RENDERS_DIR}`);
  if (failed > 0 || errors > 0) process.exit(1);
}

main();
