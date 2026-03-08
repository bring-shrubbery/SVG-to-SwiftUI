/**
 * Build-time script to extract all react-icons icon data into static JSON files.
 * Generates one JSON file per icon set + a manifest file.
 * Run with: bun run scripts/generate-icon-data.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const REACT_ICONS_DIR = join(
  import.meta.dir,
  "../node_modules/react-icons",
);
const OUT_DIR = join(import.meta.dir, "../public/data/icons");

interface IconNode {
  tag: string;
  attr: Record<string, string>;
  child: IconNode[];
}

interface IconData {
  attr: Record<string, string>;
  child: IconNode[];
}

type IconEntry = [string, IconData]; // [displayName, data]

interface ManifestEntry {
  id: string;
  name: string;
  count: number;
}

// Extract the JSON argument from GenIcon(...) using brace counting
function extractGenIconJson(source: string, startIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
    if (depth === 0) return source.slice(startIdx, i + 1);
  }
  return null;
}

// Convert PascalCase function name to kebab-case display name, stripping known prefix
function toDisplayName(funcName: string, prefix: string): string {
  // Strip prefix
  const stripped = funcName.startsWith(prefix) ? funcName.slice(prefix.length) : funcName;
  if (!stripped) return funcName.toLowerCase();

  // PascalCase/camelCase to kebab-case
  return stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

// Known prefixes for each icon set
const SET_PREFIXES: Record<string, string> = {
  ai: "Ai",
  bi: "Bi",
  bs: "Bs",
  cg: "Cg",
  ci: "Ci",
  di: "Di",
  fa: "Fa",
  fa6: "Fa",
  fc: "Fc",
  fi: "Fi",
  gi: "Gi",
  go: "Go",
  gr: "Gr",
  hi: "Hi",
  hi2: "Hi",
  im: "Im",
  io: "Io",
  io5: "Io",
  lia: "Lia",
  lu: "Lu",
  md: "Md",
  pi: "Pi",
  ri: "Ri",
  rx: "Rx",
  si: "Si",
  sl: "Sl",
  tb: "Tb",
  tfi: "Tfi",
  ti: "Ti",
  vsc: "Vsc",
  wi: "Wi",
};

async function processIconSet(setId: string): Promise<{ manifest: ManifestEntry; icons: IconEntry[] } | null> {
  const indexPath = join(REACT_ICONS_DIR, setId, "index.mjs");
  let source: string;
  try {
    source = await readFile(indexPath, "utf-8");
  } catch {
    return null;
  }

  // Read manifest info
  const manifestModule = await import(join(REACT_ICONS_DIR, "lib", "iconsManifest.mjs"));
  const manifestEntry = manifestModule.IconsManifest.find((m: { id: string }) => m.id === setId);
  if (!manifestEntry) return null;

  const prefix = SET_PREFIXES[setId] || setId.charAt(0).toUpperCase() + setId.slice(1);
  const icons: IconEntry[] = [];

  // Find all GenIcon calls
  const funcRegex = /export function (\w+)\s*\(props\)\s*\{\s*return GenIcon\(/g;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(source)) !== null) {
    const funcName = match[1]!;
    const jsonStart = match.index + match[0].length;

    const jsonStr = extractGenIconJson(source, jsonStart);
    if (!jsonStr) continue;

    try {
      const data = JSON.parse(jsonStr) as { tag: string; attr: Record<string, string>; child: IconNode[] };
      const displayName = toDisplayName(funcName, prefix);

      const attr = { ...data.attr };
      // Ensure viewBox is present — icons like VS Code Codicons omit it
      if (!attr.viewBox) {
        attr.viewBox = "0 0 16 16";
      }
      icons.push([displayName, { attr, child: data.child }]);
    } catch {
      // Skip icons with unparseable data
    }
  }

  return {
    manifest: {
      id: setId,
      name: manifestEntry.name,
      count: icons.length,
    },
    icons,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const setIds = Object.keys(SET_PREFIXES);
  const manifest: ManifestEntry[] = [];
  let totalIcons = 0;

  for (const setId of setIds) {
    const result = await processIconSet(setId);
    if (!result) {
      console.log(`  Skipping ${setId} (not found)`);
      continue;
    }

    manifest.push(result.manifest);
    totalIcons += result.icons.length;

    const outFile = join(OUT_DIR, `${setId}.json`);
    await writeFile(outFile, JSON.stringify(result.icons));

    console.log(`  ${setId}: ${result.icons.length} icons`);
  }

  // Sort manifest by name
  manifest.sort((a, b) => a.name.localeCompare(b.name));

  await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nGenerated ${totalIcons} icons across ${manifest.length} sets → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
