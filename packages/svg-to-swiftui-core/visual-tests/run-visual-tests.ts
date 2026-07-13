#!/usr/bin/env bun
/** Full-color SVG-to-SwiftUI visual regression runner. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { convert } from "../src/index";
import { type BatchTestItem, type BatchTestResult, runBatchVisualTest } from "./batch-render";
import { FIXTURES_DIR, loadFixtures, outputMode, validateManifest, withPixelViewport } from "./manifest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR = resolve(__dirname, "renders");
const REFERENCE_CACHE_PATH = resolve(RENDERS_DIR, ".reference-cache.json");
const REFERENCE_RENDERER_VERSION = "rgba-resvg-v1";
const WEBKIT_RENDERER_SOURCE = resolve(__dirname, "webkit-reference-render.swift");
const WEBKIT_RENDERER_BINARY = resolve(RENDERS_DIR, ".cache", "webkit-reference-render");
let webKitRendererReady = false;

function ensureWebKitRenderer(): void {
  if (webKitRendererReady) return;
  mkdirSync(dirname(WEBKIT_RENDERER_BINARY), { recursive: true });
  execFileSync(
    "xcrun",
    ["swiftc", WEBKIT_RENDERER_SOURCE, "-framework", "WebKit", "-framework", "AppKit", "-o", WEBKIT_RENDERER_BINARY],
    { stdio: "pipe" },
  );
  webKitRendererReady = true;
}

function renderWebKitReference(
  source: string,
  name: string,
  outputPath: string,
  width: number,
  height: number,
  pixelWidth: number,
  pixelHeight: number,
): void {
  ensureWebKitRenderer();
  const inputPath = resolve(RENDERS_DIR, ".cache", `${name}-webkit-source.svg`);
  writeFileSync(inputPath, withPixelViewport(source, width, height));
  execFileSync(
    WEBKIT_RENDERER_BINARY,
    [inputPath, outputPath, String(width), String(height), String(pixelWidth), String(pixelHeight)],
    { stdio: "pipe" },
  );
}

interface ReferenceCacheEntry {
  hash: string;
}

function hash(...values: (string | Buffer)[]): string {
  const digest = createHash("sha256");
  for (const value of values) digest.update(value);
  return digest.digest("hex");
}

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function changedFixtureNames(): Set<string> {
  const paths = new Set<string>();
  const commands = [
    ["diff", "--name-only", "origin/main...HEAD"],
    ["diff", "--name-only", "HEAD"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  for (const args of commands) {
    try {
      const output = execFileSync("git", args, { cwd: resolve(__dirname, "../../.."), encoding: "utf8" });
      for (const line of output.split("\n")) if (line.trim()) paths.add(line.trim());
    } catch {}
  }
  const fixturePrefix = relative(resolve(__dirname, "../../.."), FIXTURES_DIR).replaceAll("\\", "/");
  return new Set(
    [...paths]
      .map((path) => path.replaceAll("\\", "/"))
      .filter((path) => path.startsWith(`${fixturePrefix}/`) && path.endsWith(".svg"))
      .map((path) => path.slice(fixturePrefix.length + 1, -4)),
  );
}

function formatMetrics(result: BatchTestResult): string {
  const metrics = result.metrics;
  if (!metrics) return result.error ?? "unknown error";
  const bounds = metrics.bounds
    ? `${metrics.bounds.x},${metrics.bounds.y} ${metrics.bounds.width}x${metrics.bounds.height}`
    : "none";
  return [
    `outside=${metrics.outsidePercent.toFixed(3)}% (${metrics.pixelsOutsideTolerance}/${metrics.totalPixels})`,
    `meanRGB=${metrics.meanRgbError.toFixed(3)}`,
    `meanA=${metrics.meanAlphaError.toFixed(3)}`,
    `meanRGBA=${metrics.meanAbsoluteError.toFixed(3)}`,
    `max=${metrics.maxChannelError}`,
    `bounds=${bounds}`,
  ].join(" ");
}

async function main() {
  const manifestErrors = validateManifest();
  if (manifestErrors.length > 0) {
    console.error(`Fixture manifest failed with ${manifestErrors.length} error(s):`);
    for (const error of manifestErrors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const fresh = process.argv.includes("--fresh");
  const requestedFixture = optionValue("--fixture");
  const requestedTag = optionValue("--tag");
  const useChanged = process.argv.includes("--changed");
  const legacyFilter = process.argv.find(
    (argument, index) =>
      index > 1 &&
      !argument.startsWith("--") &&
      process.argv[index - 1] !== "--fixture" &&
      process.argv[index - 1] !== "--tag",
  );
  const nameFilter = requestedFixture ?? legacyFilter;
  const changed = useChanged ? changedFixtureNames() : undefined;

  const fixtures = loadFixtures().filter(
    (fixture) =>
      (!nameFilter || fixture.name.includes(nameFilter)) &&
      (!requestedTag || fixture.tags.includes(requestedTag)) &&
      (!changed || changed.has(fixture.name)),
  );
  if (fixtures.length === 0) {
    console.error("No visual fixtures matched the requested fixture/tag/changed filters.");
    process.exit(1);
  }

  if (process.platform !== "darwin") {
    console.log(
      `Fixture manifest valid (${fixtures.length} selected). RGBA rendering requires macOS; skipping render.`,
    );
    return;
  }

  mkdirSync(RENDERS_DIR, { recursive: true });
  let referenceCache: Record<string, ReferenceCacheEntry> = {};
  if (!fresh) {
    try {
      referenceCache = JSON.parse(readFileSync(REFERENCE_CACHE_PATH, "utf8"));
    } catch {}
  }

  console.log(`Processing ${fixtures.length} deterministic RGBA fixture(s)...\n`);
  const items: BatchTestItem[] = [];
  const conversionErrors: BatchTestResult[] = [];
  let referenceCacheHits = 0;
  const started = Date.now();

  for (const fixture of fixtures) {
    const referencePath = resolve(RENDERS_DIR, `${fixture.name}-svg.png`);
    try {
      mkdirSync(dirname(referencePath), { recursive: true });
      const source = readFileSync(fixture.sourcePath, "utf8");
      const pixelWidth = Math.round(fixture.width * fixture.scale);
      const pixelHeight = Math.round(fixture.height * fixture.scale);
      const resourceBytes = fixture.fonts.map((font) => readFileSync(resolve(__dirname, font)));
      const usesWebKitReference = fixture.tags.includes("blend-mode");
      if (usesWebKitReference) resourceBytes.push(readFileSync(WEBKIT_RENDERER_SOURCE));
      for (const match of source.matchAll(/<image\b[^>]*\b(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)) {
        const href = match[1]!;
        if (!/^(?:data:|#)/i.test(href)) resourceBytes.push(readFileSync(resolve(dirname(fixture.sourcePath), href)));
      }
      const referenceHash = hash(
        source,
        JSON.stringify({
          renderer: usesWebKitReference ? "rgba-webkit-v2" : REFERENCE_RENDERER_VERSION,
          pixelWidth,
          pixelHeight,
          background: fixture.background,
        }),
        ...resourceBytes,
      );

      if (!fresh && referenceCache[fixture.name]?.hash === referenceHash && existsSync(referencePath)) {
        referenceCacheHits++;
      } else {
        if (usesWebKitReference) {
          renderWebKitReference(
            source,
            fixture.name,
            referencePath,
            fixture.width,
            fixture.height,
            pixelWidth,
            pixelHeight,
          );
        } else {
          const sizedSource = withPixelViewport(source, pixelWidth, pixelHeight);
          const resvg = new Resvg(sizedSource, {
            ...(fixture.background ? { background: fixture.background } : {}),
            font: {
              loadSystemFonts: false,
              fontFiles: fixture.fonts.map((font) => resolve(__dirname, font)),
            },
          });
          for (const href of resvg.imagesToResolve()) {
            const resourcePath = resolve(dirname(fixture.sourcePath), href);
            resvg.resolveImage(href, readFileSync(resourcePath));
          }
          const rendered = resvg.render();
          if (rendered.width !== pixelWidth || rendered.height !== pixelHeight) {
            throw new Error(
              `resvg rendered ${rendered.width}x${rendered.height}; expected ${pixelWidth}x${pixelHeight}`,
            );
          }
          writeFileSync(referencePath, Buffer.from(rendered.asPng()));
        }
        referenceCache[fixture.name] = { hash: referenceHash };
      }

      const swiftTypeName = `VisualFixture${items.length}`;
      const swiftCode = convert(source, {
        structName: swiftTypeName,
        precision: 5,
        preserveColors: fixture.expectedMode === "view",
      });
      const actualMode = outputMode(swiftCode);
      if (actualMode !== fixture.expectedMode) {
        throw new Error(`Manifest expects ${fixture.expectedMode}; converter generated ${actualMode ?? "unknown"}`);
      }
      items.push({
        name: fixture.name,
        svgPngPath: referencePath,
        swiftCode,
        swiftTypeName,
        width: fixture.width,
        height: fixture.height,
        scale: fixture.scale,
        background: fixture.background,
        fonts: fixture.fonts,
        expectedMode: fixture.expectedMode,
        tags: fixture.tags,
        tolerance: fixture.tolerance,
      });
    } catch (error) {
      conversionErrors.push({
        name: fixture.name,
        score: 0,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        referencePath,
      });
    }
  }
  writeFileSync(REFERENCE_CACHE_PATH, JSON.stringify(referenceCache, null, 2));
  console.log(
    `  Prepared ${items.length} generated declarations in ${((Date.now() - started) / 1000).toFixed(1)}s ` +
      `(${referenceCacheHits} reference cache hits)`,
  );

  const renderedResults = await runBatchVisualTest(items, RENDERS_DIR, fresh);
  const results = [...renderedResults, ...conversionErrors].sort((left, right) => left.name.localeCompare(right.name));
  const failedResults = results.filter((result) => result.status !== "pass");
  if (failedResults.length > 0) {
    console.log("\nFailures:");
    for (const result of failedResults) {
      console.log(`  [${result.status === "fail" ? "FAIL" : "ERR "}] ${result.name}: ${formatMetrics(result)}`);
      if (result.referencePath) console.log(`         reference: ${result.referencePath}`);
      if (result.swiftPath) console.log(`         SwiftUI:   ${result.swiftPath}`);
      if (result.diffPath) console.log(`         diff:      ${result.diffPath}`);
    }
  }

  const selectedByName = new Map(fixtures.map((fixture) => [fixture.name, fixture]));
  const allTags = [...new Set(fixtures.flatMap((fixture) => fixture.tags))].sort();
  console.log("\nFeature coverage:");
  const featureSummary: Record<string, { total: number; passed: number; failed: number; errors: number }> = {};
  for (const tag of allTags) {
    const tagged = results.filter((result) => selectedByName.get(result.name)?.tags.includes(tag));
    const summary = {
      total: tagged.length,
      passed: tagged.filter((result) => result.status === "pass").length,
      failed: tagged.filter((result) => result.status === "fail").length,
      errors: tagged.filter((result) => result.status === "error").length,
    };
    featureSummary[tag] = summary;
    console.log(
      `  ${tag.padEnd(16)} ${String(summary.passed).padStart(4)}/${String(summary.total).padEnd(4)} pass` +
        (summary.failed || summary.errors ? ` (${summary.failed} fail, ${summary.errors} error)` : ""),
    );
  }

  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  const errors = results.filter((result) => result.status === "error").length;
  console.log("\n---");
  console.log(`Results: ${passed} passed, ${failed} failed, ${errors} errors`);
  console.log("Comparison: premultiplied sRGB RGBA with per-fixture channel and mean-error thresholds");
  console.log(`Artifacts: ${RENDERS_DIR}`);

  writeFileSync(
    resolve(RENDERS_DIR, "summary.json"),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        comparison: "premultiplied-srgb-rgba",
        features: featureSummary,
        results: results.map((result) => ({
          name: result.name,
          score: result.score,
          status: result.status,
          ...(result.metrics ? { metrics: result.metrics } : {}),
          ...(result.error ? { error: result.error } : {}),
          referencePath: result.referencePath,
          swiftPath: result.swiftPath,
          diffPath: result.diffPath,
        })),
      },
      null,
      2,
    ),
  );
  if (failed > 0 || errors > 0) process.exit(1);
}

main();
