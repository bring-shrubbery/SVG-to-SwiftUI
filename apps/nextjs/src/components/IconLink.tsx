"use client";

import { cn } from "@/lib/utils";
import Link, { type LinkProps } from "next/link";
import { PropsWithChildren } from "react";
import { toggleVariants } from "./toggle";

export const IconLink = ({
  href,
  children,
  ...props
}: PropsWithChildren<LinkProps>) => {
  return (
    <Link
      href={href}
      className={cn(toggleVariants(), "p-0 w-12 h-12 rounded-full")}
      {...props}
    >
      {children}
    </Link>
  );
};
