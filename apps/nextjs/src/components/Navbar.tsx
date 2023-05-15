import { SVGtoSwiftUILogo } from "./S2SLogo";
import { IoLogoGithub } from "react-icons/io5";
import { IconLink } from "./IconLink";
import { DarkmodeToggle } from "./darkmode-toggle";
import Link from "next/link";
import { QuassumType } from "./quassum-type";

export const Navbar = () => {
  return (
    <header className="w-full px-6 py-2 bg-white dark:bg-zinc-800 flex justify-between select-none items-center">
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
            href="https://quassum.com"
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
        <div className="mx-4 rounded-lg overflow-hidden border-2 border-transparent">
          <iframe
            src="https://github.com/sponsors/bring-shrubbery/button"
            title="Sponsor bring-shrubbery"
            height="32"
            width="120"
            className="block rounded-md"
          ></iframe>
        </div>

        <DarkmodeToggle />

        <IconLink href="https://github.com/quassum/SVG-to-SwiftUI">
          <IoLogoGithub className="w-8 h-8" />
        </IconLink>
      </div>
    </header>
  );
};
