import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { convert } from "svg-to-swiftui-core";
import { iconDataToSvg } from "@/lib/icon-to-svg";

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

export interface IconExample {
  /** The icon name used (e.g. "star"). */
  iconName: string;
  /** The reconstructed SVG source. */
  svg: string;
  /** The generated SwiftUI Shape source. */
  swift: string;
}

function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Reads a pack's icon JSON, picks the first preferred icon that exists (falling
 * back to the first icon in the file), and returns its SVG plus the converted
 * SwiftUI Shape. Generated at build time so each article shows real output.
 */
export async function generateIconExample(manifestId: string, preferredNames: string[]): Promise<IconExample> {
  const filePath = join(process.cwd(), "public", "data", "icons", `${manifestId}.json`);
  const raw = await readFile(filePath, "utf-8");
  const entries = JSON.parse(raw) as IconEntry[];

  let entry = preferredNames
    .map((name) => entries.find(([entryName]) => entryName === name))
    .find((found): found is IconEntry => Boolean(found));
  if (!entry) entry = entries[0];
  if (!entry) throw new Error(`No icons found for pack "${manifestId}"`);

  const [iconName, data] = entry;
  const svg = iconDataToSvg(data);
  const swift = convert(svg, {
    structName: `${toPascalCase(iconName)}Shape`,
    precision: 3,
    indentationSize: 4,
  });

  return { iconName, svg, swift };
}
