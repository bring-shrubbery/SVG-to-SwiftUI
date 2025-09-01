"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftRightIcon } from "lucide-react";

import { ToolbarSettings } from "./toolbar-settings";
import { VideoTutorialPopover } from "./video-tutorial-popover";

export const Toolbar = ({ onConvert }: { onConvert: () => void }) => {
  return (
    <div className="flex w-full items-center justify-between border-b border-border p-2 md:px-4">
      <div>
        <VideoTutorialPopover />
      </div>

      {/* <ToolbarExamples {...{ onExampleSelect, exampleList }} /> */}

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
