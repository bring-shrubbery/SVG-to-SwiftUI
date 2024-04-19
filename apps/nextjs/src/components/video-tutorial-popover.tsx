import { IoLogoYoutube } from "react-icons/io5";

import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export const VideoTutorialPopover = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex gap-2">
          <IoLogoYoutube size={20} />
          {"Video Tutorial"}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="mx-4 w-[592px] p-4" alignOffset={0}>
        <div className="min-h-[315px] min-w-[560px]">
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/jjfYmX4pmZU?si=vwVUXiB-_HdzqkWE"
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
