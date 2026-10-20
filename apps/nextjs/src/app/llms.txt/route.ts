import { ICON_PACK_ARTICLES } from "@/lib/icon-pack-articles";
import { FIGMA_PLUGIN, QUASSUM_URL, SIBLING_PRODUCTS, withFooterUtm } from "@/lib/quassum";

const SITE_URL = "https://svg-to-swiftui.quassum.com";

const iconPackLines = ICON_PACK_ARTICLES.map(
  (article) =>
    `- [How to Use ${article.name} in SwiftUI & iOS](${SITE_URL}/icons/${article.slug}): ${article.blurb} Convert any icon from ${article.name} into a native SwiftUI Shape (${article.count.toLocaleString("en-US")} icons, ${article.license}).`,
).join("\n");

const siblingLines = SIBLING_PRODUCTS.map(
  (product) => `- [${product.name}](${withFooterUtm(product.href)}): ${product.tagline}`,
).join("\n");

const BODY = `# SVG to SwiftUI Converter

> Free, open-source tool that converts SVG code into native SwiftUI Shape structs, entirely in your browser.

SVG to SwiftUI Converter turns any SVG icon or vector graphic into a native SwiftUI Shape. Paste the SVG source code or upload an .svg file and the tool outputs a Swift struct conforming to Shape with a single path(in:) implementation: every SVG element is combined into one Path, expressed relative to the view's rect, so the shape scales to any frame on iPhone, iPad, and Mac. SwiftUI's Image view supports PNG, JPEG, PDF, and SF Symbols but not raw SVG files, which is why converting to a Shape is the native way to display an SVG in SwiftUI. The conversion runs entirely in your browser, nothing is uploaded and your SVG code never leaves your device. The tool is free to use and open source under the MIT license.

## Key pages

- [SVG to SwiftUI Converter](${SITE_URL}/): paste or upload an SVG, press Convert & Copy, and paste the generated SwiftUI Shape into Xcode. The Examples browser holds ready-to-convert icons from popular icon packs.
- [How to Convert SVG to SwiftUI](${SITE_URL}/convert-svg-to-swiftui): step-by-step guide covering why SwiftUI has no native SVG support, how the conversion works, and an example Shape.
${iconPackLines}
- [GitHub repository](https://github.com/bring-shrubbery/SVG-to-SwiftUI): source code, issues, and pull requests. MIT licensed.

## CLI and library

- CLI: \`npx svg2swiftui ./icon.svg ./Icon.swift\`. Flags: \`--struct-name <name>\`, \`--precision <n>\`, \`--indentation <n>\`, \`--usage-comment\`. The default struct name is derived from the output filename (PascalCased). For programmatic or batch conversions, prefer the CLI over scraping the web tool.
- Library (Node): \`svg-to-swiftui-core\`, \`convert(rawSVG, config)\` returns a Swift source string.
- [svg2swiftui on npm](https://www.npmjs.com/package/svg2swiftui)
- [svg-to-swiftui-core on npm](https://www.npmjs.com/package/svg-to-swiftui-core)

## Figma plugin

- [${FIGMA_PLUGIN.name}](${FIGMA_PLUGIN.href}): ${FIGMA_PLUGIN.tagline} Generate SwiftUI Shape code from any Figma vector without translating paths by hand.

## Built by Quassum

SVG to SwiftUI is built by [Quassum](${withFooterUtm(QUASSUM_URL)}), a product studio in Vilnius that has shipped 25+ products. More from Quassum:

${siblingLines}

## Other

- [Privacy Policy](${SITE_URL}/privacy-policy)
- [Terms & Conditions](${SITE_URL}/terms-and-conditions)
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
