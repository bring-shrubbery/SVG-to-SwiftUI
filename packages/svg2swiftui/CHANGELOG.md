# svg2swiftui

## 0.2.3

### Patch Changes

- Updated dependencies [aa721f2]
- Updated dependencies [5071ffa]
- Updated dependencies [7985ec5]
- Updated dependencies [67c1bb3]
- Updated dependencies [3d35be0]
- Updated dependencies [cf933c3]
- Updated dependencies [6f79927]
- Updated dependencies [8a1ae21]
- Updated dependencies [af7dd25]
- Updated dependencies [53221c8]
- Updated dependencies [92c2034]
- Updated dependencies [2920ae8]
- Updated dependencies [54f7f49]
- Updated dependencies [0390677]
- Updated dependencies [60cbeda]
- Updated dependencies [93655a0]
- Updated dependencies [9c5db60]
- Updated dependencies [f37d304]
- Updated dependencies [7139560]
- Updated dependencies [fc47ee0]
  - svg-to-swiftui-core@0.5.0

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
