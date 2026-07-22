# svg-to-swiftui-core

## 0.5.0

### Minor Changes

- aa721f2: Preserve solid fill and stroke colors by generating layered SwiftUI views for multicolor SVGs.
- 7985ec5: Preserve SVG-AAM accessibility semantics in generated SwiftUI and resolve switch and conditional-processing attributes deterministically through an explicit static environment.
- 67c1bb3: Render SVG dash arrays and offsets, validated caps, joins, and miter limits, percentage and physical-unit stroke values, non-scaling strokes, SVG-equivalent dashed basic shapes, and transform-aware painted bounds with browser-matched RGBA coverage.
- 3d35be0: Render typed SVG clipping paths with clip rules, user-space and object-bounding-box coordinates, transforms, nested intersections, diagnostics, and browser-matched RGBA regression coverage.
- cf933c3: Preserve SVG painter order, display and visibility semantics, independent paint opacity, isolated element and group opacity, explicit isolation, and transformed painted bounds in generated SwiftUI views.
- 6f79927: Add the versioned SVG2 static conformance matrix, detailed conversion APIs, stable source-located diagnostics, complete dynamic-content reporting, release gates, and generated conformance report.
- 8a1ae21: Add standards-based embedded CSS parsing, selector matching, cascade and inheritance, custom properties, computed SVG 2 presentation styles, CSS geometry, paint order, diagnostics, and visual regression coverage.
- af7dd25: Add exact static SVG filter color and compositing support for all `feBlend` modes, every `feColorMatrix` form, all `feComponentTransfer` functions, and Porter-Duff plus arithmetic `feComposite` operators. Generated SwiftUI uses deterministic premultiplied CPU RGBA math with sRGB/linearRGB processing, structured malformed-value diagnostics, numeric reference tests, and full-RGBA visual grids.
- 53221c8: Add typed SVG filter graphs and a generated premultiplied RGBA runtime for Gaussian blur, offset, flood, merge, and drop-shadow primitives.
- 92c2034: Render SVG diffuse and specular lighting with distant, point, and spot light sources, exact surface normals, primitive-unit coordinates, transforms, color-space handling, and deterministic diagnostics.
- 2920ae8: Add static SVG support for `feConvolveMatrix`, `feMorphology`, `feDisplacementMap`, `feTile`, `feTurbulence`, and `feImage`. The typed graph and generated SwiftUI runtime now cover spatial sampling, deterministic seeded noise, local/raster/SVG image inputs, safety limits, structured diagnostics, numeric reference tests, and full-RGBA visual comparisons.
- 54f7f49: Render static SVG foreignObject content through a secure conversion-time RGBA snapshot adapter, with deterministic binary artifacts, resource sandboxing, placement, compositing, accessibility, and browser-matched visual coverage. Add the official pinned Playwright Chromium adapter as a separate package.
- 0390677: Render SVG linear and radial gradient paint servers with typed inheritance, CSS stops, coordinate systems, transforms, spread methods, focal circles, fallbacks, explicit color interpolation, and deterministic vector-backed SwiftUI Canvas output.
- 60cbeda: Render complete SVG marker shadow trees for marker-start, marker-mid, and marker-end with spec-accurate vertex tangents, orientation, units, reference points, viewBox mapping, overflow, context paint, paint order, effects, diagnostics, and painted bounds.
- 93655a0: Render typed SVG alpha and luminance masks, all Level 1 blend modes, isolation, and ordered group compositing with browser-accurate RGBA regression coverage.
- 9c5db60: Render SVG pattern paint servers as typed, inherited, vector-backed SwiftUI Canvas tiles with coordinate-system, transform, viewBox, clipping, nesting, alpha, fill, stroke, and cycle-diagnostic support.
- f37d304: Add standards-based SVG length resolution, root and nested viewports, complete preserveAspectRatio mapping, symbol/use viewport sizing, static view fragments, and overflow clipping.
- fc47ee0: Generate tintable shapes and layered views from one typed SVG render tree, with deterministic capability analysis and strict diagnostics for unsupported content.

### Patch Changes

- 5071ffa: Upgrade visual regression coverage to compile real SwiftUI Shape and View output and compare deterministic full RGBA renders.
- 7139560: Apply SVG element and group transforms to generated SwiftUI paths.

## Unreleased

### Minor Changes

- Preserve SVG accessibility names, descriptions, hidden state, and roles in generated SwiftUI, and add deterministic static `<switch>`/conditional processing through an explicit environment.
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
