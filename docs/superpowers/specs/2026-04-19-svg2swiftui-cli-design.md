# svg2swiftui CLI — Design Spec

**Date:** 2026-04-19
**Status:** Approved for implementation

## Summary

A new workspace package `svg2swiftui` providing a zero-config CLI for converting a single SVG file to a SwiftUI `Shape` file. Usage:

```sh
npx svg2swiftui ./path/icon.svg ./path/icon.swift
```

The CLI is a thin shim over `svg-to-swiftui-core`'s `convert()` function. No new conversion logic lives in this package.

## Goals

- One-command conversion for users outside the monorepo, installable via `npx`.
- Reuse `svg-to-swiftui-core` — no duplicated compiler logic.
- Expose the core config surface (`structName`, `precision`, `indentationSize`, `usageCommentPrefix`) as flags.

## Non-goals

- Batch/directory conversion (single file in, single file out).
- Watch mode.
- Reading from stdin / writing to stdout.
- Bundled runtime for non-Node environments.

## Package setup

- **Location:** `packages/svg2swiftui/`
- **npm name:** `svg2swiftui`
- **package.json `type`:** unset (CommonJS) — keeps the CJS bin output as `dist/cli.js` and avoids ESM-loader quirks under `npx`.
- **Bin field:** `{ "svg2swiftui": "./dist/cli.js" }`.
- **Build:** `tsup src/cli.ts --format cjs --minify` with shebang `#!/usr/bin/env node` injected (tsup `--banner` or in-source).
- **Published files:** `dist/` only (via `files` field).
- **Runtime deps:**
  - `svg-to-swiftui-core: workspace:*`
  - `commander: ^12`
- **Dev deps:** `jest`, `@swc/jest`, `@types/jest`, `@types/node`, `tsup`, `typescript`, `@svg-to-swiftui/tsconfig: workspace:*`.
- **Scripts:** `build`, `dev`, `test`, `lint`, `format`, `typecheck`, `clean` — mirroring `svg-to-swiftui-core`.

## Components

### `src/cli.ts`

Entry point. Starts with `#!/usr/bin/env node`.

- Reads `version` from `package.json` (via `require` or tsup-inlined).
- Configures commander:
  - `.name('svg2swiftui')`
  - `.argument('<input>', 'Path to input SVG file')`
  - `.argument('<output>', 'Path to output Swift file')`
  - `.option('--struct-name <name>', 'SwiftUI struct name (default: derived from output filename)')`
  - `.option('--precision <n>', 'Decimal precision for path coordinates', Number, 10)`
  - `.option('--indentation <n>', 'Indentation width in spaces', Number, 4)`
  - `.option('--usage-comment', 'Include SwiftUI usage example as a leading comment', false)`
  - `.version(pkg.version)`
- On action, calls `convertFile({ input, output, ...options })`.
- Wraps in `try/catch`: on error, `console.error('Error: ' + err.message)` and `process.exit(1)`.

### `src/convert-file.ts`

Orchestrator. Pure function over Node `fs`.

```ts
export interface ConvertFileOptions {
  input: string;
  output: string;
  structName?: string;
  precision?: number;
  indentation?: number;
  usageComment?: boolean;
}

export function convertFile(options: ConvertFileOptions): void;
```

Steps:

1. Read input via `fs.readFileSync(input, 'utf8')`. If the file doesn't exist, throw `Error('Input file not found: ' + input)`.
2. Resolve effective struct name: explicit `options.structName` if set, else `deriveStructName(output)`.
3. Call `convert(svg, { structName, precision, indentationSize: indentation, usageCommentPrefix: usageComment })` from `svg-to-swiftui-core`.
4. `fs.mkdirSync(path.dirname(output), { recursive: true })`.
5. `fs.writeFileSync(output, swift, 'utf8')`. Overwrites silently if file exists.

### `src/derive-struct-name.ts`

Pure util.

```ts
export function deriveStructName(outputPath: string): string;
```

- Takes the path's basename without extension (`path.basename(p, path.extname(p))`).
- Splits on any non-alphanumeric characters (`-`, `_`, `.`, space).
- Capitalizes the first letter of each segment, concatenates.
- Examples:
  - `./path/icon.swift` → `Icon`
  - `bar-baz.swift` → `BarBaz`
  - `my_icon_v2.swift` → `MyIconV2`
  - `icon.view.swift` → `IconView` (double extension collapses naturally via split)
- If the resulting name is empty or starts with a digit, fall back to `SVGShape` — matches core's existing default.

## Flags → core config mapping

| CLI flag | Type | Default | Core config field |
|---|---|---|---|
| `--struct-name <name>` | string | derived from output filename | `structName` |
| `--precision <n>` | number | 10 | `precision` |
| `--indentation <n>` | number | 4 | `indentationSize` |
| `--usage-comment` | boolean | false | `usageCommentPrefix` |

Commander's `Number` coercer is applied for numeric flags; commander handles `--help` and `--version` automatically.

## Error handling

- Missing input file → `Error: Input file not found: <path>`, exit 1.
- Invalid SVG (core throws `Could not find SVG element, please provide full SVG source!`) → message bubbles up verbatim, exit 1.
- Write failure (permissions, disk full, etc.) → Node's error message bubbles up, exit 1.
- No retry, no fallback: CLI is a one-shot tool and failures are terminal.

## Data flow

```
npx svg2swiftui input.svg output.swift [--flags]
  → commander parses argv (validates arity, coerces numbers)
  → convertFile({ input, output, structName?, precision, indentation, usageComment })
    → fs.readFileSync(input)
    → effectiveStructName = structName ?? deriveStructName(output)
    → core.convert(svg, { structName, precision, indentationSize, usageCommentPrefix })
    → fs.mkdirSync(dirname(output), { recursive: true })
    → fs.writeFileSync(output, swift)
  → exit 0
  on throw → console.error('Error: ' + message) + exit 1
```

## Testing

Three test files, all in `__tests__/`:

1. **`derive-struct-name.test.ts`** — unit tests:
   - Simple name (`icon.swift` → `Icon`).
   - Hyphenated (`bar-baz.swift` → `BarBaz`).
   - Underscored (`my_icon.swift` → `MyIcon`).
   - Mixed separators + digits (`icon_v2.swift` → `IconV2`).
   - Paths with directories (`./path/nested/icon.swift` → `Icon`).
   - Empty / digit-leading fallback to `SVGShape`.

2. **`convert-file.test.ts`** — integration against real fs:
   - Uses `fs.mkdtempSync(os.tmpdir() + '/svg2swiftui-')` for isolation.
   - Fixture SVG checked in under `__tests__/fixtures/`.
   - Asserts output file exists, content contains `struct Icon: Shape`.
   - Asserts `--struct-name` override takes effect.
   - Asserts nested output path creates missing parent directories.
   - Asserts overwrite of existing file succeeds silently.

3. **`cli.e2e.test.ts`** — smoke test against the built binary:
   - Runs `bun run build` in a `beforeAll` (or relies on turbo having built it).
   - `execFileSync('node', ['dist/cli.js', fixture, outPath])`.
   - Asserts exit code 0 and written file matches snapshot.
   - Single case — unit + integration tests cover the surface area.

## Isolation boundaries

- `derive-struct-name.ts` — pure, no I/O. Testable in isolation.
- `convert-file.ts` — I/O + core call, no argv knowledge. Callable as a library if ever needed.
- `cli.ts` — argv parsing + top-level error handling. Thin, mostly declarative.

Each module has one job. Reviewer should be able to understand any file without reading the others.

## Out of scope for v1

- Multiple input files / glob patterns.
- Writing to stdout (`-` as output path).
- Reading from stdin.
- `--force` / `--no-overwrite` flags (silent overwrite matches codegen convention).
- Watch mode.
- Config file (`svg2swiftui.config.*`).

These can be added later if needed without breaking the v1 surface.
