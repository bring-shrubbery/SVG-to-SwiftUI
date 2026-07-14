import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RgbaTolerance } from "./rgba-compare";

const VISUAL_TESTS_DIR = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = resolve(VISUAL_TESTS_DIR, "fixtures");
export const MANIFEST_PATH = resolve(VISUAL_TESTS_DIR, "fixture-manifest.json");

export type ExpectedOutputMode = "shape" | "view";

export interface FixtureManifestEntry {
  width: number;
  height: number;
  scale: number;
  background: string | null;
  fonts: string[];
  fontFamilies: string[];
  expectedMode: ExpectedOutputMode;
  tags: string[];
  tolerance: RgbaTolerance;
  toleranceReason?: string;
}

interface RawFixtureEntry {
  width: number;
  height: number;
  scale?: number;
  background?: string | null;
  fonts?: string[];
  fontFamilies?: string[];
  expectedMode: ExpectedOutputMode;
  tags: string[];
  tolerance?: Partial<RgbaTolerance>;
  toleranceReason?: string;
}

interface FixtureManifestFile {
  version: 1;
  defaults: {
    scale: number;
    background: string | null;
    fonts: string[];
    fontFamilies?: string[];
    tolerance: RgbaTolerance;
  };
  fixtures: Record<string, RawFixtureEntry>;
}

export interface LoadedFixture extends FixtureManifestEntry {
  name: string;
  relativePath: string;
  sourcePath: string;
}

export function findSvgFiles(directory = FIXTURES_DIR): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...findSvgFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".svg")) files.push(path);
  }
  return files.sort();
}

export function fixtureKey(path: string): string {
  return relative(FIXTURES_DIR, path)
    .replaceAll("\\", "/")
    .replace(/\.svg$/, "");
}

export function readManifestFile(): FixtureManifestFile {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as FixtureManifestFile;
}

export function loadFixtures(): LoadedFixture[] {
  const manifest = readManifestFile();
  if (manifest.version !== 1) throw new Error(`Unsupported fixture manifest version: ${manifest.version}`);

  return Object.entries(manifest.fixtures)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, entry]) => ({
      name,
      relativePath: `${name}.svg`,
      sourcePath: resolve(FIXTURES_DIR, `${name}.svg`),
      width: entry.width,
      height: entry.height,
      scale: entry.scale ?? manifest.defaults.scale,
      background: entry.background === undefined ? manifest.defaults.background : entry.background,
      fonts: entry.fonts ?? manifest.defaults.fonts,
      fontFamilies: entry.fontFamilies ?? manifest.defaults.fontFamilies ?? [],
      expectedMode: entry.expectedMode,
      tags: entry.tags,
      tolerance: { ...manifest.defaults.tolerance, ...entry.tolerance },
      ...(entry.toleranceReason ? { toleranceReason: entry.toleranceReason } : {}),
    }));
}

export function validateManifest(): string[] {
  const errors: string[] = [];
  let fixtures: LoadedFixture[] = [];
  let rawManifest: FixtureManifestFile | undefined;
  try {
    rawManifest = readManifestFile();
    fixtures = loadFixtures();
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  const files = findSvgFiles();
  const actual = new Set(files.map(fixtureKey));
  const declared = new Set(fixtures.map((fixture) => fixture.name));
  for (const name of actual) if (!declared.has(name)) errors.push(`Fixture missing from manifest: ${name}.svg`);
  for (const name of declared) if (!actual.has(name)) errors.push(`Manifest entry has no SVG fixture: ${name}.svg`);

  for (const fixture of fixtures) {
    const prefix = `${fixture.name}:`;
    const rawEntry = rawManifest?.fixtures[fixture.name];
    if (!Number.isFinite(fixture.width) || fixture.width <= 0) errors.push(`${prefix} width must be positive`);
    if (!Number.isFinite(fixture.height) || fixture.height <= 0) errors.push(`${prefix} height must be positive`);
    if (!Number.isFinite(fixture.scale) || fixture.scale <= 0) errors.push(`${prefix} scale must be positive`);
    if (fixture.tags.length === 0) errors.push(`${prefix} at least one feature tag is required`);
    if (new Set(fixture.tags).size !== fixture.tags.length) errors.push(`${prefix} feature tags must be unique`);
    if (
      !Number.isFinite(fixture.tolerance.channel) ||
      fixture.tolerance.channel < 0 ||
      fixture.tolerance.channel >= 255
    )
      errors.push(`${prefix} channel tolerance must be between 0 and 254`);
    if (
      !Number.isFinite(fixture.tolerance.maxOutsidePercent) ||
      fixture.tolerance.maxOutsidePercent < 0 ||
      fixture.tolerance.maxOutsidePercent >= 100
    )
      errors.push(`${prefix} maxOutsidePercent must be between 0 and less than 100`);
    if (
      !Number.isFinite(fixture.tolerance.maxMeanRgbError) ||
      fixture.tolerance.maxMeanRgbError < 0 ||
      fixture.tolerance.maxMeanRgbError >= 255
    )
      errors.push(`${prefix} maxMeanRgbError must be between 0 and 254`);
    if (
      !Number.isFinite(fixture.tolerance.maxMeanAlphaError) ||
      fixture.tolerance.maxMeanAlphaError < 0 ||
      fixture.tolerance.maxMeanAlphaError >= 255
    )
      errors.push(`${prefix} maxMeanAlphaError must be between 0 and 254`);
    if (rawEntry?.tolerance && !rawEntry.toleranceReason)
      errors.push(`${prefix} tolerance overrides require a narrow justification`);
    if (rawEntry?.toleranceReason && !rawEntry.tolerance) errors.push(`${prefix} toleranceReason requires an override`);
    try {
      parseBackground(fixture.background);
    } catch (error) {
      errors.push(`${prefix} ${error instanceof Error ? error.message : String(error)}`);
    }

    for (const font of fixture.fonts) {
      const fontPath = resolve(VISUAL_TESTS_DIR, font);
      if (!fontPath.startsWith(VISUAL_TESTS_DIR) || !existsSync(fontPath)) {
        errors.push(`${prefix} deterministic font does not exist: ${font}`);
      }
    }
    if (fixture.fonts.length > 0 && fixture.fontFamilies.length === 0)
      errors.push(`${prefix} deterministic font files require at least one fontFamilies entry`);

    if (!existsSync(fixture.sourcePath)) continue;
    const source = readFileSync(fixture.sourcePath, "utf8");
    if (
      /<(?:image|use)\b[^>]*\b(?:href|src)\s*=\s*["']https?:\/\//i.test(source) ||
      /url\(\s*["']?https?:\/\//i.test(source)
    ) {
      errors.push(`${prefix} network resources are forbidden; embed or vendor the resource`);
    }
    for (const match of source.matchAll(/<image\b[^>]*\b(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)) {
      const href = match[1]!;
      if (/^(?:data:|#)/i.test(href)) continue;
      const resourcePath = resolve(dirname(fixture.sourcePath), href);
      if (!existsSync(resourcePath)) errors.push(`${prefix} local image resource does not exist: ${href}`);
    }
  }
  return errors;
}

export function parseBackground(value: string | null): [number, number, number, number] {
  if (value === null) return [0, 0, 0, 0];
  const match = /^#([\da-f]{6}|[\da-f]{8})$/i.exec(value);
  if (!match) throw new Error(`Background must be null, #RRGGBB, or #RRGGBBAA: ${value}`);
  const hex = match[1]!;
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
    hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  ];
}

/** Force resvg to the same exact pixel canvas used by SwiftUI while retaining the SVG viewBox. */
export function withPixelViewport(svg: string, width: number, height: number): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attributes: string) => {
    const withoutSize = attributes.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    return `<svg${withoutSize} width="${width}" height="${height}">`;
  });
}

export function outputMode(swiftCode: string): ExpectedOutputMode | undefined {
  const declaration = /(?:^|\n)(?:private\s+)?struct\s+\w+\s*:\s*(Shape|View)\b/.exec(swiftCode);
  return declaration?.[1]?.toLowerCase() as ExpectedOutputMode | undefined;
}
