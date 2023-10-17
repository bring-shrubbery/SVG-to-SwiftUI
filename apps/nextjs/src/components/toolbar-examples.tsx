"use client";

import { AlertCircleIcon, GripIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";

const ToolbarExampleItem = ({
  exampleName,
  exampleContent,
  onClick,
}: {
  exampleName: string;
  exampleContent: string;
  onClick: (exampleId: string) => void;
}) => {
  return (
    <div
      className="w-8 h-8 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-md cursor-pointer"
      onClick={() => onClick(exampleName)}
    >
      <div
        dangerouslySetInnerHTML={{ __html: exampleContent }}
        className="w-6 h-6"
      />
    </div>
  );
};

export const ToolbarExamples = (props: {
  exampleList: { example: string; content: string }[];
  onExampleSelect: (exampleId: string) => void;
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <GripIcon size={18} />
          <span className="ml-2 hidden sm:inline">Examples</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 mx-4">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Examples</CardTitle>
          <CardDescription>
            Pick one of the example icons to see this tool in action.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 w-full h-48">
          <ScrollArea className="h-44">
            <div className="w-full grid gap-2 grid-cols-8">
              {props.exampleList.map(({ example, content }, i) => (
                <ToolbarExampleItem
                  key={i}
                  exampleName={example}
                  exampleContent={content}
                  onClick={props.onExampleSelect}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-0 text-sm text-red-600">
          <AlertCircleIcon className="w-6 h-6 mr-2 p-0" />
          <span>
            Icons in this list are coming from{" "}
            <Link
              href="https://lucide.dev"
              className="underline hover:text-red-500"
            >
              Lucide
            </Link>
            .
            <br />
            <Link
              href="https://lucide.dev/license"
              className="underline hover:text-red-500"
            >
              Read the license here.
            </Link>
          </span>
        </CardFooter>
      </PopoverContent>
    </Popover>
  );
};
