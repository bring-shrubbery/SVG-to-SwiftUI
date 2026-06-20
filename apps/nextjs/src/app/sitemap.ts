import type { MetadataRoute } from "next";
import { ICON_PACK_ARTICLES } from "@/lib/icon-pack-articles";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://svg-to-swiftui.quassum.com",
      lastModified: "2026-06-20",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://svg-to-swiftui.quassum.com/convert-svg-to-swiftui",
      lastModified: "2026-06-20",
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...ICON_PACK_ARTICLES.map((article) => ({
      url: `https://svg-to-swiftui.quassum.com/icons/${article.slug}`,
      lastModified: "2026-06-20",
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: "https://svg-to-swiftui.quassum.com/privacy-policy",
      lastModified: "2024-10-26",
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://svg-to-swiftui.quassum.com/terms-and-conditions",
      lastModified: "2024-10-26",
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://svg-to-swiftui.quassum.com/llms.txt",
      lastModified: "2026-04-19",
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
