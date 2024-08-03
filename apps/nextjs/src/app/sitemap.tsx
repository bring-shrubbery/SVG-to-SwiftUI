import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://svg-to-swiftui.quassum.com",
      lastModified: new Date(),
      priority: 1,
    },
    {
      url: "https://svg-to-swiftui.quassum.com/privacy-policy",
      lastModified: new Date(),
      priority: 0.8,
    },
    {
      url: "https://svg-to-swiftui.quassum.com/terms-and-conditions",
      lastModified: new Date(),
      priority: 0.5,
    },
  ];
}
