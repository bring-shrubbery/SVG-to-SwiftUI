import "./globals.css";
import "allotment/dist/style.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { PropsWithChildren } from "react";

import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";
import { AnalyticsProvider } from "@/components/analytics";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SVG to SwiftUI Converter",
  description:
    "SVG to SwiftUI converter let's you convert raw svg code into a SwiftUI Shape structure. Just paste your SVG icon source code or upload a file and get the Swift code you need for your iOS app!",
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
  alternates: {
    canonical: "https://svg-to-swiftui.quassum.com/",
    languages: {
      en: "https://svg-to-swiftui.quassum.com/",
    },
  },
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning className="h-[100vh]">
      <head>
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3063505422248547"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={[
          fontSans.className,
          "antialiased h-full bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 w-full font-sans",
        ].join(" ")}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <Analytics />
        <AnalyticsProvider />
      </body>

      {/* umami.is Analytics Script (goes through vercel rewrite to analytics.quassum.com) */}
      <Script
        async
        src="/stats/script.js"
        data-website-id="2ceeb50c-1e4c-4206-b6a0-26558510a853"
      />
    </html>
  );
}
