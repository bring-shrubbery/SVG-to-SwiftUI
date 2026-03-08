"use client";

import { ArrowLeftRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

import { ExamplesDialog } from "./examples-dialog";
import { ToolbarSettings } from "./toolbar-settings";
import { VideoTutorialPopover } from "./video-tutorial-popover";

export const Toolbar = ({
  onConvert,
  onExampleSelect,
}: {
  onConvert: () => void;
  onExampleSelect: (svgCode: string) => void;
}) => {
  return (
    <div className="flex w-full items-center justify-between border-b border-border p-2 md:px-4">
      <div className="flex items-center gap-2">
        <VideoTutorialPopover />
        <ExamplesDialog onSelect={onExampleSelect} />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={onConvert}>
          <ArrowLeftRightIcon className="mr-2 h-4 w-4" />
          Convert & Copy
        </Button>

        <ToolbarSettings />
      </div>
    </div>
  );
};
