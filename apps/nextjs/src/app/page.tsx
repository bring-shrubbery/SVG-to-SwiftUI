import { AnnouncementBar } from "@/components/announcement-bar";
import { Navbar } from "@/components/Navbar";
import { getGithubStarsForRepo } from "@/lib/utils";
import { get } from "@vercel/edge-config";

import { App } from "./App";

export const dynamic = "force-dynamic";

export default async function Home() {
  const githubStars = await getGithubStarsForRepo(
    "bring-shrubbery/SVG-to-SwiftUI",
  );

  const adsEnabled = await get<boolean>("svg-to-swiftui_ads_enabled");

  return (
    <>
      <AnnouncementBar adsEnabled={!!adsEnabled} />
      <Navbar githubStars={githubStars} />
      <main>
        <App exampleList={[]} />
      </main>
      {/* <ConsentToast /> */}
    </>
  );
}
