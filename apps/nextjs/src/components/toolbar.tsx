"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftRightIcon, ClipboardIcon } from "lucide-react";

import { ToolbarSettings } from "./toolbar-settings";

// import { ToolbarExamples } from "./toolbar-examples";

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
  return (
    <div className="flex w-full justify-between border-b border-border p-2 md:px-4">
      <div />
      {/* <ToolbarExamples {...{ onExampleSelect, exampleList }} /> */}

      <div className="flex gap-2">
        <Button
          onClick={() => {
            onConvert();
          }}
        >
          <ArrowLeftRightIcon className="mr-2 h-4 w-4" />
          Convert
        </Button>
        <Button variant="outline" onClick={onCopyResult}>
          <ClipboardIcon className="mr-2 h-4 w-4" />
          Copy result
        </Button>

        <ToolbarSettings />
      </div>
    </div>
  );
};
