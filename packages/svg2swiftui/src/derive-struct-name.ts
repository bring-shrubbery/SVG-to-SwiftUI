import path from "node:path";

const FALLBACK = "SVGShape";

export function deriveStructName(outputPath: string): string {
  const ext = path.extname(outputPath);
  const base = path.basename(outputPath, ext);

  const segments = base.split(/[^A-Za-z0-9]+/).filter((s) => s.length > 0);
  if (segments.length === 0) return FALLBACK;

  const joined = segments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");

  if (/^[0-9]/.test(joined)) return FALLBACK;

  return joined;
}
