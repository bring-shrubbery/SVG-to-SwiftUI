import "./globals.css";
import "allotment/dist/style.css";

import type { Metadata } from "next";
import type { PropsWithChildren, ReactNode } from "react";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import Script from "next/script";
import { AnalyticsPopup } from "@/components/analytics-popup";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/react";

import { Providers } from "./providers";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SVG to SwiftUI Converter",
  applicationName: "SVG to SwiftUI Converter",
  description:
    "SVG to SwiftUI converter let's you convert raw svg code into a SwiftUI Shape structure. Just paste your SVG icon source code or upload a file and get the Swift code you need for your iOS app!",
  robots: {
    index: true,
    follow: false,
    googleBot: {
      index: true,
      follow: false,
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
    canonical: "https://svg-to-swiftui.quassum.com/",
    languages: {
      en: "https://svg-to-swiftui.quassum.com/",
    },
  },
  keywords: [
    "how to convert svg to swiftui",
    "how to get svg into swift code",
    "svg",
    "swiftui",
    "converter",
    "svg to swiftui",
    "svg to swiftui converter",
    "swiftui converter",
    "svg converter",
    "svg to swift",
    "svg to swift converter",
    "swift converter",
    "swiftui code",
    "swift code",
    "swiftui shape",
    "swift shape",
    "convert svg to swiftui",
    "convert svg to swift",
    "ios",
  ],
};

export default function RootLayout({
  children,
  announcement,
}: PropsWithChildren<{ announcement: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "h-screen w-full bg-background font-sans text-foreground antialiased",
          fontSans.variable,
        )}
      >
        <Providers>
          <Suspense>{announcement}</Suspense>

          {children}
        </Providers>
        <Toaster />
        <Analytics />

        <Suspense>
          <AnalyticsPopup />
        </Suspense>
      </body>

      {/* umami.is Analytics Script (goes through vercel rewrite to analytics.quassum.com) */}
      {process.env.NODE_ENV === "production" && (
        <Script
          async
          src="/stats/script.js"
          data-website-id="2ceeb50c-1e4c-4206-b6a0-26558510a853"
        />
      )}
    </html>
  );
}
