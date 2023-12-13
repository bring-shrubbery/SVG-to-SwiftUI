import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/_next/*", "/api/*", "/pagead/*", "/stats/*"],
    },
    sitemap: "https://svg-to-swiftui.quassum.com/sitemap.xml",
  };
}
