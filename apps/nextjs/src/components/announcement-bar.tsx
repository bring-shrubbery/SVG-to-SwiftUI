"use client";

import { MouseEventHandler } from "react";
import Link from "next/link";
import { atom, useAtom } from "jotai";
import { XIcon } from "lucide-react";

import { analyticsAtom } from "./analytics";

export const announcementBarAtom = atom(false);

export const AnnouncementBar = ({ adsEnabled }: { adsEnabled: boolean }) => {
  const [announcementBarHidden, setAnnouncementBarHidden] =
    useAtom(announcementBarAtom);
  const [analytics] = useAtom(analyticsAtom);

  return (
    <div
      className={
        "relative w-full bg-zinc-100 py-3 text-black dark:bg-zinc-800/80 dark:text-white"
      }
      style={{
        display: announcementBarHidden ? "none" : "block",
      }}
    >
      {adsEnabled ? (
        <Banner2 onClick={() => analytics.track("banner_ad_quassum_design")} />
      ) : (
        <Banner1 />
      )}
      <span
        className="absolute right-0 top-0 flex h-full items-center px-2"
        onClick={() => {
          analytics.track("announcement_bar_close");
          setAnnouncementBarHidden(true);
        }}
      >
        <XIcon className="h-6 w-6 cursor-pointer rounded-full p-1 hover:bg-zinc-50 dark:hover:bg-zinc-600" />
      </span>
    </div>
  );
};

const Banner1 = () => {
  return (
    <p className="mx-auto w-fit px-8 text-center text-sm">
      🥳 Welcome to the redesigned SVG to SwiftUI converter! Functionality is
      limited for now, feel free to contribute on{" "}
      <Link
        href="https://github.com/bring-shrubbery/SVG-to-SwiftUI"
        className="font-normal text-blue-500 visited:text-purple-700 hover:text-blue-600 active:text-blue-700 dark:text-blue-300 dark:visited:text-purple-300 dark:hover:text-blue-400 dark:active:text-blue-200"
      >
        Github
      </Link>{" "}
      or{" "}
      <Link
        href="https://github.com/sponsors/bring-shrubbery"
        className="font-normal text-blue-500 visited:text-purple-700 hover:text-blue-600 active:text-blue-700 dark:text-blue-300 dark:visited:text-purple-300 dark:hover:text-blue-400 dark:active:text-blue-200"
      >
        support me financially
      </Link>{" "}
      🚀
    </p>
  );
};

const Banner2 = ({
  onClick,
}: {
  onClick: MouseEventHandler<HTMLAnchorElement>;
}) => {
  return (
    <p className="mx-auto w-fit px-8 text-center text-sm">
      Looking for a gift for a classy friend? 🎁 Check out our 3D printing
      store:{" "}
      <Link
        href="http://quassum.design/"
        className="font-normal text-blue-500 visited:text-purple-700 hover:text-blue-600 active:text-blue-700 dark:text-blue-300 dark:visited:text-purple-300 dark:hover:text-blue-400 dark:active:text-blue-200"
        onClick={onClick}
      >
        quassum.design
      </Link>
    </p>
  );
};
