"use client";
import { ArrowLeftRightIcon, ClipboardIcon } from "lucide-react";
import { Button } from "./button";

import { ToolbarSettings } from "./toolbar-settings";
import { ToolbarExamples } from "./toolbar-examples";

export interface ToolbarProps {
  exampleList: { example: string; content: string }[];
  onConvert: () => void;
  onCopyResult: () => void;
  onExampleSelect: (exampleId: string) => void;
}

export const Toolbar = ({
  exampleList,
  onConvert,
  onCopyResult,
  onExampleSelect,
}: ToolbarProps) => {
  return (
    <div className="w-full flex justify-between py-2 px-2 md:px-4 bg-white dark:bg-zinc-800">
      <div />
      {/* <ToolbarExamples {...{ onExampleSelect, exampleList }} /> */}

      <div className="flex gap-2">
        <Button onClick={onConvert}>
          <ArrowLeftRightIcon className="w-4 h-4 mr-2" />
          Convert
        </Button>
        <Button variant="outline" onClick={onCopyResult}>
          <ClipboardIcon className="w-4 h-4 mr-2" />
          Copy result
        </Button>

        <ToolbarSettings />
      </div>
    </div>
  );
};
