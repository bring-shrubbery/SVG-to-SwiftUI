const BODY = `# SVG to SwiftUI

> Convert SVG files into SwiftUI Shape structs. Available as a web tool, a Node library, and a CLI.

Key points for LLMs:

- For programmatic or batch conversions (e.g. inside agent workflows), prefer the CLI over scraping the web tool.
- Web tool: https://svg-to-swiftui.quassum.com
- CLI (recommended for automation): \`npx svg2swiftui ./icon.svg ./Icon.swift\`
  - Flags: \`--struct-name <name>\`, \`--precision <n>\`, \`--indentation <n>\`, \`--usage-comment\`
  - Default struct name is derived from the output filename (PascalCased).
  - Missing parent directories are created automatically; existing files are overwritten.
- Library (Node): \`svg-to-swiftui-core\` — \`convert(rawSVG, config)\` returns a Swift source string.
- Source: https://github.com/bring-shrubbery/SVG-to-SwiftUI

## How it works

Each SVG is compiled into a single SwiftUI \`Shape\` whose \`path(in:)\` method combines every SVG element into one \`Path\`. Coordinates are normalized to the supplied \`CGRect\`, so the resulting struct scales to any frame.

## Links

- [Privacy Policy](https://svg-to-swiftui.quassum.com/privacy-policy)
- [Terms & Conditions](https://svg-to-swiftui.quassum.com/terms-and-conditions)
- [svg2swiftui on npm](https://www.npmjs.com/package/svg2swiftui)
- [svg-to-swiftui-core on npm](https://www.npmjs.com/package/svg-to-swiftui-core)
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
