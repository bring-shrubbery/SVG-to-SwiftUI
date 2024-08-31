import { get } from "@vercel/edge-config";

import { AnnouncementManager } from "./announcement-manager";

export default async function Page() {
  const adsEnabled = await get<boolean>("svg-to-swiftui_ads_enabled");

  if (adsEnabled === false) return null;

  return <AnnouncementManager />;
}
