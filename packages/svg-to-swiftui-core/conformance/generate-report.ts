#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expandedEntries, loadConformanceManifest, validateConformance } from "./model";

const errors = validateConformance({ checkReport: false });
if (errors.length > 0) throw new Error(errors.join("\n"));
const manifest = loadConformanceManifest();
const entries = expandedEntries();
const statuses = manifest.statuses.map((status) => ({
  status,
  count: entries.filter((entry) => entry.status === status).length,
}));
const lines = [
  "# Static SVG conformance report",
  "",
  `Profile: \`${manifest.profile}\``,
  `Version: \`${manifest.conformanceVersion}\``,
  `Inventory: ${entries.length} entries (${entries.filter((entry) => entry.visualFixtures.length > 0).length} with direct visual-fixture evidence).`,
  "",
  "This report is generated from `svg2-static-profile.json`. Unit-only entries are vocabulary with no independent pixel effect or shared family-level evidence.",
  "",
  "## Status summary",
  "",
  "| Status | Entries |",
  "| --- | ---: |",
  ...statuses.map(({ status, count }) => `| ${status} | ${count} |`),
  "",
  "## Complete matrix",
  "",
  "| Kind | Name | Status | Implementation | Unit evidence | Visual fixtures | Limitations |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...entries.map(
    (entry) =>
      `| ${entry.kind} | [\`${entry.name}\`](${entry.reference}) | ${entry.status} | ${entry.implementation.join(", ")} | ${entry.unitTests.join(", ")} | ${entry.visualFixtures.length > 0 ? entry.visualFixtures.map((item) => `\`${item}\``).join(", ") : "unit/shared-family only"} | ${entry.limitations.join(" ").replaceAll("|", "\\|")} |`,
  ),
  "",
];
writeFileSync(resolve(process.cwd(), "conformance/REPORT.md"), lines.join("\n"));
console.log(`Generated REPORT.md with ${entries.length} entries.`);
