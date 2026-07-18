# @svg-to-swiftui/playwright

Official conversion-time Chromium renderer for static SVG `<foreignObject>` snapshots.

```sh
bun add svg-to-swiftui-core @svg-to-swiftui/playwright
bunx playwright install chromium
```

```ts
import { convertAsync } from "svg-to-swiftui-core";
import { createPlaywrightForeignObjectRenderer } from "@svg-to-swiftui/playwright";

const swift = await convertAsync(svg, {
  foreignObjectRenderer: createPlaywrightForeignObjectRenderer(),
  foreignObjects: { scale: 2 },
});
```

The adapter disables JavaScript and service workers, blocks unresolved network requests, uses the core resource resolver for approved images/fonts/CSS, applies a CSP, and returns transparent RGBA pixels. Snapshots are static at the configured scale; they are not infinitely scalable HTML.
