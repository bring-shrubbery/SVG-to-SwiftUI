import { Navbar } from "@/components/Navbar";
import { AnnouncementBar } from "@/components/announcement-bar";
import { App } from "./App";
import {
  getGithubStarsForRepo,
  getIconContent,
  getIconList,
} from "@/lib/utils";

export default async function Home() {
  // const iconList = await getIconList();
  // const content = await getIconContent(iconList);

  const githubStars = await getGithubStarsForRepo("quassum/SVG-to-SwiftUI");

  return (
    <>
      <AnnouncementBar />
      <Navbar githubStars={githubStars} />
      <main className="block text-black dark:text-white">
        <App exampleList={[]} />
      </main>
      {/* <ConsentToast /> */}
    </>
  );
}
