import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeartIcon, StarIcon } from "lucide-react";
import { IoLogoGithub } from "react-icons/io5";

import CountingNumbers from "./counting-numbers";
import { DarkModeToggle } from "./darkmode-toggle";
import { QuassumType } from "./icons/quassum-type";
import { SVGtoSwiftUILogo } from "./icons/S2SLogo";

export function Navbar({
  githubStars,
  sticky,
}: {
  githubStars?: number;
  sticky?: boolean;
}) {
  // Active after September 17th 2024
  const isProductHuntActive = Date.now() > new Date("2024-09-17").getTime();

  return (
    <header
      className={cn(
        "flex w-full select-none items-center justify-between px-6 py-2",
        sticky && "fixed top-0 z-50 w-full bg-white dark:bg-background",
      )}
    >
      {/* Left side content */}
      <div className="flex h-full w-fit items-center">
        <a href="/" className="block">
          <SVGtoSwiftUILogo width={64} height={64} className="h-16 w-16" />
        </a>

        <div className="relative hidden sm:block">
          <a href="/">
            <h1
              className="bg-gradient-to-r from-[#F5E338] to-[#F05137] bg-clip-text pl-3 pt-1 text-4xl font-bold"
              style={{
                WebkitTextFillColor: "transparent",
              }}
            >
              {"SVG to SwiftUI"}
            </h1>
          </a>

          <Link
            href="https://quassum.com/?utm_source=svg-to-swiftui"
            className="items-bottom absolute -bottom-5 right-0 flex"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="mr-1 text-sm">by</span>
            <QuassumType className="h-4 w-auto" />
          </Link>
        </div>
      </div>

      {/* Right side content */}
      <div className="flex items-center">
        {isProductHuntActive ? (
          <a
            href="https://www.producthunt.com/posts/svg-to-swiftui-converter?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-svg&#0045;to&#0045;swiftui&#0045;converter"
            target="_blank"
            className="mx-4 hidden md:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=485547&theme=dark"
              alt="SVG&#0032;to&#0032;SwiftUI&#0032;Converter - SVG&#0032;icons&#0032;in&#0032;your&#0032;SwiftUI&#0032;project&#0032;in&#0032;a&#0032;minute&#0033; | Product Hunt"
              style={{ width: "176px", height: "38px" }}
              width="170"
              height="36"
            />
          </a>
        ) : (
          <Button
            variant="secondary"
            className="group mx-4 hidden gap-2 overflow-hidden rounded-lg border border-transparent border-zinc-200 dark:border-zinc-700 md:flex"
            asChild
          >
            <Link href="https://github.com/sponsors/bring-shrubbery">
              <HeartIcon
                size={20}
                className="-ml-1 h-5 w-5 min-w-5 text-pink-500 transition-transform group-hover:scale-110"
              />
              Sponsor
            </Link>
          </Button>
        )}

        {githubStars && <StarOnGithubButton githubStars={githubStars} />}

        <DarkModeToggle />

        {/* <IconLink href="https://github.com/bring-shrubbery/SVG-to-SwiftUI">
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
          "h-[38px] gap-2 overflow-hidden whitespace-pre md:flex",
          "group relative justify-center transition-all duration-300 ease-out",
        )}
        href={"https://github.com/bring-shrubbery/SVG-to-SwiftUI"}
      >
        <span className="absolute -right-10 -mt-12 h-32 w-8 translate-x-16 rotate-45 transform bg-white opacity-10 blur-lg transition-all duration-1000 ease-out group-hover:-translate-x-40" />
        <IoLogoGithub className="h-5 w-5 min-w-5" />
        Star on GitHub
        <div className="hidden w-[54px] items-center gap-1 text-sm text-zinc-50 lg:flex">
          <StarIcon className="h-4 w-4 transition-all duration-300 group-hover:text-yellow-300" />
          <CountingNumbers
            value={githubStars}
            className="font-display font-medium text-white"
          />
        </div>
      </Link>
    </div>
  );
};
