# Icon Pack SEO Articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a pilot of 5 per-icon-pack SEO landing pages (Font Awesome, Material Design, Heroicons, Lucide, Bootstrap) that target "how to use [pack] in SwiftUI/iOS" and funnel readers into the Examples feature pre-filtered to that pack.

**Architecture:** A central config drives a single dynamic route (`/icons/[pack]`) that is statically pre-rendered via `generateStaticParams`. Each page shows a *real* converted icon generated at build time (via `iconDataToSvg` + `svg-to-swiftui-core`'s `convert`) so pages are unique, not thin. The Examples dialog reads a `?examples=<packId>` query param on mount to auto-open pre-filtered.

**Tech Stack:** Next.js 15.5 App Router (async `params`/`searchParams`), React 19, TypeScript, Tailwind + `@tailwindcss/typography`, `svg-to-swiftui-core`.

## Global Constraints

- **No unit-test harness in `apps/nextjs`** — jest exists only in `svg-to-swiftui-core` (per CLAUDE.md). Verification for this plan is `bun run typecheck` + dev-server preview behavioral checks. Do NOT add a test runner to the Next.js app.
- **Next.js 15 async dynamic APIs:** `params` and `searchParams` are Promises — always `await` them in pages/`generateMetadata`.
- **`useSearchParams()` requires a `<Suspense>` boundary** or the static build fails with "useSearchParams() should be wrapped in a suspense boundary".
- **Pilot packs (manifestId → slug):** `fa6`→`font-awesome`, `md`→`material-design-icons`, `hi2`→`heroicons`, `lu`→`lucide`, `bs`→`bootstrap-icons`.
- **Icon JSON format:** `public/data/icons/<manifestId>.json` is `Array<[name: string, IconData]>`. `star` exists in all 5 pilot packs (safe universal sample).
- **`convert` signature:** `convert(rawSVG: string, config?: { structName?: string; precision?: number; indentationSize?: number }): string` from `svg-to-swiftui-core`.
- **Existing patterns to follow:** `/convert-svg-to-swiftui` guide page ([apps/nextjs/src/app/(documents)/convert-svg-to-swiftui/page.tsx](apps/nextjs/src/app/(documents)/convert-svg-to-swiftui/page.tsx)) for metadata + JSON-LD; document pages live in the `(documents)` route group and inherit the `prose` layout.
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commit directly on `main`.

---

### Task 1: Icon pack article config

**Files:**
- Create: `apps/nextjs/src/lib/icon-pack-articles.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface IconPackArticle { manifestId: string; slug: string; name: string; vendorUrl: string; license: string; count: number; blurb: string; sampleIconNames: string[]; }`
  - `const ICON_PACK_ARTICLES: IconPackArticle[]` (5 entries)
  - `function getIconPackArticle(slug: string): IconPackArticle | undefined`

- [ ] **Step 1: Create the config file**

Create `apps/nextjs/src/lib/icon-pack-articles.ts`:

```ts
export interface IconPackArticle {
  /** Matches public/data/icons/<manifestId>.json and the ?examples=<id> param. */
  manifestId: string;
  /** URL segment: /icons/<slug> */
  slug: string;
  /** Human-readable pack name. */
  name: string;
  /** Official pack homepage. */
  vendorUrl: string;
  /** Short license string. */
  license: string;
  /** Icon count (from public/data/icons/manifest.json). */
  count: number;
  /** 1-2 sentence pack-specific intro. */
  blurb: string;
  /** Representative icon names, tried in order for the build-time example. */
  sampleIconNames: string[];
}

export const ICON_PACK_ARTICLES: IconPackArticle[] = [
  {
    manifestId: "fa6",
    slug: "font-awesome",
    name: "Font Awesome 6",
    vendorUrl: "https://fontawesome.com/",
    license: "Free icons under CC BY 4.0",
    count: 2058,
    blurb:
      "Font Awesome is one of the most widely used icon toolkits on the web, shipping thousands of solid, regular, and brand icons in a single consistent style.",
    sampleIconNames: ["star", "house", "heart"],
  },
  {
    manifestId: "md",
    slug: "material-design-icons",
    name: "Material Design Icons",
    vendorUrl: "https://fonts.google.com/icons",
    license: "Apache License 2.0",
    count: 4341,
    blurb:
      "Material Design Icons are Google's official system icons, designed to be clean, legible, and consistent across Android, the web, and beyond.",
    sampleIconNames: ["star", "home", "house"],
  },
  {
    manifestId: "hi2",
    slug: "heroicons",
    name: "Heroicons 2",
    vendorUrl: "https://heroicons.com/",
    license: "MIT License",
    count: 972,
    blurb:
      "Heroicons is a popular set of hand-crafted SVG icons by the makers of Tailwind CSS, available in outline and solid styles.",
    sampleIconNames: ["star", "heart", "home"],
  },
  {
    manifestId: "lu",
    slug: "lucide",
    name: "Lucide",
    vendorUrl: "https://lucide.dev/",
    license: "ISC License",
    count: 1541,
    blurb:
      "Lucide is a community-maintained fork of Feather Icons, offering a large, consistent set of clean stroke-based SVG icons.",
    sampleIconNames: ["star", "house", "heart"],
  },
  {
    manifestId: "bs",
    slug: "bootstrap-icons",
    name: "Bootstrap Icons",
    vendorUrl: "https://icons.getbootstrap.com/",
    license: "MIT License",
    count: 2754,
    blurb:
      "Bootstrap Icons is the official open-source icon library from the Bootstrap team, with a broad set of figures designed to pair with any project.",
    sampleIconNames: ["star", "house", "heart"],
  },
];

export function getIconPackArticle(slug: string): IconPackArticle | undefined {
  return ICON_PACK_ARTICLES.find((article) => article.slug === slug);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/nextjs && bun run typecheck`
Expected: No new errors referencing `icon-pack-articles.ts` (pre-existing errors in `mdx-components.tsx`, `scripts/generate-icon-data.ts`, `src/app/App.tsx` are unrelated and expected).

- [ ] **Step 3: Commit**

```bash
git add apps/nextjs/src/lib/icon-pack-articles.ts
git commit -m "feat(nextjs): add icon-pack article config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Build-time icon example generator

**Files:**
- Create: `apps/nextjs/src/lib/icon-pack-example.ts`

**Interfaces:**
- Consumes: `iconDataToSvg` from `@/lib/icon-to-svg`; `convert` from `svg-to-swiftui-core`.
- Produces:
  - `interface IconExample { iconName: string; svg: string; swift: string; }`
  - `async function generateIconExample(manifestId: string, preferredNames: string[]): Promise<IconExample>`

**Notes:** Server-only module (uses `node:fs`). Reads `process.cwd()/public/data/icons/<manifestId>.json`. `process.cwd()` is the `apps/nextjs` app root at build time.

- [ ] **Step 1: Create the generator file**

Create `apps/nextjs/src/lib/icon-pack-example.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { convert } from "svg-to-swiftui-core";
import { iconDataToSvg } from "@/lib/icon-to-svg";

interface IconNode {
  tag: string;
  attr: Record<string, string>;
  child: IconNode[];
}

interface IconData {
  attr: Record<string, string>;
  child: IconNode[];
}

type IconEntry = [string, IconData];

export interface IconExample {
  /** The icon name used (e.g. "star"). */
  iconName: string;
  /** The reconstructed SVG source. */
  svg: string;
  /** The generated SwiftUI Shape source. */
  swift: string;
}

function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Reads a pack's icon JSON, picks the first preferred icon that exists (falling
 * back to the first icon in the file), and returns its SVG plus the converted
 * SwiftUI Shape. Generated at build time so each article shows real output.
 */
export async function generateIconExample(manifestId: string, preferredNames: string[]): Promise<IconExample> {
  const filePath = join(process.cwd(), "public", "data", "icons", `${manifestId}.json`);
  const raw = await readFile(filePath, "utf-8");
  const entries = JSON.parse(raw) as IconEntry[];

  let entry = preferredNames
    .map((name) => entries.find(([entryName]) => entryName === name))
    .find((found): found is IconEntry => Boolean(found));
  if (!entry) entry = entries[0];
  if (!entry) throw new Error(`No icons found for pack "${manifestId}"`);

  const [iconName, data] = entry;
  const svg = iconDataToSvg(data);
  const swift = convert(svg, {
    structName: `${toPascalCase(iconName)}Shape`,
    precision: 3,
    indentationSize: 4,
  });

  return { iconName, svg, swift };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/nextjs && bun run typecheck`
Expected: No new errors referencing `icon-pack-example.ts`.

- [ ] **Step 3: Smoke-test the generator at runtime**

Run (from repo root):
```bash
cd apps/nextjs && bun -e 'import("./src/lib/icon-pack-example.ts").then(async (m) => { const r = await m.generateIconExample("fa6", ["star","house"]); console.log("ICON:", r.iconName); console.log("SVG_OK:", r.svg.startsWith("<svg")); console.log("SWIFT_OK:", r.swift.includes("struct") && r.swift.includes("Shape")); })'
```
Expected output includes: `ICON: star`, `SVG_OK: true`, `SWIFT_OK: true`.
(If `@/` alias fails to resolve under `bun -e`, skip this step — Task 3's page render is the authoritative behavioral check.)

- [ ] **Step 4: Commit**

```bash
git add apps/nextjs/src/lib/icon-pack-example.ts
git commit -m "feat(nextjs): add build-time icon example generator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Icon pack article route

**Files:**
- Create: `apps/nextjs/src/app/(documents)/icons/[pack]/page.tsx`

**Interfaces:**
- Consumes: `ICON_PACK_ARTICLES`, `getIconPackArticle` from `@/lib/icon-pack-articles`; `generateIconExample` from `@/lib/icon-pack-example`.
- Produces: 5 statically-rendered pages at `/icons/<slug>`.

- [ ] **Step 1: Create the page**

Create `apps/nextjs/src/app/(documents)/icons/[pack]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateIconExample } from "@/lib/icon-pack-example";
import { getIconPackArticle, ICON_PACK_ARTICLES } from "@/lib/icon-pack-articles";

const SITE_URL = "https://svg-to-swiftui.quassum.com";

export function generateStaticParams() {
  return ICON_PACK_ARTICLES.map((article) => ({ pack: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ pack: string }> }): Promise<Metadata> {
  const { pack } = await params;
  const article = getIconPackArticle(pack);
  if (!article) return {};

  const title = `How to Use ${article.name} Icons in SwiftUI & iOS`;
  const description = `Add ${article.name} icons to your SwiftUI and iOS apps. Convert any ${article.name} SVG icon into a native SwiftUI Shape for iPhone, iPad, and Mac — free and in your browser.`;
  const path = `/icons/${article.slug}`;

  return {
    title: { absolute: `${title} — SVG to SwiftUI Converter` },
    description,
    alternates: { canonical: path },
    openGraph: { type: "article", title, description, url: path },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function IconPackArticlePage({ params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  const article = getIconPackArticle(pack);
  if (!article) notFound();

  const example = await generateIconExample(article.manifestId, article.sampleIconNames);
  const title = `How to Use ${article.name} Icons in SwiftUI & iOS`;
  const examplesHref = `/?examples=${article.manifestId}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: title,
      description: `Convert ${article.name} SVG icons into native SwiftUI Shapes for iOS apps.`,
      url: `${SITE_URL}/icons/${article.slug}`,
      author: { "@type": "Person", name: "Antoni Silvestrovic", url: "https://github.com/bring-shrubbery" },
      publisher: { "@type": "Organization", name: "Quassum", url: "https://quassum.com" },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: title,
      description: `Add a ${article.name} icon to a SwiftUI iOS app by converting its SVG into a SwiftUI Shape.`,
      step: [
        {
          "@type": "HowToStep",
          name: `Open the ${article.name} examples`,
          text: `Open the SVG to SwiftUI Converter with the ${article.name} library pre-selected in the Examples browser.`,
          url: `${SITE_URL}${examplesHref}`,
        },
        {
          "@type": "HowToStep",
          name: "Pick your icon",
          text: `Search the ${article.name} grid and click the icon you want — its SVG loads into the editor.`,
        },
        {
          "@type": "HowToStep",
          name: "Convert to SwiftUI",
          text: "Press Convert & Copy to turn the SVG into a native SwiftUI Shape.",
        },
        {
          "@type": "HowToStep",
          name: "Paste into Xcode",
          text: "Paste the generated Swift struct into your iOS project and use it like any other view.",
        },
      ],
    },
  ];

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires this, data is a static constant */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1>{title}</h1>

      <p>
        {article.blurb} This guide shows you how to use <strong>{article.name}</strong> icons in your SwiftUI and iOS
        apps. SwiftUI can&apos;t render SVG or icon-font files directly, so the cleanest way to get a{" "}
        {article.name} icon onto an iPhone, iPad, or Mac screen is to convert it into a native SwiftUI{" "}
        <code>Shape</code>.
      </p>

      <p>
        <Link href={examplesHref}>
          Open the converter with {article.name} icons →
        </Link>{" "}
        ({article.count.toLocaleString()} icons, {article.license}, from{" "}
        <a href={article.vendorUrl} target="_blank" rel="noopener noreferrer">
          {article.vendorUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
        ).
      </p>

      <h2>Why you can&apos;t drop an SVG icon straight into SwiftUI</h2>
      <p>
        SwiftUI&apos;s <code>Image</code> view supports PNG, JPEG, PDF, and SF Symbols — but not raw SVG files or icon
        fonts like {article.name}. Converting the icon to a SwiftUI <code>Shape</code> gives you a
        resolution-independent vector that scales perfectly at any size and can be filled, stroked, and animated like
        any other SwiftUI view.
      </p>

      <h2>Add a {article.name} icon to SwiftUI in 4 steps</h2>
      <ol>
        <li>
          <strong>Open the {article.name} examples.</strong>{" "}
          <Link href={examplesHref}>Launch the converter with {article.name} pre-selected</Link> in the Examples
          browser.
        </li>
        <li>
          <strong>Pick your icon.</strong> Search the grid and click the icon you want — its SVG loads into the editor.
        </li>
        <li>
          <strong>Convert to SwiftUI.</strong> Press <em>Convert &amp; Copy</em> to generate a native SwiftUI{" "}
          <code>Shape</code>.
        </li>
        <li>
          <strong>Paste into Xcode.</strong> Drop the Swift struct into your iOS project and use it like any other view.
        </li>
      </ol>

      <h2>Example: the {article.name} &ldquo;{example.iconName}&rdquo; icon in SwiftUI</h2>
      <p>
        Starting from the original {article.name} <code>{example.iconName}</code> SVG source:
      </p>
      <pre>
        <code>{example.svg}</code>
      </pre>
      <p>
        the converter produces this native SwiftUI <code>Shape</code>:
      </p>
      <pre>
        <code>{example.swift}</code>
      </pre>
      <p>Then use it anywhere in your SwiftUI layout:</p>
      <pre>
        <code>{`${toUsageName(example.swift)}()
    .fill(Color.accentColor)
    .frame(width: 100, height: 100)`}</code>
      </pre>

      <h2>Frequently asked questions</h2>
      <h3>Is {article.name} free to use in iOS apps?</h3>
      <p>
        {article.name} is distributed under the {article.license}. Always check the official{" "}
        <a href={article.vendorUrl} target="_blank" rel="noopener noreferrer">
          {article.name} license
        </a>{" "}
        for the exact terms before shipping.
      </p>
      <h3>Do I need a third-party package to use {article.name} in SwiftUI?</h3>
      <p>
        No. Converting the icon to a SwiftUI <code>Shape</code> produces plain SwiftUI code with no dependencies — paste
        it straight into your project.
      </p>

      <h2>Convert your {article.name} icon now</h2>
      <p>
        <Link href={examplesHref}>Open the {article.name} icon browser</Link>, pick an icon, and copy the SwiftUI code.
        For more detail on how the conversion works, read the{" "}
        <Link href="/convert-svg-to-swiftui">SVG to SwiftUI guide</Link>.
      </p>
    </>
  );
}

/** Extracts the generated struct name (e.g. "StarShape") for the usage snippet. */
function toUsageName(swift: string): string {
  const match = swift.match(/struct\s+(\w+)\s*:/);
  return match?.[1] ?? "MyIconShape";
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/nextjs && bun run typecheck`
Expected: No new errors referencing the new page.

- [ ] **Step 3: Start the dev server and verify all 5 pages render**

Start the dev server (preview tool) with `bun dev` in `apps/nextjs`. For each slug in `font-awesome`, `material-design-icons`, `heroicons`, `lucide`, `bootstrap-icons`, load `/icons/<slug>` and confirm via DOM eval:
- `document.title` starts with `How to Use ` and contains the pack name.
- `document.querySelector('article h1')` text matches the title.
- A `<pre><code>` block contains `struct` and `Shape` (the real converted example).
- `link[rel=canonical]` href ends with `/icons/<slug>`.
- JSON-LD parses to types `[["TechArticle","HowTo"], "WebApplication"]`.
- `preview_console_logs` (level error) is empty.

Expected: all checks pass for all 5 slugs.

- [ ] **Step 4: Verify an unknown slug 404s**

Load `/icons/does-not-exist` and confirm it renders the Next.js 404 (not a server error). Check `preview_console_logs` has no unhandled exceptions.

- [ ] **Step 5: Commit**

```bash
git add "apps/nextjs/src/app/(documents)/icons/[pack]/page.tsx"
git commit -m "feat(nextjs): add per-icon-pack SwiftUI guide pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Deep-link the Examples dialog via ?examples=

**Files:**
- Modify: `apps/nextjs/src/components/examples-dialog.tsx`
- Modify: `apps/nextjs/src/components/toolbar.tsx`

**Interfaces:**
- Consumes: `useSearchParams` from `next/navigation`.
- Produces: visiting `/?examples=<manifestId>` opens the Examples dialog with that library pre-selected.

- [ ] **Step 1: Read the param and auto-open in `examples-dialog.tsx`**

In `apps/nextjs/src/components/examples-dialog.tsx`, add the `next/navigation` import at the top of the import block:

```tsx
import { useSearchParams } from "next/navigation";
```

Inside `ExamplesDialog`, immediately after `const [open, setOpen] = useState(false);` add:

```tsx
  const searchParams = useSearchParams();
  const examplesParam = searchParams.get("examples");
```

Then add an effect (place it next to the other `useEffect`s) that opens the dialog when the param is present:

```tsx
  // Auto-open from a deep link like /?examples=fa6
  useEffect(() => {
    if (examplesParam) setOpen(true);
  }, [examplesParam]);
```

- [ ] **Step 2: Pre-select the requested library when the manifest loads**

In the same file, replace the existing manifest-load effect:

```tsx
  // Load manifest on first open
  useEffect(() => {
    if (!open || manifest.length > 0) return;
    fetch("/data/icons/manifest.json")
      .then((r) => r.json())
      .then((data: ManifestEntry[]) => {
        setManifest(data);
        if (data.length > 0 && !activeLibrary) {
          setActiveLibrary(data[0]!.id);
        }
      })
      .catch(console.error);
  }, [open, manifest.length, activeLibrary]);
```

with this version (pre-selects the deep-linked library if valid, else first):

```tsx
  // Load manifest on first open
  useEffect(() => {
    if (!open || manifest.length > 0) return;
    fetch("/data/icons/manifest.json")
      .then((r) => r.json())
      .then((data: ManifestEntry[]) => {
        setManifest(data);
        if (data.length > 0 && !activeLibrary) {
          const wanted = examplesParam && data.some((lib) => lib.id === examplesParam) ? examplesParam : null;
          setActiveLibrary(wanted ?? data[0]!.id);
        }
      })
      .catch(console.error);
  }, [open, manifest.length, activeLibrary, examplesParam]);
```

- [ ] **Step 3: Wrap `ExamplesDialog` in a Suspense boundary in `toolbar.tsx`**

`useSearchParams()` requires a Suspense boundary. In `apps/nextjs/src/components/toolbar.tsx`, add `Suspense` to the React import (the file currently has no React import — add one) and wrap the dialog.

Add at the top of the import block:

```tsx
import { Suspense } from "react";
```

Replace:

```tsx
        <VideoTutorialPopover />
        <ExamplesDialog onSelect={onExampleSelect} />
```

with:

```tsx
        <VideoTutorialPopover />
        <Suspense fallback={null}>
          <ExamplesDialog onSelect={onExampleSelect} />
        </Suspense>
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/nextjs && bun run typecheck`
Expected: No new errors in `examples-dialog.tsx` or `toolbar.tsx`.

- [ ] **Step 5: Verify the deep link opens the filtered dialog**

With the dev server running, load `/?examples=fa6`. Verify via DOM:
- A dialog with title "Icon Examples" is open (`document.querySelector('[role=dialog]')` present).
- The active library button (the one with the `bg-accent font-medium` classes) reads "Font Awesome 6".
Then load `/?examples=bs` and confirm the active library is "Bootstrap Icons".
Then load `/` (no param) and confirm the dialog is NOT open.
Check `preview_console_logs` (error) is empty in all cases.

Expected: dialog opens pre-filtered for valid ids; stays closed with no param.

- [ ] **Step 6: Verify the production build does not bail on Suspense**

Run: `cd apps/nextjs && bun run build`
Expected: build completes; no "useSearchParams() should be wrapped in a suspense boundary" error. (If the full monorepo build is slow, building just the nextjs app is sufficient to catch the Suspense error.)

- [ ] **Step 7: Commit**

```bash
git add apps/nextjs/src/components/examples-dialog.tsx apps/nextjs/src/components/toolbar.tsx
git commit -m "feat(nextjs): deep-link Examples dialog via ?examples= param

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Sitemap entries and internal links

**Files:**
- Modify: `apps/nextjs/src/app/sitemap.ts`
- Modify: `apps/nextjs/src/app/(documents)/convert-svg-to-swiftui/page.tsx`
- Modify: `apps/nextjs/src/components/HomeContent.tsx`

**Interfaces:**
- Consumes: `ICON_PACK_ARTICLES` from `@/lib/icon-pack-articles`.
- Produces: 5 `/icons/<slug>` URLs in the sitemap; internal links from the guide page and homepage.

- [ ] **Step 1: Add the article URLs to the sitemap**

In `apps/nextjs/src/app/sitemap.ts`, add the import at the top:

```ts
import { ICON_PACK_ARTICLES } from "@/lib/icon-pack-articles";
```

Then add the mapped entries to the returned array (after the `/convert-svg-to-swiftui` entry, before `/privacy-policy`):

```ts
    ...ICON_PACK_ARTICLES.map((article) => ({
      url: `https://svg-to-swiftui.quassum.com/icons/${article.slug}`,
      lastModified: "2026-06-20",
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
```

- [ ] **Step 2: Add an "Icon pack guides" list to the guide page**

In `apps/nextjs/src/app/(documents)/convert-svg-to-swiftui/page.tsx`, add the import:

```tsx
import { ICON_PACK_ARTICLES } from "@/lib/icon-pack-articles";
```

Then, immediately before the final `<h2>Ready to convert your SVG?</h2>` section, insert:

```tsx
      <h2>Using a specific icon pack?</h2>
      <p>These guides show how to bring popular icon libraries into SwiftUI and iOS:</p>
      <ul>
        {ICON_PACK_ARTICLES.map((article) => (
          <li key={article.slug}>
            <Link href={`/icons/${article.slug}`}>How to use {article.name} in SwiftUI</Link>
          </li>
        ))}
      </ul>
```

(`Link` is already imported in this file.)

- [ ] **Step 3: Add a homepage link to the icon-pack guides**

In `apps/nextjs/src/components/HomeContent.tsx`, find the paragraph that links to the step-by-step guide:

```tsx
        <p>
          New to this? Read the{" "}
          <a href="/convert-svg-to-swiftui" className="font-medium text-foreground underline underline-offset-4">
            step-by-step guide to converting SVG to SwiftUI
          </a>
          .
        </p>
```

Replace it with:

```tsx
        <p>
          New to this? Read the{" "}
          <a href="/convert-svg-to-swiftui" className="font-medium text-foreground underline underline-offset-4">
            step-by-step guide to converting SVG to SwiftUI
          </a>
          , or jump to a guide for{" "}
          <a href="/icons/font-awesome" className="font-medium text-foreground underline underline-offset-4">
            Font Awesome
          </a>
          ,{" "}
          <a href="/icons/material-design-icons" className="font-medium text-foreground underline underline-offset-4">
            Material Design
          </a>
          , or{" "}
          <a href="/icons/heroicons" className="font-medium text-foreground underline underline-offset-4">
            Heroicons
          </a>{" "}
          icons.
        </p>
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/nextjs && bun run typecheck`
Expected: No new errors in the three modified files.

- [ ] **Step 5: Verify sitemap and links**

With the dev server running:
- Fetch `/sitemap.xml`; confirm it contains all 5 URLs: `/icons/font-awesome`, `/icons/material-design-icons`, `/icons/heroicons`, `/icons/lucide`, `/icons/bootstrap-icons`.
- Load `/convert-svg-to-swiftui`; confirm the "Using a specific icon pack?" list renders 5 links.
- Load `/` (homepage); confirm the HomeContent paragraph now links to the three icon-pack guides.
Check `preview_console_logs` (error) is empty.

Expected: sitemap has all 5 URLs; both internal-link locations render.

- [ ] **Step 6: Commit**

```bash
git add apps/nextjs/src/app/sitemap.ts "apps/nextjs/src/app/(documents)/convert-svg-to-swiftui/page.tsx" apps/nextjs/src/components/HomeContent.tsx
git commit -m "feat(nextjs): add icon-pack guides to sitemap and internal links

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] `cd apps/nextjs && bun run typecheck` — only the pre-existing unrelated errors remain.
- [ ] `cd apps/nextjs && bun run build` — completes with all 5 `/icons/<slug>` pages statically generated and no Suspense bail error.
- [ ] Spot-check one article page end-to-end: open `/icons/font-awesome`, click the "Open the converter with Font Awesome icons" CTA, confirm it lands on `/?examples=fa6` with the dialog open and Font Awesome 6 selected.
- [ ] `git log --oneline -6` shows the 5 task commits in order.
- [ ] Push: `git push origin main`.
