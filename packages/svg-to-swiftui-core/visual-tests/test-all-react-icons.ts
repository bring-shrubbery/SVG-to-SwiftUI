#!/usr/bin/env bun
/**
 * Fast conversion test for all react-icons. Tests that convert() doesn't throw.
 * Also generates SVG fixture files for visual testing.
 *
 * Usage:
 *   bun run visual-tests/test-all-react-icons.ts              # conversion test only
 *   bun run visual-tests/test-all-react-icons.ts --generate    # also generate fixture SVGs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import { convert } from "../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DATA_DIR = resolve(__dirname, "../../../apps/nextjs/public/data/icons");
const FIXTURES_DIR = resolve(__dirname, "fixtures");

interface IconNode {
  tag: string;
  attr: Record<string, string>;
  child: IconNode[];
}

interface IconData {
  attr: Record<string, string>;
  child: IconNode[];
}

type IconEntry = [string, IconData];

// React camelCase → SVG kebab-case
const CAMEL_TO_KEBAB: Record<string, string> = {
  strokeWidth: "stroke-width",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeMiterlimit: "stroke-miterlimit",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeOpacity: "stroke-opacity",
  fillRule: "fill-rule",
  clipRule: "clip-rule",
  fillOpacity: "fill-opacity",
  clipPath: "clip-path",
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  textAnchor: "text-anchor",
  baselineShift: "baseline-shift",
  enableBackground: "enable-background",
};

function attrToString(attr: Record<string, string>): string {
  return Object.entries(attr)
    .map(([k, v]) => {
      const svgKey = CAMEL_TO_KEBAB[k] || k;
      return `${svgKey}="${v}"`;
    })
    .join(" ");
}

function nodeToSvg(node: IconNode, indent: string): string {
  const attrStr = node.attr && Object.keys(node.attr).length > 0 ? ` ${attrToString(node.attr)}` : "";
  if (!node.child || node.child.length === 0) {
    return `${indent}<${node.tag}${attrStr} />`;
  }
  const children = node.child.map((c) => nodeToSvg(c, indent + "  ")).join("\n");
  return `${indent}<${node.tag}${attrStr}>\n${children}\n${indent}</${node.tag}>`;
}

function iconDataToSvg(data: IconData): string {
  const svgAttr = { ...data.attr };
  if (!svgAttr.xmlns) svgAttr.xmlns = "http://www.w3.org/2000/svg";
  const attrStr = attrToString(svgAttr);
  const children = data.child.map((c) => nodeToSvg(c, "  ")).join("\n");
  return `<svg ${attrStr}>\n${children}\n</svg>`;
}

// Check if the icon uses multiple fill colors (like Flat Color Icons)
function usesMultipleColors(data: IconData): boolean {
  const colors = new Set<string>();

  function scan(node: IconNode) {
    if (node.attr?.fill) {
      const c = node.attr.fill.toLowerCase();
      if (c !== "none" && c !== "currentColor") colors.add(c);
    }
    node.child?.forEach(scan);
  }

  data.child.forEach(scan);
  return colors.size > 1;
}

async function main() {
  const generateFixtures = process.argv.includes("--generate");

  const manifestPath = join(ICONS_DATA_DIR, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as { id: string; name: string; count: number }[];

  let totalIcons = 0;
  let totalErrors = 0;
  let totalMultiColor = 0;
  const errorsBySet: Record<string, { name: string; error: string }[]> = {};

  if (generateFixtures) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  for (const { id, name, count } of manifest) {
    const dataPath = join(ICONS_DATA_DIR, `${id}.json`);
    let icons: IconEntry[];
    try {
      icons = JSON.parse(readFileSync(dataPath, "utf-8"));
    } catch {
      console.log(`  Skipping ${id} (can't read data)`);
      continue;
    }

    let setErrors = 0;
    let setMultiColor = 0;
    const errors: { name: string; error: string }[] = [];

    for (const [iconName, iconData] of icons) {
      totalIcons++;

      // Skip multi-color icons for visual testing (they use multiple fill colors)
      const multiColor = usesMultipleColors(iconData);
      if (multiColor) {
        totalMultiColor++;
        setMultiColor++;
        continue;
      }

      const svg = iconDataToSvg(iconData);

      try {
        convert(svg, { structName: "TestShape", precision: 5 });

        if (generateFixtures) {
          const fixtureName = `${id}-${iconName}`.replace(/[^a-z0-9-]/g, "-");
          writeFileSync(join(FIXTURES_DIR, `${fixtureName}.svg`), svg);
        }
      } catch (err: unknown) {
        setErrors++;
        totalErrors++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ name: iconName, error: msg });
      }
    }

    if (errors.length > 0) {
      errorsBySet[id] = errors;
    }

    const status = setErrors > 0 ? "FAIL" : "OK";
    const multiColorNote = setMultiColor > 0 ? ` (${setMultiColor} multi-color skipped)` : "";
    console.log(
      `  [${status}] ${name.padEnd(30)} ${(count - setMultiColor).toString().padStart(5)} tested, ${setErrors} errors${multiColorNote}`,
    );
  }

  console.log("\n---");
  console.log(`Total: ${totalIcons} icons, ${totalErrors} errors, ${totalMultiColor} multi-color skipped`);

  if (totalErrors > 0) {
    console.log("\nErrors by set:");
    for (const [setId, errors] of Object.entries(errorsBySet)) {
      console.log(`\n  ${setId}:`);
      // Show first 5 unique error messages
      const uniqueErrors = new Map<string, string[]>();
      for (const { name, error } of errors) {
        const key = error.substring(0, 100);
        if (!uniqueErrors.has(key)) uniqueErrors.set(key, []);
        uniqueErrors.get(key)!.push(name);
      }
      for (const [error, names] of uniqueErrors) {
        console.log(`    ${error}`);
        console.log(`      Affected: ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` (+${names.length - 5} more)` : ""}`);
      }
    }
    process.exit(1);
  }
}

main();
