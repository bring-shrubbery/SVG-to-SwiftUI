"use client";

import { Provider as JotaiProvider } from "jotai";
import PlausibleProvider from "next-plausible";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

export function Providers({ children }: PropsWithChildren) {
  return (
    <JotaiProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <PlausibleProvider domain="svg-to-swiftui.quassum.com">{children}</PlausibleProvider>
      </ThemeProvider>
    </JotaiProvider>
  );
}
