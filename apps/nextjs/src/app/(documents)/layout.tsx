import { Navbar } from "@/components/Navbar";
import { getGithubStarsForRepo } from "@/lib/utils";
import type { PropsWithChildren } from "react";

export default async function Layout({ children }: PropsWithChildren) {
  const githubStars = await getGithubStarsForRepo(
    "bring-shrubbery/SVG-to-SwiftUI"
  );

  return (
    <>
      <Navbar githubStars={githubStars} />

      <main className="w-full bg-white dark:bg-zinc-900/40">
        <article className="pt-12 pb-32 prose prose-zinc dark:prose-invert mx-auto max-w-screen-md px-4">
          {children}
        </article>
      </main>
    </>
  );
}
