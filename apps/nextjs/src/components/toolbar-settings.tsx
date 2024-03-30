"use client";

import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Settings } from "@/lib/store";
import { useAtom } from "jotai";
import { SettingsIcon } from "lucide-react";

export const ToolbarSettings = () => {
  const [structName, setStructName] = useAtom(Settings.structName);
  const [precision, setPrecision] = useAtom(Settings.precision);
  const [indentation, setIndentation] = useAtom(Settings.indentation);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="h-10 w-10 rounded-full p-0" variant="ghost">
          <SettingsIcon />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="mx-4 w-fit">
        <CardHeader className="w-fit p-0">
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            {'Modify settings, then click "Convert" again.'}
          </CardDescription>
          <div className="grid w-auto grid-cols-[auto,200px] items-center gap-x-4 gap-y-6 pt-4">
            <Label htmlFor="struct-name" className="whitespace-nowrap">
              {"Struct Name"}
            </Label>
            <Input
              id="struct-name"
              placeholder="MyIcon"
              value={structName}
              onChange={(e) => setStructName(e.target.value)}
            />

            <Label
              htmlFor="float-precision"
              className="min-w-[130px] whitespace-nowrap"
            >
              {`Float Precision (${precision})`}
            </Label>
            <Slider
              min={1}
              max={12}
              defaultValue={[precision]}
              className="my-2"
              value={[precision]}
              onValueChange={([v]) => v && setPrecision(v)}
            />

            <Label htmlFor="indentation" className="whitespace-nowrap">
              {"Indentation"}
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
