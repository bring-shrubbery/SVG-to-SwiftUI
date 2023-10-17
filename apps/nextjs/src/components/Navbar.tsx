import { SVGtoSwiftUILogo } from "./icons/S2SLogo";
import { IoLogoGithub } from "react-icons/io5";
import { IconLink } from "./IconLink";
import { DarkModeToggle } from "./darkmode-toggle";
import Link from "next/link";
import { QuassumType } from "./icons/quassum-type";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { StarIcon } from "lucide-react";
import CountingNumbers from "./counting-numbers";

export function Navbar({ githubStars }: { githubStars?: number }) {
  return (
    <header className="w-full px-6 py-2 bg-white dark:bg-zinc-900/40 flex justify-between select-none items-center">
      {/* Left side content */}
      <div className="flex h-full items-center">
        <SVGtoSwiftUILogo width={64} height={64} className="w-16 h-16" />

        <div className="relative hidden sm:block ">
          <h1
            className="font-bold text-4xl pl-3 pt-1 bg-gradient-to-r from-[#F5E338] to-[#F05137] bg-clip-text"
            style={{
              WebkitTextFillColor: "transparent",
            }}
          >
            SVG to SwiftUI
          </h1>

          <Link
            href="https://quassum.com/?utm_source=svg-to-swiftui"
            className="absolute -bottom-5 right-0 flex items-bottom"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="mr-1 text-sm">by</span>
            <QuassumType className="h-4 w-auto" />
          </Link>
        </div>
      </div>

      {/* Right side content */}
      <div className="flex items-center text-slate-900 dark:text-slate-50">
        <div className="mx-4 rounded-lg overflow-hidden border-2 border-transparent hidden md:block">
          <iframe
            src="https://github.com/sponsors/bring-shrubbery/button"
            title="Sponsor bring-shrubbery"
            height="32"
            width="120"
            className="block rounded-md"
          ></iframe>
        </div>

        {githubStars && <StarOnGithubButton githubStars={githubStars} />}

        <DarkModeToggle />

        {/* <IconLink href="https://github.com/quassum/SVG-to-SwiftUI">
          <IoLogoGithub className="w-8 h-8" />
        </IconLink> */}
      </div>
    </header>
  );
}

export const StarOnGithubButton = ({
  githubStars,
}: {
  githubStars: number;
}) => {
  return (
    <div className="mr-2">
      <Link
        className={cn(
          buttonVariants({ variant: "outline" }),
          "gap-2 whitespace-pre md:flex overflow-hidden h-[34px]",
          "group relative justify-center transition-all duration-300 ease-out"
        )}
        href={"https://github.com/quassum/SVG-to-SwiftUI"}
      >
        <span className="absolute -right-10 -mt-12 h-32 w-8 translate-x-16 rotate-45 transform bg-white opacity-10 transition-all duration-1000 ease-out group-hover:-translate-x-40 blur-lg" />
        <IoLogoGithub className="h-4 w-4" />
        Star on GitHub
        <div className="hidden lg:flex items-center gap-1 text-sm text-zinc-50 w-[54px]">
          <StarIcon className="h-4 w-4 group-hover:text-yellow-300 transition-all duration-300" />
          <CountingNumbers
            value={githubStars}
            className="font-display font-medium text-white"
          />
        </div>
      </Link>
    </div>
  );
};
