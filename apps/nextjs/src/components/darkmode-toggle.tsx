"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "./button";
import { useTheme } from "next-themes";

export const DarkmodeToggle = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <Button
      className="p-0 w-12 h-12 rounded-full"
      variant="ghost"
      onClick={toggleTheme}
    >
      <MoonIcon className="hidden dark:block" />
      <SunIcon className="dark:hidden" />
    </Button>
  );
};
