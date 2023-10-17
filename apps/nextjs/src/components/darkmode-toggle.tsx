"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export const DarkModeToggle = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <Button
      className="p-0 w-10 h-10 rounded-full"
      variant="ghost"
      onClick={toggleTheme}
    >
      <MoonIcon className="hidden dark:block" />
      <SunIcon className="dark:hidden" />
    </Button>
  );
};
