"use client";

import { StarIcon } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { IoLogoGithub } from "react-icons/io5";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function SupportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-start gap-3">
          <StarIcon className="mt-1 h-6 w-6 flex-shrink-0 fill-yellow-500 text-yellow-500" />
          <DialogHeader className="flex-1 text-left">
            <DialogTitle>Copied! Enjoying SVG to SwiftUI?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              If this saved you time, please consider starring the repo on GitHub and following the author on X.
              <br />
              It&apos;s free and helps a lot!
            </p>
          </DialogHeader>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <a
            href="https://github.com/bring-shrubbery/SVG-to-SwiftUI"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "flex-1 gap-2")}
          >
            <IoLogoGithub className="h-5 w-5" />
            Star on GitHub
          </a>
          <a
            href="https://x.com/bringshrubberyy"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "flex-1 gap-2")}
          >
            <FaXTwitter className="h-5 w-5" />
            Follow on X
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
