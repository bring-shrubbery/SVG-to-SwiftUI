# svg2swiftui

## 0.2.2

### Patch Changes

- Fix broken `svg-to-swiftui-core` dependency. Previous releases (0.2.0 and 0.2.1) shipped with `"svg-to-swiftui-core": "workspace:*"` in their published manifest because `changeset publish` uses `npm publish` under the hood, which does not resolve the workspace protocol. Installing those versions failed with `EUNSUPPORTEDPROTOCOL`. The dep now uses a literal `^0.4.0` range; bun still links the local workspace package during development.

## 0.2.1

### Patch Changes

- Updated dependencies
  - svg-to-swiftui-core@0.4.0

## 0.2.0

### Minor Changes

- 597eb2a: Initial release of `svg2swiftui`, a CLI for converting SVG files into SwiftUI `Shape` structs. Usage: `npx svg2swiftui ./icon.svg ./Icon.swift`. Supports `--struct-name`, `--precision`, `--indentation`, and `--usage-comment` flags.
