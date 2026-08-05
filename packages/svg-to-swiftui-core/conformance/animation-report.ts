import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAnimationProfile } from "./animation-profile";

export function renderAnimationReport(): string {
  const profile = buildAnimationProfile();
  const manifest = JSON.parse(
    readFileSync(resolve(import.meta.dir, "../animation-tests/animation-fixture-manifest.json"), "utf8"),
  ) as {
    benchmarkLadder: Array<{ rank: number; fixture: string; capability: string }>;
  };
  const counts = new Map<string, number>();
  for (const entry of profile.entries) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  const lines = [
    "# Declarative SVG animation conformance",
    "",
    "Generated from the versioned machine-readable dynamic profile. Do not edit by hand.",
    "",
    "The supported profile is deterministic declarative SVG/SMIL and CSS animation compiled to native SwiftUI. A browser DOM, script runtime, navigation, media playback, and live network access are outside the security boundary.",
    "",
    "## Summary",
    "",
    "| Status | Entries |",
    "| --- | ---: |",
    ...[...counts].map(([status, count]) => `| ${status} | ${count} |`),
    "",
    "## Known-good benchmark ladder",
    "",
    "Every comparison compiles generated Swift, renders exact document times, and compares lossless premultiplied-sRGB RGBA pixels against WebKit.",
    "",
    "| Rank | Fixture | Capability |",
    "| ---: | --- | --- |",
    ...manifest.benchmarkLadder.map((item) => `| ${item.rank} | \`${item.fixture}\` | ${item.capability} |`),
    "",
    "## Complete inventory",
    "",
    "| Feature | Status | Unit evidence | Temporal tag | Limitation |",
    "| --- | --- | --- | --- | --- |",
    ...profile.entries.map(
      (entry) =>
        `| \`${entry.id}\` | ${entry.status} | ${entry.unitEvidence.join(", ")} | ${entry.temporalTags.join(", ")} | ${entry.limitations.join(" ") || "—"} |`,
    ),
    "",
  ];
  return lines.join("\n");
}
