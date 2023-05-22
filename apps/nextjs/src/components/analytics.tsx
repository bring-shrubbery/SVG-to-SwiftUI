"use client";

import { Analytics } from "analytics";
// @ts-ignore
import gtm from "@analytics/google-tag-manager";
// @ts-ignore
import googleAnalytics from "@analytics/google-analytics";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { atom, useAtom } from "jotai";

/* Initialize analytics */
export const analyticsAtom = atom(
  Analytics({
    app: "svg-to-swiftui.quassum.com",
    version: "333",
    plugins: [
      gtm({
        containerId: "G-ZFKXYDSQD7",
      }),
      googleAnalytics({
        trackingId: "G-ZFKXYDSQD7",
      }),
    ],
  })
);

export const AnalyticsProvider = () => {
  const [analytics] = useAtom(analyticsAtom);
  const router = useRouter();

  /* Track a page view */
  useEffect(() => {
    analytics.page();
  }, [router]);

  return null;
};
