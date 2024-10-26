import type { PropsWithChildren } from "react";
import { Navbar } from "@/components/Navbar";
import { getGithubStarsForRepo } from "@/lib/utils";

export default async function Layout({ children }: PropsWithChildren) {
  const githubStars = await getGithubStarsForRepo(
    "bring-shrubbery/SVG-to-SwiftUI",
  );

  return (
    <>
      <Navbar githubStars={githubStars} />

      <main className="w-full bg-white dark:bg-background">
        <article className="prose prose-zinc dark:prose-invert mx-auto max-w-screen-md px-4 pb-32 pt-12">
          {children}
        </article>
      </main>
    </>
  );
}
