"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export const DarkModeToggle = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-[38px] w-[38px]"
      aria-label="Toggle theme"
      onClick={toggleTheme}
    >
      <MoonIcon className="hidden h-5 w-5 dark:block" />
      <SunIcon className="h-5 w-5 dark:hidden" />
    </Button>
  );
};
