export const QUASSUM_URL = "https://www.quassum.com";

const FOOTER_UTM = "utm_source=svg-to-swiftui&utm_medium=footer&utm_campaign=quassum-footer";

/** Appends the footer UTM parameters to an outbound URL. */
export function withFooterUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${FOOTER_UTM}`;
}

/** Sibling Quassum products shown in the footer and in llms.txt. Names and taglines mirror the Quassum catalog. */
export const SIBLING_PRODUCTS = [
  {
    name: "Lucide Icons for SwiftUI",
    tagline: "More than 1,700 Lucide icons as native SwiftUI shapes.",
    href: "https://github.com/bring-shrubbery/lucide-swift",
  },
  {
    name: "Web3 Icons for SwiftUI",
    tagline: "More than 1,800 Web3 icons, native to SwiftUI.",
    href: "https://github.com/bring-shrubbery/web3icons-swift",
  },
  {
    name: "Squircle.JS",
    tagline: "Apple-style squircles for React, Vue, Svelte, and Solid.",
    href: "https://squircle.js.org",
  },
] as const;

/** Quassum's Figma plugin; href from the Quassum catalog. */
export const FIGMA_PLUGIN = {
  name: "SwiftUI Generator for Figma",
  tagline: "Turn Figma vector shapes into SwiftUI code.",
  href: "https://www.figma.com/community/plugin/1286775547400510368/SwiftUI-Code-Generator",
} as const;
