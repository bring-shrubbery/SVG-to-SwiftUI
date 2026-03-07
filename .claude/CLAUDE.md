# SVG to SwiftUI

Converts SVG code into SwiftUI `Shape` structures. Monorepo managed with pnpm + Turborepo.

## Project Structure

- `packages/svg-to-swiftui-core/` - Core conversion library (published to npm)
- `apps/nextjs/` - Next.js web app (hosted at svg-to-swiftui.quassum.com)
- `packages/figma-to-swiftui/` - Figma plugin
- `tooling/` - Shared configs (eslint, prettier, tsconfig, tailwind)

## Commands

```sh
pnpm install          # Install dependencies
pnpm dev              # Run all packages in dev mode
pnpm build            # Build all packages
pnpm test             # Run tests (jest, in svg-to-swiftui-core)
pnpm lint             # Lint all packages
pnpm format           # Check formatting
pnpm typecheck        # Type-check all packages
```

## Requirements

- Node >= 22
- pnpm 10.x
