"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
// @ts-ignore
import gtm from "@analytics/google-tag-manager";
import { Analytics } from "analytics";
import { atom, useAtom } from "jotai";

/* Initialize analytics */
export const analyticsAtom = atom(
  Analytics({
    app: "svg-to-swiftui.quassum.com",
    // version: "333",
    plugins: [
      gtm({
        containerId: "G-ZFKXYDSQD7",
      }),
    ],
  }),
);

export const AnalyticsProvider = () => {
  const [analytics] = useAtom(analyticsAtom);
  const router = useRouter();

  /* Track a page view */
  useEffect(() => {
    analytics.page();
  }, [analytics, router]);

  return null;
};
