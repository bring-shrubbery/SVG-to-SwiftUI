import "./globals.css";
import "allotment/dist/style.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { Providers } from "./providers";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const SITE_URL = "https://svg-to-swiftui.quassum.com";
const SITE_TITLE = "SVG to SwiftUI Converter";
const SITE_DESCRIPTION =
  "Convert SVG code into SwiftUI Shape structures instantly. Paste your SVG icon source code or upload a file and get the Swift code you need for your iOS app.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_TITLE}`,
  },
  applicationName: SITE_TITLE,
  description: SITE_DESCRIPTION,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  category: "Development tools",
  authors: [
    {
      name: "Antoni Silvestrovic",
      url: "https://github.com/bring-shrubbery",
    },
    {
      name: "Quassum",
      url: "https://quassum.com/",
    },
  ],
  publisher: "Quassum",
  creator: "Antoni Silvestrovic",
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
    },
  },
  keywords: [
    "svg to swiftui",
    "svg to swiftui converter",
    "convert svg to swiftui",
    "swiftui shape",
    "swiftui converter",
    "svg to swift",
    "convert svg to swift",
    "import svg into swiftui",
    "import svg into xcode",
    "svg on ios",
    "swiftui code",
    "swift code",
    "ios",
    "svg",
    "swiftui",
    "swift shape",
    "svg converter",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_TITLE,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Person",
    name: "Antoni Silvestrovic",
    url: "https://github.com/bring-shrubbery",
  },
  publisher: {
    "@type": "Organization",
    name: "Quassum",
    url: "https://quassum.com",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("h-screen w-full bg-background font-sans text-foreground antialiased", fontSans.variable)}>
        <Providers>{children}</Providers>
        <Toaster />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires this, data is a static constant */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>

      {/* umami.is Analytics Script (goes through vercel rewrite to analytics.quassum.com) */}
      {process.env.NODE_ENV === "production" && (
        <Script async src="/stats/script.js" data-website-id="2ceeb50c-1e4c-4206-b6a0-26558510a853" />
      )}
    </html>
  );
}
