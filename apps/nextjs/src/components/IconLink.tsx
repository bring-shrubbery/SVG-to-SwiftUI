"use client";

import type { LinkProps } from "next/link";
import type { PropsWithChildren } from "react";
import Link from "next/link";
import { toggleVariants } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

export const IconLink = ({
  href,
  children,
  ...props
}: PropsWithChildren<LinkProps>) => {
  return (
    <Link
      href={href}
      className={cn(toggleVariants(), "h-12 w-12 rounded-full p-0")}
      {...props}
    >
      {children}
    </Link>
  );
};
