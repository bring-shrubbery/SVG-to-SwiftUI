import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/llms.txt"],
    },
    sitemap: "https://svg-to-swiftui.quassum.com/sitemap.xml",
  };
}
