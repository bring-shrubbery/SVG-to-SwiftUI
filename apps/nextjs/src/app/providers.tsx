"use client";

import { PropsWithChildren } from "react";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: PropsWithChildren) {
  return (
    <JotaiProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </JotaiProvider>
  );
}
