/**
 * Reconstructs an SVG string from Lucide icon node data.
 */
export function iconNodesToSvg(
  nodes: [string, Record<string, string>][],
): string {
  const children = nodes
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `  <${tag} ${attrStr} />`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${children}\n</svg>`;
}
