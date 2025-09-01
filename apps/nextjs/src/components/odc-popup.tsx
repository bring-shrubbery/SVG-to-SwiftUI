"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import Balancer from "react-wrap-balancer";

export const ODC = () => {
  const [isOpen, setIsOpen] = useState(true);

  // Respect users who prefer reduced motion by skipping the intro animation
  const [canAnimate, setCanAnimate] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: no-preference)");
    setCanAnimate(mq.matches);
  }, []);

  if (!isOpen) return null;

  return (
    <aside
      role="dialog"
      aria-label="Promoted: OneDollarChatbot"
      className={[
        "fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)]",
        "overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90",
        canAnimate ? "animate-[odcIn_300ms_ease-out]" : "",
      ].join(" ")}
      // simple keyframes via inline style so we don't require Tailwind config
      style={
        {
          "--tw-translate-y": "8px",
          animationName: canAnimate ? "odcIn" : undefined,
        } as React.CSSProperties
      }
    >
      {/* Close */}
      <button
        onClick={() => setIsOpen(false)}
        aria-label="Dismiss"
        className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus:ring-zinc-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 1 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z" />
        </svg>
      </button>

      <div className="grid grid-cols-[128px_280px]">
        {/* Logo */}
        <div className="flex h-full w-full items-center justify-center bg-zinc-100 p-4 dark:bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/odc.jpg"
            alt="OneDollarChatbot logo"
            className="h-16 w-16 rounded-2xl object-contain ring-1 ring-zinc-200 dark:ring-zinc-800"
          />
        </div>

        {/* Content */}
        <div className="w-full bg-zinc-50 px-4 py-4 pb-3 dark:bg-zinc-900">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              onedollarchatbot.com
            </span>
          </div>
          <Balancer
            as="h3"
            className="text-sm font-semibold leading-tight text-zinc-900 dark:text-zinc-100"
          >
            Add AI-first customer support to your site — from $1
          </Balancer>
          <Balancer className="mt-1 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            Lightning-fast, on-brand answers embedded on your site.
            <br />
            Launch in minutes.
          </Balancer>

          <div className="mt-3 flex w-full items-center gap-4">
            <a
              href="https://onedollarchatbot.com/?utm_source=svg-to-swiftui&utm_medium=popup&utm_campaign=product_xpromo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-black/40 dark:bg-zinc-100 dark:text-zinc-900 dark:focus:ring-white/40"
            >
              Open
              <ExternalLinkIcon className="-mt-px h-3.5 w-3.5" />
            </a>

            <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              Made by the creator
              <br />
              of <span className="font-semibold">SVG to SwiftUI</span>
            </p>
          </div>
        </div>
      </div>

      {/* Inline keyframes so no Tailwind config needed */}
      <style jsx>{`
        :root {
          color-scheme: light dark;
        }
        @keyframes odcIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </aside>
  );
};
