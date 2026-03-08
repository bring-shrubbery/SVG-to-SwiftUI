/**
 * Build-time script to extract all Lucide icon SVG data into a static JSON file.
 * Run with: bun run scripts/generate-lucide-data.ts
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ICONS_DIR = join(
  import.meta.dir,
  "../node_modules/lucide-react/dist/esm/icons",
);
const OUT_DIR = join(import.meta.dir, "../public/data");
const OUT_FILE = join(OUT_DIR, "lucide-icons.json");

interface IconEntry {
  name: string;
  nodes: [string, Record<string, string>][];
}

// Regex to extract __iconNode array from the JS source
const ICON_NODE_RE =
  /const __iconNode\s*=\s*(\[[\s\S]*?\]);\s*\n/;

function parseIconNode(
  source: string,
): [string, Record<string, string>][] | null {
  const match = ICON_NODE_RE.exec(source);
  if (!match?.[1]) return null;

  // Convert JS object notation to JSON-parseable format
  let raw = match[1];
  // Replace unquoted keys: { d: "..." } → { "d": "..." }
  raw = raw.replace(/(\{)\s*(\w+)\s*:/g, '$1 "$2":');
  raw = raw.replace(/,\s*(\w+)\s*:/g, ', "$1":');
  // Remove trailing commas before ] or }
  raw = raw.replace(/,\s*([\]}])/g, "$1");

  try {
    const parsed = JSON.parse(raw) as [string, Record<string, string>][];
    // Strip React "key" properties — not needed for SVG reconstruction
    return parsed.map(([tag, attrs]) => {
      const { key, ...rest } = attrs;
      return [tag, rest];
    });
  } catch {
    return null;
  }
}

async function main() {
  const files = await readdir(ICONS_DIR);
  const jsFiles = files
    .filter((f) => f.endsWith(".js") && !f.endsWith(".js.map"))
    .sort();

  const seen = new Set<string>();
  const icons: IconEntry[] = [];

  for (const file of jsFiles) {
    const source = await readFile(join(ICONS_DIR, file), "utf-8");
    const nodes = parseIconNode(source);
    if (!nodes) continue;

    // Deduplicate by content (aliases point to same data)
    const contentKey = JSON.stringify(nodes);
    if (seen.has(contentKey)) continue;
    seen.add(contentKey);

    const name = file.replace(/\.js$/, "");
    icons.push({ name, nodes });
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(icons));

  console.log(`Generated ${icons.length} icons → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
