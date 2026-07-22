import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Status =
  | "supported"
  | "partially-supported"
  | "intentionally-static-snapshot"
  | "dynamic-out-of-scope"
  | "obsolete"
  | "unsupported-blocker";

export interface ConformanceGroup {
  kind: "element" | "attribute" | "property" | "filter-primitive";
  names: string[];
  status: Status;
  reference: string;
  implementation: string[];
  unitTests: string[];
  visualFixtures: string[];
  syntax: string[];
  limitations: string[];
  fallback: { permissive: string; strict: string };
}

export interface ConformanceManifest {
  version: number;
  profile: string;
  conformanceVersion: string;
  generatedFrom: string[];
  statuses: Status[];
  groups: ConformanceGroup[];
}

export interface ConformanceEntry extends Omit<ConformanceGroup, "names" | "visualFixtures"> {
  name: string;
  visualFixtures: string[];
}

const directory = resolve(process.cwd(), "conformance");
export const manifestPath = resolve(directory, "svg2-static-profile.json");
const fixtureManifestPath = resolve(directory, "../visual-tests/fixture-manifest.json");
const fixturesDirectory = resolve(directory, "../visual-tests/fixtures");
const reportPath = resolve(directory, "REPORT.md");
const TERMINAL_STATUSES: readonly Status[] = [
  "supported",
  "partially-supported",
  "intentionally-static-snapshot",
  "dynamic-out-of-scope",
  "obsolete",
  "unsupported-blocker",
];
const FAMILY_TAGS = new Set(["font", "opacity", "overflow", "shape", "spacing", "view"]);
const EVIDENCE_IDS = new Set([
  "conformance.elements.static",
  "conformance.elements.partial",
  "conformance.elements.foreign-object",
  "conformance.elements.dynamic",
  "conformance.attributes.static",
  "conformance.attributes.events",
  "conformance.attributes.obsolete",
  "conformance.properties.static",
  "conformance.filters.level1",
]);

export function loadConformanceManifest(): ConformanceManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ConformanceManifest;
}

function fixtureIndex(): Map<string, string[]> {
  const file = JSON.parse(readFileSync(fixtureManifestPath, "utf8")) as {
    fixtures: Record<string, { tags: string[] }>;
  };
  const byTag = new Map<string, string[]>();
  for (const [name, fixture] of Object.entries(file.fixtures)) {
    for (const tag of fixture.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), name]);
  }
  return byTag;
}

export function expandedEntries(): ConformanceEntry[] {
  const byTag = fixtureIndex();
  return loadConformanceManifest()
    .groups.flatMap((group) =>
      group.names.map((name) => ({
        ...group,
        name,
        visualFixtures: group.visualFixtures.flatMap((template) => {
          const tag = template
            .replace("{name}", name)
            .replace(/^tag:/, "")
            .replace(/^attribute:/, "")
            .replace(/^property:/, "");
          return byTag.get(tag)?.slice(0, 3) ?? [];
        }),
      })),
    )
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
}

export function validateConformance(options: { checkReport?: boolean } = {}): string[] {
  const manifest = loadConformanceManifest();
  const errors: string[] = [];
  const allowed = new Set(TERMINAL_STATUSES);
  const expectedCounts = new Map([
    ["element", 69],
    ["attribute", 318],
    ["property", 45],
    ["filter-primitive", 17],
  ]);
  const entries = expandedEntries();
  if (JSON.stringify(manifest.statuses) !== JSON.stringify(TERMINAL_STATUSES)) {
    errors.push("Manifest statuses must exactly match the terminal status vocabulary");
  }
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.name}`;
    if (seen.has(key)) errors.push(`Duplicate entry: ${key}`);
    seen.add(key);
    if (!allowed.has(entry.status)) errors.push(`${key}: invalid status '${entry.status}'`);
    if (entry.status === "unsupported-blocker") errors.push(`${key}: release-blocking unsupported entry`);
    if (!entry.reference.startsWith("https://www.w3.org/TR/")) errors.push(`${key}: normative W3C URL required`);
    if (entry.implementation.length === 0) errors.push(`${key}: implementation issue/PR required`);
    if (entry.unitTests.length === 0) errors.push(`${key}: unit-test evidence ID required`);
    for (const evidence of entry.unitTests) {
      if (!EVIDENCE_IDS.has(evidence)) errors.push(`${key}: unknown unit-test evidence ID '${evidence}'`);
    }
    if (entry.syntax.length === 0) errors.push(`${key}: supported syntax/values required`);
    if (entry.limitations.length === 0) errors.push(`${key}: limitations/platform notes required`);
    if (!entry.fallback.permissive || !entry.fallback.strict) errors.push(`${key}: both fallback modes required`);
  }
  for (const [kind, count] of expectedCounts) {
    const actual = entries.filter((entry) => entry.kind === kind).length;
    if (actual !== count) errors.push(`${kind}: expected ${count} classified entries, found ${actual}`);
  }
  if (manifest.generatedFrom.length !== 4) errors.push("All four normative inventory sources are required");

  const elementNames = new Set(
    entries.filter((entry) => entry.kind === "element" || entry.kind === "filter-primitive").map((entry) => entry.name),
  );
  const attributeNames = new Set(entries.filter((entry) => entry.kind === "attribute").map((entry) => entry.name));
  const propertyNames = new Set(entries.filter((entry) => entry.kind === "property").map((entry) => entry.name));
  const fixtureFile = JSON.parse(readFileSync(fixtureManifestPath, "utf8")) as {
    fixtures: Record<string, { tags: string[] }>;
  };
  for (const [fixtureName, fixture] of Object.entries(fixtureFile.fixtures)) {
    const source = readFileSync(resolve(fixturesDirectory, `${fixtureName}.svg`), "utf8");
    for (const tag of fixture.tags) {
      if (FAMILY_TAGS.has(tag)) continue;
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exercised = elementNames.has(tag)
        ? new RegExp(`<\\s*${escaped}\\b`, "i").test(source)
        : attributeNames.has(tag) || propertyNames.has(tag)
          ? new RegExp(`(?:\\s${escaped}\\s*=|${escaped}\\s*:)`, "i").test(source)
          : true;
      if (!exercised) errors.push(`${fixtureName}: feature tag '${tag}' is not exercised by its SVG source`);
    }
  }
  if (options.checkReport !== false) {
    const report = readFileSync(reportPath, "utf8");
    if (!report.includes(`Version: \`${manifest.conformanceVersion}\``)) errors.push("REPORT.md has a stale version");
    for (const entry of entries) {
      const row = `| ${entry.kind} | [\`${entry.name}\`](${entry.reference}) | ${entry.status} |`;
      if (!report.includes(row)) errors.push(`REPORT.md is missing or stale for ${entry.kind}:${entry.name}`);
    }
  }
  return errors;
}
