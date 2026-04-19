"use client";

import { FaXTwitter } from "react-icons/fa6";
import { IoLogoGithub } from "react-icons/io5";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function SupportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enjoying SVG to SwiftUI?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            If this saved you time, please consider starring the repo on GitHub and following the author on X. It&apos;s
            free and helps a lot!
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2 sm:flex-row">
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

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
