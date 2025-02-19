"use client";

import dynamic from "next/dynamic";

export const AnalyticsPopupDynamic = dynamic(
  () => import("./analytics-popup"),
  { loading: () => null, ssr: false },
);
