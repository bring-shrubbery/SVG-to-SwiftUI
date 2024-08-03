"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircleIcon, GripIcon } from "lucide-react";

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
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-600"
      onClick={() => onClick(exampleName)}
    >
      <div
        dangerouslySetInnerHTML={{ __html: exampleContent }}
        className="h-6 w-6"
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
      <PopoverContent className="mx-4 w-96">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Examples</CardTitle>
          <CardDescription>
            Pick one of the example icons to see this tool in action.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-48 w-full px-0">
          <ScrollArea className="h-44">
            <div className="grid w-full grid-cols-8 gap-2">
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
          <AlertCircleIcon className="mr-2 h-6 w-6 p-0" />
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
