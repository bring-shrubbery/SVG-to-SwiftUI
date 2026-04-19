# svg2swiftui

[![Version](https://img.shields.io/npm/v/svg2swiftui.svg)](https://npmjs.org/package/svg2swiftui)
[![Downloads/month](https://img.shields.io/npm/dm/svg2swiftui.svg)](https://npmjs.org/package/svg2swiftui)
[![License](https://img.shields.io/npm/l/svg2swiftui.svg)](LICENSE.md)

Command-line tool for converting an SVG file into a SwiftUI `Shape` struct.

No install required — run it via `npx`:

```sh
npx svg2swiftui ./icon.svg ./Icon.swift
```

Powered by [`svg-to-swiftui-core`](https://npmjs.org/package/svg-to-swiftui-core). For the web UI, see [SVG to SwiftUI](https://svg-to-swiftui.quassum.com).

## Usage

```
svg2swiftui <input> <output> [options]
```

By default, the output struct name is derived from the output filename (PascalCased, non-alphanumerics stripped). For example, `my-icon.swift` produces `struct MyIcon: Shape`.

### Options

| Flag | Default | Description |
|---|---|---|
| `--struct-name <name>` | derived from output filename | SwiftUI struct name. |
| `--precision <n>` | `10` | Decimal precision for path coordinates. |
| `--indentation <n>` | `4` | Indentation width in spaces. |
| `--usage-comment` | off | Prepend a SwiftUI usage example as a leading comment. |
| `-h, --help` | | Print help. |
| `-V, --version` | | Print version. |

### Examples

Convert with all defaults:

```sh
npx svg2swiftui ./heart.svg ./Heart.swift
```

Override the struct name and bump precision:

```sh
npx svg2swiftui ./heart.svg ./Heart.swift --struct-name HeartIcon --precision 12
```

Include a usage comment at the top of the output:

```sh
npx svg2swiftui ./heart.svg ./Heart.swift --usage-comment
```

The `--usage-comment` flag produces output that starts with something like:

```swift
// To use this shape, just add it to your SwiftUI View:
// Heart().fill().frame(width: 24, height: 24)

struct Heart: Shape {
  func path(in rect: CGRect) -> Path {
    // ...
  }
}
```

## Behavior notes

- If the output file already exists, it is overwritten silently.
- Missing parent directories in the output path are created automatically.
- Missing or malformed SVG input exits with code `1` and an `Error:` message on stderr.

## How it works

`svg2swiftui` is a thin CLI wrapper around [`svg-to-swiftui-core`](https://npmjs.org/package/svg-to-swiftui-core) — the same compiler powering the web tool. Each SVG becomes a single SwiftUI `Shape` with one `Path`, combining all elements.

## License

MIT — see [LICENSE](../../LICENSE) at the repository root.
