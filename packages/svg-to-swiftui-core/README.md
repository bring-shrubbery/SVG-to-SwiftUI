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

Without `outerViewport`, permissive mode resolves against the valid `viewBox`, or the deterministic 300×150 fallback when no viewBox exists, and records a diagnostic. `strict: true` rejects that fallback. Missing root dimensions are inferred from a valid viewBox. Zero-sized viewports render nothing. Until deterministic font loading lands with text rendering, `ex` and `ch` use the resolver’s documented 0.5em fallback metrics.

### Embedded CSS and computed styles

The converter computes one deterministic style for every rendered node. It supports `<style>` rules, presentation attributes, inline `style`, `!important`, specificity, source order, inheritance, CSS-wide keywords, custom properties with nested `var()` fallbacks, cycle detection, and `currentColor`. Geometry properties such as `x`, `y`, `width`, `height`, `rx`, and `d` also participate in the cascade.

Static selectors include universal, type, class, ID, attribute, selector lists, compound selectors, child/descendant/adjacent/general-sibling combinators, `:root`, `:first-child`, `:last-child`, `:nth-child()`, `:not()`, `:is()`, and `:where()`. Dynamic selectors and media-dependent styles are skipped with structured diagnostics because conversion has no browser interaction or media environment.

SVG presentation defaults include SVG 2 properties such as `paint-order`, `mix-blend-mode`, and `isolation`. The SwiftUI backend currently consumes supported paint, geometry, visibility, opacity, stroke, transform, and paint-order values; other computed properties remain inspectable for later rendering features.

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

The macOS visual harness compiles the generated declaration with real SwiftUI and compares its full transparent RGBA output against resvg. Every fixture is declared in `visual-tests/fixture-manifest.json` with an exact logical size, scale, output mode, deterministic fonts, feature tags, and channel tolerances.

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
- [x] Embedded CSS cascade, custom properties, and computed presentation styles
- [ ] SVG `<text>` element
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
