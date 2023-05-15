import {
  AlertCircleIcon,
  ArrowLeftRightIcon,
  ClipboardCopyIcon,
  ClipboardIcon,
  GripIcon,
  SettingsIcon,
} from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Label } from "./label";
import { Input } from "./input";
import { Slider } from "./slider";
import Link from "next/link";

export interface ToolbarProps {
  onConvert: () => void;
  onCopyResult: () => void;
  onExampleSelect: (exampleId: string) => void;
}

export const Toolbar = (props: ToolbarProps) => {
  return (
    <div className="w-full flex justify-between py-2 px-2 md:px-4 bg-white dark:bg-zinc-800">
      <div>
        <ToolbarExamples onExampleSelect={props.onExampleSelect} />
      </div>

      <div className="flex gap-2">
        <Button onClick={props.onConvert}>
          <ArrowLeftRightIcon className="w-4 h-4 mr-2" />
          Convert
        </Button>
        <Button variant="outline" onClick={props.onCopyResult}>
          <ClipboardIcon className="w-4 h-4 mr-2" />
          Copy result
        </Button>

        <ToolbarSettings />
      </div>
    </div>
  );
};

const ToolbarExamples = (props: {
  onExampleSelect: (exampleId: string) => void;
}) => {
  // const createExampleClickHandler = (id: string) => {
  //   return () => props.onExampleSelect(id);
  // };

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
        <CardContent className="px-0 w-full">
          <div className="w-full grid gap-2 grid-cols-8">
            {new Array(100).fill(0).map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 flex items-center justify-center hover:bg-zinc-200 rounded-md cursor-pointer"
              >
                <GripIcon size={24} />
              </div>
            ))}
          </div>
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

const ToolbarSettings = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="rounded-full p-0 w-10 h-10" variant="ghost">
          <SettingsIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="mx-4 w-fit">
        <CardHeader className="p-0 w-fit">
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Modify settings, then click "Convert" again.
          </CardDescription>

          <div className="w-auto pt-4 grid grid-cols-[auto,200px] gap-x-4 gap-y-6 items-center">
            <Label htmlFor="struct-name" className="whitespace-nowrap">
              Struct Name
            </Label>
            <Input id="struct-name" placeholder="MyStructName" />

            <Label htmlFor="float-precision" className="whitespace-nowrap">
              Float Precision ({"5"})
            </Label>
            <Slider min={1} max={15} defaultValue={[5]} className="my-2" />

            <Label htmlFor="indentation" className="whitespace-nowrap">
              Indentation
            </Label>
            <Input type="number" id="indentation" placeholder="4" />
          </div>
        </CardHeader>
      </PopoverContent>
    </Popover>
  );
};
