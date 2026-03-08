#!/usr/bin/env bun
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { convert } from "../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DATA_DIR = resolve(__dirname, "../../../apps/nextjs/public/data/icons");

const CAMEL_TO_KEBAB: Record<string, string> = {
  strokeWidth: "stroke-width",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  fillRule: "fill-rule",
  clipRule: "clip-rule",
  enableBackground: "enable-background",
};

function attrToString(attr: Record<string, string>): string {
  return Object.entries(attr)
    .map(([k, v]) => `${CAMEL_TO_KEBAB[k] || k}="${v}"`)
    .join(" ");
}

function nodeToSvg(node: { tag: string; attr: Record<string, string>; child: any[] }, indent: string): string {
  const attrStr = node.attr && Object.keys(node.attr).length > 0 ? ` ${attrToString(node.attr)}` : "";
  if (node.child == null || node.child.length === 0) return `${indent}<${node.tag}${attrStr} />`;
  const children = node.child.map((c: any) => nodeToSvg(c, indent + "  ")).join("\n");
  return `${indent}<${node.tag}${attrStr}>\n${children}\n${indent}</${node.tag}>`;
}

function iconDataToSvg(data: { attr: Record<string, string>; child: any[] }): string {
  const svgAttr = { ...data.attr, xmlns: "http://www.w3.org/2000/svg" };
  const attrStr = attrToString(svgAttr);
  const children = data.child.map((c: any) => nodeToSvg(c, "  ")).join("\n");
  return `<svg ${attrStr}>\n${children}\n</svg>`;
}

const failures = [
  ["fa", "firefox-browser"],
  ["si", "mintlify"],
  ["si", "createreactapp"],
  ["pi", "tent-bold"],
];

for (const [setId, iconName] of failures) {
  const data = JSON.parse(readFileSync(`${ICONS_DATA_DIR}/${setId}.json`, "utf-8"));
  const entry = data.find(([n]: [string]) => n === iconName);
  if (!entry) {
    console.log(`${iconName}: NOT FOUND`);
    continue;
  }
  const svg = iconDataToSvg(entry[1]);
  try {
    convert(svg, { structName: "T", precision: 5 });
    console.log(`${setId}/${iconName}: OK`);
  } catch (e: unknown) {
    const err = e as Error;
    console.log(`${setId}/${iconName}: ${err.message.substring(0, 200)}`);
    const stackLines = (err.stack || "").split("\n").slice(1, 6);
    for (const line of stackLines) {
      console.log(`  ${line.trim()}`);
    }
  }
}
