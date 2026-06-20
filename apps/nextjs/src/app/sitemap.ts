import type { MetadataRoute } from "next";

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
