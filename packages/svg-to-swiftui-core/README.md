# SVG to SwiftUI Converter Core

[![Build](https://img.shields.io/github/workflow/status/quassummanus/svg-to-swiftui-core/Node.js%20CI)](https://github.com/quassummanus/svg-to-swiftui-core/actions)
[![Version](https://img.shields.io/npm/v/svg-to-swiftui-core.svg)](https://npmjs.org/package/svg-to-swiftui-core)
[![Downloads/month](https://img.shields.io/npm/dm/svg-to-swiftui-core.svg)](https://npmjs.org/package/svg-to-swiftui-core)
[![License](https://img.shields.io/npm/l/svg-to-swiftui-core.svg)](LICENSE.md)

This is the core transpiler code that you can use to convert raw SVG code into native SwiftUI structures for your project.

Single-color SVGs produce a tintable `Shape`. SVGs with multiple supported solid fill or stroke colors automatically produce a layered `View` that preserves those colors and their drawing order. Set `preserveColors: false` to request the legacy single-shape output when the SVG does not require view-only features such as viewport clipping, or `preserveColors: true` to retain the original paint for a single-color SVG. Set `strict: true` to fail conversion when visible SVG content is represented but not supported by the current SwiftUI backend.

### Lengths and viewports

Geometry, strokes, nested viewports, and `<symbol>/<use>` share one typed coordinate resolver. Supported lengths are user units/`px`, `%`, `in`, `cm`, `mm`, `q`, `pt`, `pc`, `em`, `ex`, `ch`, `rem`, `vw`, `vh`, `vmin`, and `vmax`. Absolute units use 96 CSS px per inch. Horizontal, vertical, and “other” percentages use viewport width, height, and normalized diagonal respectively.

Root and nested `viewBox` values support negative origins plus every `preserveAspectRatio` alignment with `meet`, `slice`, or `none`. Nested `<svg>` and instantiated `<symbol>` viewports resolve their own percentages and apply overflow clipping. Select a static `<view>` override with `fragment: "#view-id"`.

When root `width` or `height` is percentage/viewport-relative, pass the containing CSS viewport:

```ts
convert(svg, { outerViewport: { width: 320, height: 180 } });
```

Without `outerViewport`, permissive mode resolves against the valid `viewBox`, or the deterministic 300×150 fallback when no viewBox exists, and records a diagnostic. `strict: true` rejects that fallback. Missing root dimensions are inferred from a valid viewBox. Zero-sized viewports render nothing. Geometry `ex` and `ch` lengths use the resolver’s documented 0.5em fallback metrics.

### Embedded CSS and computed styles

The converter computes one deterministic style for every rendered node. It supports `<style>` rules, presentation attributes, inline `style`, `!important`, specificity, source order, inheritance, CSS-wide keywords, custom properties with nested `var()` fallbacks, cycle detection, and `currentColor`. Geometry properties such as `x`, `y`, `width`, `height`, `rx`, and `d` also participate in the cascade.

Static selectors include universal, type, class, ID, attribute, selector lists, compound selectors, child/descendant/adjacent/general-sibling combinators, `:root`, `:first-child`, `:last-child`, `:nth-child()`, `:not()`, `:is()`, and `:where()`. Dynamic selectors and media-dependent styles are skipped with structured diagnostics because conversion has no browser interaction or media environment.

SVG presentation defaults include SVG 2 properties such as `paint-order`, `mask`, `mask-type`, `mix-blend-mode`, and `isolation`. The SwiftUI backend consumes those properties together with supported paint, geometry, visibility, opacity, stroke, and transform values; other computed properties remain inspectable for later rendering features.

### Painter order and compositing

Rendered children keep SVG document order. `display: none` removes a subtree, while `visibility: hidden` can be overridden by a visible descendant. Fill, stroke, and marker phases use the computed `paint-order`.

Element and group `opacity` are applied once after their children have been painted into an isolated SwiftUI compositing group. Fill and stroke opacity remain independent. The generator intentionally keeps zero-opacity content in its semantic render tree and uses `.compositingGroup()` instead of rasterizing with `.drawingGroup()`.

The render tree also exposes shared painted-bounds queries through `__testing`. Bounds include transforms, stroke extents, and marker shadow content; exclude `display: none`; retain zero-opacity geometry; and intersect nested viewport clips. The filter ticket can extend the same query.

### Advanced strokes

Generated `StrokeStyle` values preserve SVG width, cap, join, miter limit, dash array, and dash offset semantics. Lengths and percentages use the SVG normalized viewport diagonal; odd dash lists repeat, all-zero lists render solid, negative entries are diagnosed, and every subpath restarts its dash pattern. Dashed circles, ellipses, and rectangles use their SVG 2 equivalent-path start point and direction.

`vector-effect="non-scaling-stroke"` transforms the centerline into the complete host coordinate space before SwiftUI constructs its stroke outline, keeping the width constant through nested scale, skew, and rotation transforms. It uses the layered `View` backend even when `preserveColors: false`. SwiftUI cannot represent SVG 2 `miter-clip` or `arcs` joins natively, so they produce structured diagnostics and fall back to `miter`; strict conversion rejects those diagnostics.

### Markers

`marker-start`, `marker-mid`, and `marker-end` resolve typed `<marker>` resources and render their complete child trees at SVG vertices. Placement supports lines, curves, arcs, closed and multiple subpaths, coincident segments, tangent bisectors, `auto`, `auto-start-reverse`, explicit angle units, both `markerUnits` modes, reference points, viewBox mapping, overflow clipping, and transformed hosts/content.

Marker content supports groups, `use`, gradients, patterns, opacity, and solid `context-fill`/`context-stroke` paints. Markers follow `paint-order`, share their host shape's clipping, masking, and opacity, and contribute to painted bounds. Missing, wrong-type, cyclic, and invalid marker references produce structured diagnostics and fail strict conversion.

### Clipping paths

`clip-path: url(#id)` and `<clipPath>` are resolved as typed resources. Generated SwiftUI supports `userSpaceOnUse` and `objectBoundingBox`, resource/target/content transforms, `clip-rule`, groups, `use`, overlapping child unions, nested intersections, empty clips, and clipping on groups and painted shapes.

Clip coverage uses raw geometry only: source fill, stroke, stroke width, paint, and opacity do not affect it. Object bounding boxes likewise use unclipped geometry without stroke, markers, masks, or other effects. Invalid local references apply no clipping and emit a diagnostic; empty, cyclic, or zero-bounds object-box clips render no coverage. Strict conversion rejects every such diagnostic. CSS basic-shape clip paths are diagnosed and deferred.

### Masks, blend modes, and isolation

`mask` definitions are typed resources with the SVG defaults for `maskUnits`, `maskContentUnits`, the expanded `-10%/-10%/120%/120%` region, and luminance interpretation. Generated SwiftUI supports alpha and luminance masks, object-bounding-box and user-space coordinates, region clipping, transforms, nested masks, groups, `use`, gradients, patterns, opacity, empty masks, and structured diagnostics for missing, wrong-type, malformed, or cyclic references.

Luminance masks use an offscreen `Canvas` color matrix with the SVG luminance coefficients and a separate source-alpha pass. This preserves primary-color weights and translucent content instead of approximating the mask with grayscale paint. Effects are emitted in SVG order: viewport/clip effects, mask, post-group opacity, then blend/composite.

All Compositing Level 1 `mix-blend-mode` values map to native SwiftUI blend modes: `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, and `luminosity`. `isolation: isolate`, masks, non-normal blending, and group opacity create explicit compositing boundaries. The generated backend requires SwiftUI `Canvas` support (iOS 15, macOS 12, tvOS 15, and watchOS 8 or newer); no older-platform fallback is emitted.

### Static filter graphs

Local `filter: url(#id)` references resolve into typed, target-specific directed graphs. The common runtime supports `feGaussianBlur`, `feOffset`, `feFlood`, `feMerge`/`feMergeNode`, and `feDropShadow`, including named `result` branches, default inputs, `SourceGraphic`, `SourceAlpha`, `FillPaint`, `StrokePaint`, href inheritance, both filter/primitive unit systems, primitive subregions, filter-region clipping, transforms, and `sRGB`/`linearRGB` processing. Unsupported background inputs resolve to transparent black with a diagnostic.

Color and compositing nodes support all 16 `feBlend` modes; `feColorMatrix` matrix, saturate, hue rotation, and luminance-to-alpha forms; every `feComponentTransfer` function for RGBA; and all Porter-Duff plus arithmetic `feComposite` operators. Their CPU implementation follows Filter Effects and Compositing Level 1 formulas with safe temporary unpremultiplication, output clamping, and re-premultiplication. Empty tables, exact table/discrete boundaries, missing transfer channels, malformed lists, invalid enums, transparent pixels, and arithmetic coefficients have deterministic tested behavior rather than native-framework-dependent fallbacks.

Spatial and generated-image nodes support `feConvolveMatrix`, `feMorphology`, `feDisplacementMap`, `feTile`, `feTurbulence`, and `feImage`. This includes kernel targets/divisors/edge modes, anisotropic and fractional radii, channel-selected displacement, fractional tile regions, deterministic seeded and stitched noise, embedded raster data, resolved SVG documents, and local fragment `<use>` semantics with `preserveAspectRatio`. Generated code never fetches resources at runtime. Configurable kernel, octave, output-pixel, resource-byte, and nesting limits bound conversion and rendering work.

Lighting nodes support `feDiffuseLighting` and `feSpecularLighting` with `feDistantLight`, `fePointLight`, and `feSpotLight`. The generated runtime implements SVG surface normals for interior, edge, and corner pixels; `kernelUnitLength`; spotlight cones; `lighting-color`/`currentColor`; primitive units and transforms; and the required diffuse/specular alpha behavior.

Generated Swift uses the same deterministic premultiplied-RGBA image-buffer runtime as the visual regression host. Source vector commands are rasterized only at app render time and at the active display scale; conversion never snapshots the full SVG. Filters run before viewport/clip paths, masks, element opacity, and blending, and their regions contribute to reported painted bounds. Unsupported primitives remain typed pass-through graph nodes with diagnostics until their dedicated tickets land.

### Linear and radial gradients

`linearGradient`, `radialGradient`, and `stop` definitions are resolved as typed paint resources for fills and strokes. The resolver supports `objectBoundingBox` and `userSpaceOnUse`, percentage or length coordinates, `gradientTransform`, `pad`/`reflect`/`repeat`, `href` and `xlink:href` inheritance, local stop replacement, focal circles, CSS-styled stops, `currentColor`, alpha, and fallback paints.

Gradient layers remain vector output. Generated SwiftUI uses `Canvas` to clip a Core Graphics axial or radial gradient to the native generated path; it does not rasterize the SVG during conversion. Affine gradient transforms are composed before element and ancestor transforms. Degenerate object bounding boxes deterministically paint nothing, as required for a valid paint server that cannot produce paint.

Color stops are sampled in unpremultiplied SVG color space before Core Graphics draws them. `color-interpolation: sRGB`/`auto` uses sRGB channel interpolation; `linearRGB` applies the standard sRGB transfer functions, interpolates linear-light channels, then encodes back to sRGB. Sampling uses 256 intervals per spread period, which keeps Core Graphics interpolation within the RGBA harness tolerance while supporting repeat and reflect without whole-image rasterization.

### Pattern paint servers

`pattern` definitions are resolved as typed fill and stroke resources. The resolver supports `patternUnits`, `patternContentUnits`, `viewBox`/`preserveAspectRatio`, `patternTransform`, `href` and `xlink:href` inheritance, local content replacement, nested patterns, groups, `use`, gradients, alpha, and diagnostics for invalid dimensions or cyclic references.

Generated SwiftUI keeps pattern content vector-based in `Canvas`. It repeats compound paths without tile seams, clips overflowing content to each tile, preserves fractional origins at different display scales, and resolves object-bounding-box patterns against each painted shape.

### Static text and fonts

`<text>`, nested `<tspan>`, and `<textPath>` content uses CoreText glyph paths inside a scalable SwiftUI `Canvas`. CoreText performs shaping and bidi reordering while the SVG layout layer applies grapheme-safe `x`/`y`/`dx`/`dy`/`rotate` lists, nested `textLength` constraints, horizontal and vertical writing modes, anchors, baselines, spacing, decorations, transforms, paint, and one accessibility label. Text paths support local paths and basic shapes, transformed references, `pathLength`, `startOffset`, `method`, `spacing`, `side`, open/closed paths, multiple subpaths, and deterministic adaptive curve metrics. Glyph outlines are not selectable text.

Configure the same registered families in the conversion host and generated app:

```ts
convert(svg, {
  fonts: {
    availableFamilies: ["Poppins"],
    substitutions: { Inter: "Poppins" },
    fallbackFamily: "Poppins",
    strict: true,
  },
});
```

Permissive lookup emits a structured `missing-font-family` warning and uses the configured fallback. Font-strict lookup fails conversion. Missing, external, wrong-type, empty, and cyclic text-path references produce structured diagnostics.

### Static images and deterministic resources

`<image>` supports PNG, JPEG, WebP, the first GIF frame, and recursively converted SVG documents. It preserves `href`/`xlink:href`, intrinsic or explicit sizing, every `preserveAspectRatio` mode, viewport clipping, transforms, opacity, clip paths, masks, blend modes, and `image-rendering`. Raster bytes are embedded in generated Swift and decoded from `Data` with ImageIO; generated views never perform network or filesystem access.

Data URLs work without configuration. The default `embeddedOnly` policy rejects every external URL and never invokes a resolver. Callers can also provide deterministic bytes directly:

```ts
const result = convertWithDiagnostics(svg, {
  resources: {
    supplied: {
      "avatar.png": { bytes: avatarBytes, mimeType: "image/png" },
    },
  },
});
```

Use `policy: "local"` with an approved `baseDirectory` and a resolver that reads the validated `request.canonicalURL`. Absolute paths and traversal outside that directory are rejected before the callback. Use `policy: "custom"` for caller-owned package, database, or optional network loading; the core has no built-in network client. `baseURL` scopes relative URLs, including resources inside external SVG images.

Resolvers receive the raw/canonical URL, base URL, resource kind, source element/id, and active limits. They return bytes plus MIME/canonical metadata, or an `assetName` and intrinsic dimensions for an app-owned raster asset. Promise-based resolvers require `convertAsync()` or `convertAsyncWithDiagnostics()`; sync conversion records `async-resource-in-sync-convert`. `convertWithDiagnostics()` is the sync API for inspecting permissive resource failures.

Default safety limits are 5 MiB per resource, 16 million decoded pixels per image, 20 MiB total, 128 resources, and eight nested SVG images. Override them under `resources.limits`. MIME signatures, dimensions, aggregate size, cycles, data URL encoding/charset, and nested depth are validated before Swift generation.

### Static foreignObject snapshots

`<foreignObject>` is preserved through an explicit conversion-time RGBA snapshot. The core recognizes and models the element but does not bundle a browser. Use async conversion with the official pinned Chromium adapter:

```ts
import { convertAsync } from "svg-to-swiftui-core";
import { createPlaywrightForeignObjectRenderer } from "@svg-to-swiftui/playwright";

const swift = await convertAsync(svg, {
  foreignObjectRenderer: createPlaywrightForeignObjectRenderer(),
  foreignObjects: { scale: 2 },
});
```

The core builds an isolated document, removes scripts, event handlers, navigation, active embeds, imports, keyframes, and unsafe URL schemes, adds a CSP/reset, and carries inherited SVG font/color/text styles into the foreign viewport. The official adapter additionally disables JavaScript and service workers and blocks every browser request unless `resources` resolves it. Approved images, fonts, and CSS use the same byte/count policy as SVG images.

Snapshots preserve transparent backgrounds, exact x/y/width/height, transforms, viewport clipping, opacity, clip paths, masks, filters, blend modes, and a text/ARIA accessibility label. Without an adapter, permissive conversion emits a typed omission diagnostic; strict conversion fails. Content is static at the requested bounded scale (default 1, default maximum 4, hard maximum 8), not infinitely scalable HTML.

Normal `convertAsync()` embeds PNG bytes. For large snapshots, use `convertAsyncWithArtifacts()` and `foreignObjects.inlineByteLimit`; its result contains Swift source plus deterministic content-addressed PNG assets for the generated app target.

### Accessibility and conditional processing

Static accessibility follows SVG-AAM naming precedence for `aria-labelledby`, `aria-label`, `<title>`, `<desc>`, and meaningful text. Multiple ID references, inherited `aria-hidden`, roles, and `lang`/`xml:lang` localized descriptive elements are resolved onto the closest generated SwiftUI view. Names use `.accessibilityLabel`, descriptions use `.accessibilityHint`, and recognized roles add matching traits. Named document/group containers retain their accessible children. Accessibility metadata automatically selects the `View` backend so the single-shape fast path cannot discard it. Broken or cyclic ARIA references produce structured diagnostics; `<title>`, `<desc>`, and `<metadata>` never draw pixels.

`<switch>` and conditional attributes use an explicit static environment instead of the machine locale:

```ts
convert(svg, {
  staticEnvironment: {
    preferredLanguages: ["lt-LT", "en"],
    accessibilityLocale: "lt-LT",
    supportedExtensions: ["https://example.com/svg/extension"],
    svgVersion: "1.1",
    supportedFeatures: ["http://www.w3.org/TR/SVG11/feature#Shape"],
  },
});
```

Children are checked in document order. `requiredExtensions` requires every listed identifier, and `systemLanguage` uses BCP 47 prefix matching. Unknown extensions and SVG 1.1 features are unsupported. SVG 2 treats obsolete `requiredFeatures` as non-blocking and reports a diagnostic. Conditional attributes outside `<switch>` also suppress unmatched content, including referenced resources.

## Before we start

This package is written for JavaScript projects, so it's only meant to be used in a Node.js projects. If you just need to convert an SVG to SwiftUI Shape you should use [this tool](https://github.com/bring-shrubbery/SVG-to-SwiftUI).

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Installing

All you need to do is to add this package to your project using following command:

`npm i svg-to-swiftui-core`

and then import into your project (ES6):

`import { convert } from 'svg-to-swiftui-core'`

## Running the tests

You can run the tests by running following command:

`npm test`

### Visual regression tests

The macOS visual harness compiles the generated declaration with real SwiftUI and compares its full transparent RGBA output against the original SVG. It uses resvg for the general corpus, WebKit for blend/isolation and vector-effect fixtures, and Firefox for SVG marker fixtures including context paint. Every fixture is declared in `visual-tests/fixture-manifest.json` with an exact logical size, scale, output mode, deterministic fonts, feature tags, and channel tolerances.

```sh
bun run visual-test                              # full macOS corpus
bun run visual-test -- --fixture harness-shape  # one fixture/name substring
bun run visual-test -- --tag opacity            # one feature family
bun run visual-test -- --changed                # changed fixture SVGs
bun run visual-test -- --fresh                  # ignore render caches
bun run visual-test:verify                       # manifest + codegen integrity (all platforms)
bun run --filter svg-to-swiftui-core visual-test:update-manifest
```

Reference caches are content-addressed from SVG bytes and render options. Swift caches include generated code and renderer options, so stale images cannot produce a false pass. Failures print reference, SwiftUI, and diff PNG paths plus RGB/alpha metrics.

The default antialiasing allowance is 24/255 per channel, at most 3% pixels outside that allowance, and mean premultiplied RGB/alpha error no greater than 3/255. These limits accommodate resvg/CoreGraphics edge rasterization differences while still rejecting solid-color, layer-order, and opacity errors. Fixture-specific overrides must keep every channel enabled and include a reason in the manifest.

## Roadmap

- [x] SVG `<path>` element
  - [x] Line commands
    - [x] `M`
    - [x] `m`
    - [x] `L`
    - [x] `l`
    - [x] `H`
    - [x] `h`
    - [x] `V`
    - [x] `v`
    - [x] `Z`
    - [x] `z`
  - [x] Curve commands (`C`, `S`, `Q`, `T`, `A`, absolute and relative)
- [x] SVG `<circle>` element
- [x] SVG `<rect>` element
- [x] SVG `<ellipse>` element
- [x] SVG `<line>` element
- [x] SVG `<polygon>` element
- [x] SVG `<polyline>` element
- [x] SVG `<g>` and `<a>` containers
- [x] SVG `<switch>` fallbacks
- [x] SVG `<defs>`, `<symbol>`, and local `<use>` references
- [x] SVG lengths, nested viewports, `<view>` fragments, and `preserveAspectRatio`
- [x] SVG transforms (`matrix`, `translate`, `scale`, `rotate`, `skewX`, `skewY`)
- [x] Solid fill/stroke styling with colours
- [x] Advanced strokes: caps, joins, miter limits, dashes, offsets, units, and non-scaling strokes
- [x] Linear/radial gradient fills and strokes, stops, inheritance, transforms, and spread methods
- [x] Pattern fills and strokes, inheritance, coordinate systems, transforms, viewBox behavior, and vector tiling
- [x] SVG clipping paths, clip rules, coordinate systems, transforms, unions, and nested intersections
- [x] SVG masks, Level 1 blend modes, group compositing, and isolation
- [x] SVG markers, vertex placement, orientation, units, context paint, viewports, and painter order
- [x] Static filter graphs, color/compositing, convolution, morphology, displacement, tiling, turbulence, filter images, and diffuse/specular lighting
- [x] Embedded CSS cascade, custom properties, and computed presentation styles
- [x] Basic static SVG `<text>` and `<tspan>` rendering
- [x] Static SVG `<image>` rendering with deterministic raster/SVG resource resolution
- [x] Advanced SVG text positioning, bidi/vertical layout, `textLength`, and `<textPath>`
- [x] Static SVG `<foreignObject>` rendering through secure conversion-time snapshots
- [ ] Automatic animation support

## Built With

This project relies on following npm packages:

- [svg-parser](https://github.com/Rich-Harris/svg-parser) - Parses raw SVG into a HAST (Hypertext Abstract Syntaxt Tree).
- [svg-pathdata](https://github.com/nfroidure/svg-pathdata) - Parses svg path `d` attribute into a list of easily interpretable objects.

## Contributing

Feel free to open an issue if your SVG file doesn't work or send a PR with our suggested changes!

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/quassummanus/svg-to-swiftui-core/tags).

## Authors

- **Antoni Silvestrovic** - _Initial work_ - [bring-shrubbery](https://github.com/bring-shrubbery)

See also the list of [contributors](https://github.com/quassummanus/svg-to-swiftui-core/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
