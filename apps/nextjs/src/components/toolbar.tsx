"use client";

import { Button } from "@/components/ui/button";
import { TooltipArrow } from "@radix-ui/react-tooltip";
import { ArrowLeftRightIcon, ClipboardIcon } from "lucide-react";
// import { ToolbarExamples } from "./toolbar-examples";
import useLocalStorage from "use-local-storage";

import { ToolbarSettings } from "./toolbar-settings";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export interface ToolbarProps {
  exampleList: { example: string; content: string }[];
  onConvert: () => void;
  onCopyResult: () => void;
  onExampleSelect: (exampleId: string) => void;
}

export const Toolbar = ({
  // exampleList,
  // onExampleSelect,
  onConvert,
  onCopyResult,
}: ToolbarProps) => {
  const [didConvertOnce, setDidConvertOnce] = useLocalStorage(
    "didConvertOnce",
    "",
  );

  return (
    <div className="flex w-full justify-between border-b border-border p-2 md:px-4">
      <div />
      {/* <ToolbarExamples {...{ onExampleSelect, exampleList }} /> */}

      <div className="flex gap-2">
        <TooltipProvider>
          <Tooltip open={!didConvertOnce}>
            <TooltipTrigger>
              <Button
                onClick={() => {
                  onConvert();
                  setDidConvertOnce("true");
                }}
              >
                <ArrowLeftRightIcon className="mr-2 h-4 w-4" />
                Convert
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {'Paste SVG below and click "Convert" to get SwiftUI code.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button variant="outline" onClick={onCopyResult}>
          <ClipboardIcon className="mr-2 h-4 w-4" />
          Copy result
        </Button>

        <ToolbarSettings />
      </div>
    </div>
  );
};
