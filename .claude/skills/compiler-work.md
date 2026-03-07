# Skill: Working on the SVG-to-SwiftUI Compiler

## Overview

The compiler lives in `packages/svg-to-swiftui-core/`. It converts SVG strings into SwiftUI `Shape` structs by parsing SVG into an AST, normalizing coordinates to 0-1 range, and generating Swift `Path` operations.

## Key Source Files

- `src/index.ts` - Entry point, `convert()` function
- `src/elementHandlers/` - Per-element conversion (path, circle, rect, ellipse, group)
- `src/elementHandlers/pathElementHandler/` - SVG path command generators (moveTo, lineTo, cubicCurve, quadCurve, closePath)
- `src/templates.ts` - Swift code generation (struct/function templates)
- `src/utils.ts` - Coordinate normalization, viewBox extraction
- `src/styleUtils.ts` - SVG style property extraction

## Running Tests

Unit tests (exact string match against expected Swift output):
```sh
bun run test
```

Visual regression tests (pixel comparison of SVG vs Swift rendering):
```sh
bun run visual-test            # all fixtures
bun run visual-test circle     # filter by name
```

## Visual Test Workflow

The visual tests render each SVG two ways and compare the results:
1. SVG rendered to PNG via resvg
2. SVG converted to Swift, compiled with `swiftc`, rendered to PNG via CoreGraphics

Both images are converted to binary masks (black=content, white=background) and compared with pixelmatch. A similarity score is produced (100% = pixel-perfect).

### Output Files

After running `bun run visual-test`, check these in `packages/svg-to-swiftui-core/visual-tests/renders/`:

- `{name}-svg.png` - How the SVG actually looks (reference)
- `{name}-swift.png` - How the generated Swift code renders
- `{name}-diff.png` - Red pixels show where the two differ
- `summary.json` - Machine-readable results with per-test scores

Read the `-svg.png` and `-swift.png` to visually compare, and `-diff.png` to pinpoint differences.

### Adding New Test Cases

Drop any `.svg` file into `packages/svg-to-swiftui-core/visual-tests/fixtures/`. The runner auto-discovers them. No registration needed.

### Pass Threshold

Tests pass at >= 95% similarity. Anti-aliasing differences between resvg and CoreGraphics account for ~0.02% on simple shapes, so 99.9%+ is expected for well-supported SVG features.

## What the Compiler Supports

Supported SVG elements: `<path>`, `<circle>`, `<rect>`, `<ellipse>`, `<g>`, `<svg>`

Supported path commands: M, L, H, V, C, S, Q, T, Z (absolute; relative converted via toAbs())

Not yet supported: Arc (A), `<text>`, `<polygon>`, `<polyline>`, fill/stroke colors, gradients, transforms, clip-path, rounded rect corners (rx/ry)

## Typical Workflow

1. Identify a failing visual test or add a new SVG fixture that exercises the feature you want to implement
2. Run `bun run visual-test` to get a baseline score
3. Make changes to the compiler source in `src/`
4. Run `bun run visual-test` again to see if the score improved
5. Read the diff images to verify the fix is correct
6. Run `bun run test` to make sure existing unit tests still pass
