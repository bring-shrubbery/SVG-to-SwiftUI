# SVG to SwiftUI Converter Core

[![Build](https://img.shields.io/github/workflow/status/quassummanus/svg-to-swiftui-core/Node.js%20CI)](https://github.com/quassummanus/svg-to-swiftui-core/actions)
[![Version](https://img.shields.io/npm/v/svg-to-swiftui-core.svg)](https://npmjs.org/package/svg-to-swiftui-core)
[![Downloads/month](https://img.shields.io/npm/dm/svg-to-swiftui-core.svg)](https://npmjs.org/package/svg-to-swiftui-core)
[![License](https://img.shields.io/npm/l/svg-to-swiftui-core.svg)](LICENSE.md)

This is the core transpiler code that you can use to convert raw SVG code into native SwiftUI structures for your project.

Single-color SVGs produce a tintable `Shape`. SVGs with multiple supported solid fill or stroke colors automatically produce a layered `View` that preserves those colors and their drawing order. Set `preserveColors: false` to force the legacy single-shape output, or `preserveColors: true` to retain the original paint for a single-color SVG.

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
- [x] SVG transforms (`matrix`, `translate`, `scale`, `rotate`, `skewX`, `skewY`)
- [x] Solid fill/stroke styling with colours
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
