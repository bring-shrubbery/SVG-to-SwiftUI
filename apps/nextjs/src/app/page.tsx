import { Navbar } from "@/components/Navbar";
import { AnnouncementBar } from "@/components/announcement-bar";
import { App } from "./App";
import { getGithubStarsForRepo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function Home() {
  const githubStars = await getGithubStarsForRepo(
    "bring-shrubbery/SVG-to-SwiftUI"
  );

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
