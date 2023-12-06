import { Navbar } from "@/components/Navbar";
import { AnnouncementBar } from "@/components/announcement-bar";
import { App } from "./App";
import { getGithubStarsForRepo } from "@/lib/utils";
import { get } from "@vercel/edge-config";

export default async function Home() {
  const githubStars = await getGithubStarsForRepo(
    "bring-shrubbery/SVG-to-SwiftUI"
  );

  const adsEnabled = (await get("svg-to-swiftui_ads_enabled")) ?? false;

  console.log("adsEnabled", adsEnabled);

  return (
    <>
      <AnnouncementBar />
      <Navbar githubStars={githubStars} />
      <main className="block text-black dark:text-white">
        <App exampleList={[]} ads={!!adsEnabled} />
      </main>
      {/* <ConsentToast /> */}
    </>
  );
}
