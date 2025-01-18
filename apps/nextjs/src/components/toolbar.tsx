"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftRightIcon } from "lucide-react";
import useLocalStorage from "use-local-storage";

import { ToolbarSettings } from "./toolbar-settings";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { VideoTutorialPopover } from "./video-tutorial-popover";

export interface ToolbarProps {
  onConvert: () => void;
}

export const Toolbar = ({ onConvert }: ToolbarProps) => {
  const [analyticsAccepted] = useLocalStorage("analytics_accepted", false);
  const [didConvertOnce, setDidConvertOnce] = useLocalStorage(
    "didConvertOnce",
    false,
  );

  return (
    <div className="flex w-full justify-between border-b border-border p-2 md:px-4">
      <div>
        <VideoTutorialPopover />
      </div>

      {/* <ToolbarExamples {...{ onExampleSelect, exampleList }} /> */}

      <div className="flex gap-2">
        <TooltipProvider>
          <Tooltip defaultOpen={!didConvertOnce || !analyticsAccepted}>
            <Button
              asChild
              onClick={() => {
                if (!analyticsAccepted) return;

                onConvert();
                setDidConvertOnce(true);
              }}
              disabled={!analyticsAccepted}
            >
              <TooltipTrigger>
                <ArrowLeftRightIcon className="mr-2 h-4 w-4" />
                Convert & Copy
              </TooltipTrigger>
            </Button>

            <TooltipContent side="left">
              {!analyticsAccepted
                ? "Click accept on analytics popup before converting."
                : 'Paste SVG below and click "Convert" to get SwiftUI code.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ToolbarSettings />
      </div>
    </div>
  );
};
