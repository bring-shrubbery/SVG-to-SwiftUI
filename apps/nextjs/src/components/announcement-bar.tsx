"use client";

import Link from "next/link";
import { XIcon } from "lucide-react";
import { atom, useAtom } from "jotai";
import { analyticsAtom } from "./analytics";

export const announcementBarAtom = atom(false);

export const AnnouncementBar = () => {
  const [announcementBarHidden, setAnnouncementBarHidden] =
    useAtom(announcementBarAtom);
  const [analytics] = useAtom(analyticsAtom);

  return (
    <div
      className={
        "relative w-full py-3 bg-zinc-100 text-black dark:bg-zinc-800 dark:text-white"
      }
      style={{
        display: announcementBarHidden ? "none" : "block",
      }}
    >
      <p className="px-8 mx-auto w-fit text-sm text-center">
        🥳 Welcome to the redesigned SVG to SwiftUI converter! Functionality is
        limited for now, feel free to contribute on{" "}
        <Link
          href="https://github.com/quassum/SVG-to-SwiftUI"
          className="text-blue-500 dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-400 active:text-blue-700 dark:active:text-blue-200 visited:text-purple-700 dark:visited:text-purple-300 font-normal"
        >
          Github
        </Link>{" "}
        or{" "}
        <Link
          href="https://github.com/sponsors/bring-shrubbery"
          className="text-blue-500 dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-400 active:text-blue-700 dark:active:text-blue-200 visited:text-purple-700 dark:visited:text-purple-300 font-normal"
        >
          support me financially
        </Link>{" "}
        🚀
      </p>
      <span
        className="absolute px-2 right-0 top-0 h-full flex items-center"
        onClick={() => {
          analytics.track("announcement_bar_close");
          setAnnouncementBarHidden(true);
        }}
      >
        <XIcon className="w-6 h-6 p-1 hover:bg-zinc-50 dark:hover:bg-zinc-600 rounded-full cursor-pointer" />
      </span>
    </div>
  );
};
