import { Navbar } from "@/components/Navbar";
import { getGithubStarsForRepo } from "@/lib/utils";

import { App } from "./App";

export const dynamic = "force-dynamic";

export default async function Home() {
  const githubStars = await getGithubStarsForRepo(
    "bring-shrubbery/SVG-to-SwiftUI",
  );

  return (
    <>
      <Navbar githubStars={githubStars} />
      <main>
        <App />
      </main>
    </>
  );
}
