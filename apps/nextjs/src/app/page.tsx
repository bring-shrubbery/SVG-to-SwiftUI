import { Navbar } from "@/components/Navbar";
import { ODC } from "@/components/odc-popup";
import { getGithubStarsForRepo } from "@/lib/utils";

import { App } from "./App";

export const revalidate = 3600;

export default async function Home() {
  const githubStars = await getGithubStarsForRepo("bring-shrubbery/SVG-to-SwiftUI");

  return (
    <>
      <Navbar githubStars={githubStars} />
      <main>
        <App />
      </main>
      <ODC />
    </>
  );
}
