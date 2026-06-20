# Icon Pack SEO Articles — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)

## Problem

The site ranks #1 for "svg to swiftui" but has essentially one indexed content
page, so impressions are capped by keyword coverage. There is untapped demand
from developers searching how to use specific icon packs in their iOS apps
(e.g. "font awesome swiftui", "material icons ios"). The site already ships an
Examples feature backed by 31 `react-icons` libraries, but it is invisible to
search and reachable only by manual clicking.

## Goal

Publish a pilot set of SEO landing pages, one per popular icon pack, that target
"how to use [pack] in SwiftUI / iOS / iPhone" intent and funnel readers directly
into the Examples feature pre-filtered to that pack. Validate indexing and
traction before expanding to the remaining packs.

## Non-Goals

- Not covering all 31 packs in this iteration (pilot first, expand later).
- Not building per-icon pages (e.g. one page per individual icon).
- Not adding writable URL sync to the Examples dialog (read-on-mount only).
- No redesign of the Examples dialog UI beyond accepting an initial filter.

## Pilot Scope

Five packs, identified by their `react-icons` / manifest id:

| Pack | manifestId | slug |
|------|-----------|------|
| Font Awesome 6 | `fa6` | `font-awesome` |
| Material Design Icons | `md` | `material-design-icons` |
| Heroicons 2 | `hi2` | `heroicons` |
| Lucide | `lu` | `lucide` |
| Bootstrap Icons | `bs` | `bootstrap-icons` |

## Approach

Config-driven dynamic route with build-time-generated real converted examples.
Chosen over hand-written-per-page (duplication, poor scaling) and pure templating
(thin/doorway-page risk). A real converted icon per page makes each page unique,
dogfoods the converter, and keeps the pilot's indexing test meaningful.

## Architecture

### 1. Central config — `apps/nextjs/src/lib/icon-pack-articles.ts`

Single source of truth. One typed entry per pilot pack drives the route,
`generateStaticParams`, `generateMetadata`, and the sitemap. Shape:

```ts
interface IconPackArticle {
  manifestId: string;      // e.g. "fa6" — matches public/data/icons/<id>.json
  slug: string;            // e.g. "font-awesome" — URL segment
  name: string;            // e.g. "Font Awesome 6"
  vendorUrl: string;       // official pack homepage
  license: string;         // short license string
  count: number;           // icon count (from manifest)
  blurb: string;           // 1-2 sentence pack-specific intro
  sampleIconNames: string[]; // representative icon names for prose/examples
}

export const ICON_PACK_ARTICLES: IconPackArticle[] = [ /* 5 entries */ ];
export function getIconPackArticle(slug: string): IconPackArticle | undefined;
```

### 2. Article route — `apps/nextjs/src/app/(documents)/icons/[pack]/page.tsx`

- Lives in the `(documents)` route group, so it inherits the `prose` layout
  (including the `prose-code:before/after:content-none` backtick fix).
- `generateStaticParams()` returns the 5 slugs — all pages statically rendered.
- `generateMetadata({ params })` per pack:
  - `title` (absolute): "How to Use {name} Icons in SwiftUI & iOS"
  - `description`: pack-specific, includes "iOS"/"iPhone"/"Swift" terms
  - `alternates.canonical`: `/icons/{slug}`
  - OpenGraph (`type: article`) + Twitter card
- JSON-LD: `TechArticle` + `HowTo` (4 steps), same pattern as the existing
  `/convert-svg-to-swiftui` guide.
- Unknown slug → `notFound()`.

**Page content (per pack, for uniqueness / anti-thin-content):**
1. H1 "How to Use {name} Icons in SwiftUI & iOS"
2. Intro: what the pack is, who makes it (vendor link), license, icon count.
3. Why SwiftUI / iOS has no native SVG or icon-font rendering, so icons must be
   converted to a SwiftUI `Shape`.
4. Step-by-step (4 steps) using the deep link into Examples.
5. **One real converted icon**, generated at build time: pick a representative
   icon from the pack's JSON, rebuild its SVG via `iconDataToSvg`, run `convert`
   from `svg-to-swiftui-core`, render the SVG-in and the SwiftUI-out in `<pre>`.
6. Pack-specific FAQ (2-4 Q&A).
7. CTA button/link to `/?examples={manifestId}` and links to the main guide
   (`/convert-svg-to-swiftui`) and homepage.

**Build-time example generation:** server component reads
`public/data/icons/{manifestId}.json` (array of `[name, IconData]`), finds the
first `sampleIconNames` entry that exists, calls `iconDataToSvg(data)` then
`convert(svg, opts)`. Both are pure and already exist. If the named icon is not
found, fall back to the first icon in the file so the page never breaks.

### 3. Deep-linked Examples — `apps/nextjs/src/components/examples-dialog.tsx`

- Read `?examples=<manifestId>` via `useSearchParams`.
- On mount, if the param is present and matches a known library id, open the
  dialog with `activeLibrary` preset to that id.
- `useSearchParams` requires a `Suspense` boundary in the App Router; wrap the
  relevant client subtree (or the dialog) accordingly to avoid CSR-bailout
  build errors.
- Read-only: parse once on mount; do not write the URL back as the user clicks.
- Article CTA links resolve to `/?examples={manifestId}`.

### 4. Sitemap + internal links

- `apps/nextjs/src/app/sitemap.ts` maps over `ICON_PACK_ARTICLES` to append the
  5 `/icons/{slug}` URLs (priority ~0.7, monthly).
- Add an "Icon pack guides" list (linking the 5 articles) to the existing
  `/convert-svg-to-swiftui` guide page.
- Add one internal link from the homepage FAQ/content section to the icon-pack
  guides.

## Data Flow

```
ICON_PACK_ARTICLES (config)
   ├──> generateStaticParams ──> 5 static pages
   ├──> generateMetadata ──────> per-page <title>/canonical/OG + JSON-LD
   ├──> page body ─────────────> reads public/data/icons/<id>.json
   │                              └─ iconDataToSvg ─> convert ─> rendered code
   ├──> CTA link ──────────────> /?examples=<manifestId>
   │                              └─ examples-dialog reads ?examples= on mount
   └──> sitemap.ts ────────────> /icons/<slug> entries
```

## Error Handling

- Unknown `[pack]` slug → `notFound()` (404).
- `?examples=` with an unknown/typo'd id → ignored; dialog behaves as default.
- Missing sample icon in JSON → fall back to first icon in the file.
- Icon JSON read/convert failure at build → fail the build loudly (these are
  static pages; a broken example should not ship silently).

## Testing / Verification

- `bun run typecheck` clean for all new/changed files.
- Each of the 5 pages renders (preview): correct H1/title, real converted code
  block present, JSON-LD parses to `[TechArticle, HowTo]`.
- Deep link `/?examples=fa6` opens the Examples dialog with Font Awesome 6
  preselected (verify via preview interaction).
- `/sitemap.xml` includes all 5 `/icons/<slug>` URLs.
- No console errors on article pages or the deep-linked homepage.

## Future Expansion (out of scope now)

- Add remaining packs by appending config rows once the pilot shows traction.
- Optional: brand-logo-intent variant for Simple Icons (different content shape).
- Optional: per-pack OG images.
```
