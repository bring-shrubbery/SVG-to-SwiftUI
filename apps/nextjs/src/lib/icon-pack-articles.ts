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
