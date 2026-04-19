# svg2swiftui CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new `svg2swiftui` workspace package that provides a `npx svg2swiftui ./in.svg ./out.swift` CLI wrapping `svg-to-swiftui-core`.

**Architecture:** A thin commander-based CLI in `packages/svg2swiftui/`. Three source files with single responsibilities: `derive-struct-name.ts` (pure util), `convert-file.ts` (I/O orchestrator calling core `convert()`), `cli.ts` (argv parsing + error handling). Built with tsup to CJS so `npx` cold-start is fast and ESM-loader-quirk-free.

**Tech Stack:** TypeScript, `commander` v12, `svg-to-swiftui-core` (workspace:*), tsup for build, jest + @swc/jest for tests, biome for lint/format.

**Spec:** `docs/superpowers/specs/2026-04-19-svg2swiftui-cli-design.md`

**Repo convention note:** The existing `svg-to-swiftui-core` jest config uses `rootDir: "src"` with tests under `src/tests/*.test.ts`. This plan follows that convention (the spec's `__tests__/` path was a generic default).

---

## File Structure

Create under `packages/svg2swiftui/`:

```
package.json                         # name, bin, scripts, deps
tsconfig.json                        # extends @svg-to-swiftui/tsconfig/base.json
tsup.config.ts                       # shebang banner + CJS output
jest.config.js                       # mirrors svg-to-swiftui-core
src/cli.ts                           # entry point with shebang
src/convert-file.ts                  # orchestrator: fs + core.convert
src/derive-struct-name.ts            # pure util
src/tests/derive-struct-name.test.ts # unit tests
src/tests/convert-file.test.ts       # integration tests (real fs, tmp dir)
src/tests/cli.e2e.test.ts            # spawns built binary
src/tests/fixtures/icon.svg          # tiny fixture for integration/e2e
```

---

## Task 1: Scaffold the package

**Files:**
- Create: `packages/svg2swiftui/package.json`
- Create: `packages/svg2swiftui/tsconfig.json`
- Create: `packages/svg2swiftui/tsup.config.ts`
- Create: `packages/svg2swiftui/jest.config.js`
- Create: `packages/svg2swiftui/src/cli.ts` (stub)
- Create: `packages/svg2swiftui/src/tests/fixtures/icon.svg`

- [ ] **Step 1: Create `packages/svg2swiftui/package.json`**

```json
{
  "name": "svg2swiftui",
  "version": "0.1.0",
  "description": "CLI for converting SVG files into SwiftUI Shape structs.",
  "main": "dist/cli.js",
  "bin": {
    "svg2swiftui": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "license": "MIT",
  "keywords": [
    "svg",
    "swiftui",
    "cli",
    "swift",
    "converter"
  ],
  "author": {
    "name": "Antoni Silvestrovic",
    "email": "antoni.silvestrovic@gmail.com",
    "url": "https://antoni.ai"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/quassum/svg-to-swiftui-core.git"
  },
  "bugs": {
    "url": "https://github.com/quassum/svg-to-swiftui-core/issues"
  },
  "homepage": "https://github.com/quassum/svg-to-swiftui-core#readme",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "clean": "rm -rf .turbo node_modules dist",
    "test": "jest",
    "lint": "biome check .",
    "format": "biome format .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "svg-to-swiftui-core": "workspace:*"
  },
  "devDependencies": {
    "@svg-to-swiftui/tsconfig": "workspace:*",
    "@swc/core": "^1.15.18",
    "@swc/jest": "^0.2.39",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.3.0",
    "jest": "^30.2.0",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create `packages/svg2swiftui/tsconfig.json`**

```json
{
  "extends": "@svg-to-swiftui/tsconfig/base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "tsup.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/svg2swiftui/tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  target: "node18",
  minify: true,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

- [ ] **Step 4: Create `packages/svg2swiftui/jest.config.js`**

```js
export default {
  testEnvironment: "node",
  rootDir: "src",
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
};
```

- [ ] **Step 5: Create stub `packages/svg2swiftui/src/cli.ts`**

```ts
// placeholder — implemented in Task 4
export {};
```

- [ ] **Step 6: Create fixture SVG `packages/svg2swiftui/src/tests/fixtures/icon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="black"/></svg>
```

- [ ] **Step 7: Install dependencies**

Run: `bun install`
Expected: installs `commander`, links workspace deps, no errors.

- [ ] **Step 8: Verify typecheck passes on the empty scaffold**

Run: `bun run --filter svg2swiftui typecheck`
Expected: exits 0 with no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/svg2swiftui
# Also stage any lockfile updates from `bun install`:
git add -u
git commit -m "chore(svg2swiftui): scaffold new CLI package"
```

---

## Task 2: Implement `deriveStructName` (TDD)

**Files:**
- Create: `packages/svg2swiftui/src/tests/derive-struct-name.test.ts`
- Create: `packages/svg2swiftui/src/derive-struct-name.ts`

- [ ] **Step 1: Write failing test file**

Create `packages/svg2swiftui/src/tests/derive-struct-name.test.ts`:

```ts
import { deriveStructName } from "../derive-struct-name";

describe("deriveStructName", () => {
  it("PascalCases a simple lowercase basename", () => {
    expect(deriveStructName("icon.swift")).toBe("Icon");
  });

  it("joins hyphenated segments into PascalCase", () => {
    expect(deriveStructName("bar-baz.swift")).toBe("BarBaz");
  });

  it("joins underscored segments into PascalCase", () => {
    expect(deriveStructName("my_icon.swift")).toBe("MyIcon");
  });

  it("handles digits mid-name", () => {
    expect(deriveStructName("icon_v2.swift")).toBe("IconV2");
  });

  it("ignores directory prefixes", () => {
    expect(deriveStructName("./path/nested/icon.swift")).toBe("Icon");
  });

  it("collapses double dot extensions", () => {
    expect(deriveStructName("icon.view.swift")).toBe("IconView");
  });

  it("falls back to SVGShape for empty basename", () => {
    expect(deriveStructName(".swift")).toBe("SVGShape");
  });

  it("falls back to SVGShape when name starts with a digit", () => {
    expect(deriveStructName("123icon.swift")).toBe("SVGShape");
  });

  it("handles mixed separators", () => {
    expect(deriveStructName("foo bar-baz_qux.swift")).toBe("FooBarBazQux");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter svg2swiftui test`
Expected: FAIL with `Cannot find module '../derive-struct-name'`.

- [ ] **Step 3: Implement `derive-struct-name.ts`**

Create `packages/svg2swiftui/src/derive-struct-name.ts`:

```ts
import path from "node:path";

const FALLBACK = "SVGShape";

export function deriveStructName(outputPath: string): string {
  const ext = path.extname(outputPath);
  const base = path.basename(outputPath, ext);

  const segments = base.split(/[^A-Za-z0-9]+/).filter((s) => s.length > 0);
  if (segments.length === 0) return FALLBACK;

  const joined = segments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");

  if (/^[0-9]/.test(joined)) return FALLBACK;

  return joined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter svg2swiftui test`
Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/svg2swiftui/src/derive-struct-name.ts packages/svg2swiftui/src/tests/derive-struct-name.test.ts
git commit -m "feat(svg2swiftui): add deriveStructName util"
```

---

## Task 3: Implement `convertFile` (TDD)

**Files:**
- Create: `packages/svg2swiftui/src/tests/convert-file.test.ts`
- Create: `packages/svg2swiftui/src/convert-file.ts`

- [ ] **Step 1: Write failing test file**

Create `packages/svg2swiftui/src/tests/convert-file.test.ts`:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { convertFile } from "../convert-file";

const FIXTURE = path.join(__dirname, "fixtures", "icon.svg");

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "svg2swiftui-"));
}

describe("convertFile", () => {
  it("writes a Swift file with a struct derived from the output filename", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "myIcon.swift");

    convertFile({ input: FIXTURE, output: out });

    const written = fs.readFileSync(out, "utf8");
    expect(written).toContain("struct MyIcon: Shape");
  });

  it("honors the structName override", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "icon.swift");

    convertFile({ input: FIXTURE, output: out, structName: "CustomName" });

    const written = fs.readFileSync(out, "utf8");
    expect(written).toContain("struct CustomName: Shape");
  });

  it("creates missing parent directories", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "deeply", "nested", "Icon.swift");

    convertFile({ input: FIXTURE, output: out });

    expect(fs.existsSync(out)).toBe(true);
  });

  it("overwrites an existing output file silently", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "icon.swift");
    fs.writeFileSync(out, "PREVIOUS CONTENT");

    convertFile({ input: FIXTURE, output: out });

    const written = fs.readFileSync(out, "utf8");
    expect(written).not.toContain("PREVIOUS CONTENT");
    expect(written).toContain("struct Icon: Shape");
  });

  it("throws a clear error when input file does not exist", () => {
    const tmp = makeTmpDir();
    const missing = path.join(tmp, "nope.svg");
    const out = path.join(tmp, "out.swift");

    expect(() => convertFile({ input: missing, output: out })).toThrow(
      /Input file not found/,
    );
  });

  it("passes usageComment through to the core converter", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "icon.swift");

    convertFile({ input: FIXTURE, output: out, usageComment: true });

    const written = fs.readFileSync(out, "utf8");
    // Core emits a leading `//` comment when usageCommentPrefix is true.
    expect(written.trimStart().startsWith("//")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter svg2swiftui test`
Expected: FAIL with `Cannot find module '../convert-file'`.

- [ ] **Step 3: Implement `convert-file.ts`**

Create `packages/svg2swiftui/src/convert-file.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { convert } from "svg-to-swiftui-core";
import { deriveStructName } from "./derive-struct-name";

export interface ConvertFileOptions {
  input: string;
  output: string;
  structName?: string;
  precision?: number;
  indentation?: number;
  usageComment?: boolean;
}

export function convertFile(options: ConvertFileOptions): void {
  const { input, output, structName, precision, indentation, usageComment } = options;

  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const svg = fs.readFileSync(input, "utf8");
  const effectiveStructName = structName ?? deriveStructName(output);

  const swift = convert(svg, {
    structName: effectiveStructName,
    precision,
    indentationSize: indentation,
    usageCommentPrefix: usageComment,
  });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, swift, "utf8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter svg2swiftui test`
Expected: all convert-file tests pass alongside the derive-struct-name tests.

- [ ] **Step 5: Commit**

```bash
git add packages/svg2swiftui/src/convert-file.ts packages/svg2swiftui/src/tests/convert-file.test.ts
git commit -m "feat(svg2swiftui): add convertFile orchestrator"
```

---

## Task 4: Wire up the CLI entry point

**Files:**
- Modify: `packages/svg2swiftui/src/cli.ts`

- [ ] **Step 1: Replace the `cli.ts` stub with the real implementation**

Replace the entire contents of `packages/svg2swiftui/src/cli.ts` with:

```ts
import { Command } from "commander";
import { convertFile } from "./convert-file";
import pkg from "../package.json";

function main(argv: string[]): void {
  const program = new Command();

  program
    .name("svg2swiftui")
    .description("Convert an SVG file into a SwiftUI Shape struct.")
    .version(pkg.version)
    .argument("<input>", "Path to input SVG file")
    .argument("<output>", "Path to output Swift file")
    .option("--struct-name <name>", "SwiftUI struct name (default: derived from output filename)")
    .option("--precision <n>", "Decimal precision for path coordinates", Number, 10)
    .option("--indentation <n>", "Indentation width in spaces", Number, 4)
    .option("--usage-comment", "Include SwiftUI usage example as a leading comment", false)
    .action((input: string, output: string, opts: {
      structName?: string;
      precision: number;
      indentation: number;
      usageComment: boolean;
    }) => {
      convertFile({
        input,
        output,
        structName: opts.structName,
        precision: opts.precision,
        indentation: opts.indentation,
        usageComment: opts.usageComment,
      });
    });

  program.parse(argv);
}

try {
  main(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
}
```

Note: importing `package.json` relies on `resolveJsonModule` (already on in the base tsconfig) and tsup bundling it into the CJS output.

- [ ] **Step 2: Build to verify the CLI compiles**

Run: `bun run --filter svg2swiftui build`
Expected: `dist/cli.js` is produced, exits 0.

- [ ] **Step 3: Manually smoke-test the built binary**

Run: `node packages/svg2swiftui/dist/cli.js packages/svg2swiftui/src/tests/fixtures/icon.svg /tmp/svg2swiftui-smoke.swift`
Expected: exits 0, file `/tmp/svg2swiftui-smoke.swift` contains `struct SvgSwiftuiSmoke: Shape`.

Run: `head -5 /tmp/svg2swiftui-smoke.swift`
Expected: a valid Swift struct declaration.

Run: `node packages/svg2swiftui/dist/cli.js --help`
Expected: usage help with all four options listed.

- [ ] **Step 4: Commit**

```bash
git add packages/svg2swiftui/src/cli.ts
git commit -m "feat(svg2swiftui): wire up commander CLI entry point"
```

---

## Task 5: End-to-end smoke test against the built binary

**Files:**
- Create: `packages/svg2swiftui/src/tests/cli.e2e.test.ts`

- [ ] **Step 1: Write the e2e test**

Create `packages/svg2swiftui/src/tests/cli.e2e.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PKG_ROOT = path.resolve(__dirname, "..", "..");
const BIN = path.join(PKG_ROOT, "dist", "cli.js");
const FIXTURE = path.join(__dirname, "fixtures", "icon.svg");

describe("svg2swiftui CLI (e2e)", () => {
  beforeAll(() => {
    if (!fs.existsSync(BIN)) {
      execFileSync("bun", ["run", "build"], { cwd: PKG_ROOT, stdio: "inherit" });
    }
  });

  it("converts a fixture SVG into a Swift file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svg2swiftui-e2e-"));
    const out = path.join(tmp, "Icon.swift");

    execFileSync("node", [BIN, FIXTURE, out], { stdio: "pipe" });

    expect(fs.existsSync(out)).toBe(true);
    const written = fs.readFileSync(out, "utf8");
    expect(written).toContain("struct Icon: Shape");
    expect(written).toContain("func path(in rect: CGRect)");
  });

  it("exits with code 1 and a clear error when input is missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svg2swiftui-e2e-"));
    const missing = path.join(tmp, "nope.svg");
    const out = path.join(tmp, "out.swift");

    let caught: { status: number | null; stderr: string } | null = null;
    try {
      execFileSync("node", [BIN, missing, out], { stdio: "pipe" });
    } catch (err) {
      const e = err as { status: number | null; stderr: Buffer };
      caught = { status: e.status, stderr: e.stderr.toString() };
    }

    expect(caught).not.toBeNull();
    expect(caught?.status).toBe(1);
    expect(caught?.stderr).toMatch(/Input file not found/);
  });
});
```

- [ ] **Step 2: Ensure the binary is built, then run tests**

Run: `bun run --filter svg2swiftui build && bun run --filter svg2swiftui test`
Expected: all tests pass, including the two new e2e tests.

- [ ] **Step 3: Commit**

```bash
git add packages/svg2swiftui/src/tests/cli.e2e.test.ts
git commit -m "test(svg2swiftui): add e2e smoke tests for built CLI"
```

---

## Task 6: Root-level verification

**Files:**
- Verify only — no source changes expected.

- [ ] **Step 1: Run typecheck across the monorepo**

Run: `bun run typecheck`
Expected: exits 0 with no errors. If errors surface in `svg2swiftui`, fix them inline (most likely: adjust commander option types or tsconfig include).

- [ ] **Step 2: Run lint across the monorepo**

Run: `bun run lint`
Expected: exits 0. Fix any biome warnings introduced by the new files.

- [ ] **Step 3: Run tests across the monorepo**

Run: `bun run test`
Expected: all tests pass in both `svg-to-swiftui-core` and `svg2swiftui`.

- [ ] **Step 4: Run workspace sherif check**

Run: `bun run lint:ws`
Expected: no workspace-level complaints (shared dep versions, etc.).

- [ ] **Step 5: Commit any fixes from steps 1–4 (if needed)**

If fixes were needed:

```bash
git add -A
git commit -m "fix(svg2swiftui): address lint/typecheck issues from root verification"
```

Otherwise skip this commit.

- [ ] **Step 6: Final manual smoke test**

Run: `bun run --filter svg2swiftui build && node packages/svg2swiftui/dist/cli.js packages/svg2swiftui/src/tests/fixtures/icon.svg /tmp/final-smoke.swift --struct-name MyIcon --usage-comment`
Expected: exits 0. `/tmp/final-smoke.swift` starts with a `//` comment block and contains `struct MyIcon: Shape`.
