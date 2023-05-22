import "./globals.css";
import "allotment/dist/style.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { PropsWithChildren } from "react";

// import { Analytics } from "@vercel/analytics/react";

import { Providers } from "./providers";
import { Toaster } from "@/components/toaster";
import { AnalyticsProvider } from "@/components/analytics";

const inter = Inter({ subsets: ["latin"] });

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
      <body
        className={[
          inter.className,
          "h-full bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 w-full",
        ].join(" ")}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
      <AnalyticsProvider />
    </html>
  );
}
