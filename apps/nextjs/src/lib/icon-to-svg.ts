/**
 * Reconstructs an SVG string from react-icons icon data (tree format).
 */

interface IconNode {
  tag: string;
  attr: Record<string, string>;
  child: IconNode[];
}

interface IconData {
  attr: Record<string, string>;
  child: IconNode[];
}

// React camelCase → SVG kebab-case attribute mapping
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
  const attrStr = node.attr ? ` ${attrToString(node.attr)}` : "";
  if (!node.child || node.child.length === 0) {
    return `${indent}<${node.tag}${attrStr} />`;
  }
  const children = node.child.map((c) => nodeToSvg(c, `${indent}  `)).join("\n");
  return `${indent}<${node.tag}${attrStr}>\n${children}\n${indent}</${node.tag}>`;
}

export function iconDataToSvg(data: IconData): string {
  const svgAttr = { ...data.attr };
  // Ensure xmlns is present
  if (!svgAttr.xmlns) svgAttr.xmlns = "http://www.w3.org/2000/svg";

  const attrStr = attrToString(svgAttr);
  const children = data.child.map((c) => nodeToSvg(c, "  ")).join("\n");

  return `<svg ${attrStr}>\n${children}\n</svg>`;
}
