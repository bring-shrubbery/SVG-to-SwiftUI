"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export const DarkModeToggle = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <Button className="h-10 w-10 rounded-full p-0" variant="ghost" onClick={toggleTheme}>
      <MoonIcon className="hidden dark:block" />
      <SunIcon className="dark:hidden" />
    </Button>
  );
};
