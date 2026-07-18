# svg-to-swiftui-core

## Unreleased

### Minor Changes

- Add secure async `<foreignObject>` snapshot rendering, deterministic artifacts, diagnostics, compositing, and accessibility metadata.
- Add static `<image>` rendering for PNG, JPEG, WebP, first-frame GIF, and recursively scoped SVG resources.
- Add deterministic embedded/local/custom resource policies, sync and async conversion APIs, structured diagnostics, traversal/cycle protection, and configurable byte/pixel/count/depth limits.
- Embed resolved raster bytes or generated-app asset references in SwiftUI output so generated views perform no ambient I/O.
- Add 1×/2×/3× RGBA fixtures that compile generated SwiftUI and compare data URLs, raster formats, SVG subdocuments, aspect-ratio modes, transforms, clipping, masks, opacity, and blending with the original SVG.

## 0.4.0

### Minor Changes

- Release the backlog of unreleased compiler work:
  - Add `polyline` and `polygon` element support
  - Normalize path winding to clockwise (`ensureDominantCW`) so filled paths render correctly regardless of input direction; preserves relative winding of internal holes
  - Stroke direction handling via new `cwStrokedPath` / `ccwStrokedPath` SwiftUI helpers so dark strokes don't accidentally create holes and light strokes do
  - Pre-scan SVG tree for fills with style inheritance (`hasFills`) to drive the winding-normalization decision
  - Add `templates` module exposing `createUsageCommentTemplate`, `createFunctionTemplate`, and `createStructTemplate`
  - Support a usage-comment prefix in the generated output
  - Expand `pathElementHandler` coverage and simplify commands via svg-pathdata `normalizeHVZ` / `normalizeST` / `aToC` before analysis
  - Verified against 1765 SVGs (62 custom + 1703 Lucide) at 99.95% average pixel accuracy

## 0.3.5

### Patch Changes

- eeba9561: Automation test #5

## 0.3.4

### Patch Changes

- 1cc440e2: Automation test #4

## 0.3.3

### Patch Changes

- 7f0f80b8: Automation test #3

## 0.3.2

### Patch Changes

- 100e908f: Automation test #2

## 0.3.1

### Patch Changes

- 71f2d76: Automated release check

## 0.3.0

### Minor Changes

- No changes
