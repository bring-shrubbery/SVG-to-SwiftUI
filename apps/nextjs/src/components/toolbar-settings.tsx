"use client";

import { SettingsIcon } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { CardDescription, CardHeader, CardTitle } from "./card";
import { Label } from "./label";
import { Input } from "./input";
import { Slider } from "./slider";
import { useAtom } from "jotai";
import { Settings } from "@/lib/store";

export const ToolbarSettings = () => {
  const [structName, setStructName] = useAtom(Settings.structName);
  const [precision, setPrecision] = useAtom(Settings.precision);
  const [indentation, setIndentation] = useAtom(Settings.indentation);

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
            <Input
              id="struct-name"
              placeholder="MyIcon"
              value={structName}
              onChange={(e) => setStructName(e.target.value)}
            />

            <Label htmlFor="float-precision" className="whitespace-nowrap">
              Float Precision ({"5"})
            </Label>
            <Slider
              min={1}
              max={15}
              defaultValue={[precision]}
              className="my-2"
              value={[precision]}
              onValueCommit={([v]) => v && setPrecision(v)}
            />

            <Label htmlFor="indentation" className="whitespace-nowrap">
              Indentation
            </Label>
            <Input
              type="number"
              id="indentation"
              placeholder="4"
              value={indentation}
              onChange={(e) => setIndentation(e.target.valueAsNumber)}
            />
          </div>
        </CardHeader>
      </PopoverContent>
    </Popover>
  );
};
