"use client";

import { announcementBarAtom } from "@/components/announcement-bar";
import { Toolbar } from "@/components/toolbar";
import { Allotment } from "allotment";
import { useAtom } from "jotai";
import { convert } from "svg-to-swiftui-core";

import Editor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

import LIGHT_THEME from "monaco-themes/themes/IDLE.json";
import DARK_THEME from "monaco-themes/themes/idleFingers.json";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useToast } from "@/components/use-toast";

export const App = () => {
  const svgRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { toast } = useToast();

  const { theme } = useTheme();
  const monaco = useMonaco();

  const [announcementBarHidden] = useAtom(announcementBarAtom);
  const height = announcementBarHidden
    ? "min-h-[calc(100vh-136px)]"
    : "min-h-[calc(100vh-200px)]";

  const [result, setResult] = useState("");

  const handleConvert = () => {
    const svgCode = svgRef.current?.getValue();

    if (!svgCode) return;

    try {
      const result = convert(svgCode);

      setResult(result);
    } catch (e) {
      toast({
        title: "Conversion error",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (theme) monaco?.editor.setTheme(theme);
  }, [theme]);

  return (
    <>
      <Toolbar
        onConvert={handleConvert}
        onCopyResult={console.log}
        onExampleSelect={console.log}
      />

      <Allotment className={height}>
        <Allotment.Pane className={height}>
          <Editor
            height="100%"
            className="py-2"
            language="xml"
            theme="dark"
            onMount={(e, m) => {
              svgRef.current = e;
              // @ts-ignore
              m.editor.defineTheme("light", {
                ...LIGHT_THEME,
                colors: { ...LIGHT_THEME.colors },
              });
              // @ts-ignore
              m.editor.defineTheme("dark", {
                ...DARK_THEME,
                colors: {
                  ...DARK_THEME.colors,
                  "editor.background": "#27272A",
                },
              });

              m.editor.setTheme(theme === "dark" ? "dark" : "light");
            }}
            options={{ minimap: { enabled: false }, automaticLayout: true }}
          />
        </Allotment.Pane>
        <Allotment.Pane className={height}>
          <Editor
            height="100%"
            className="py-2"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              automaticLayout: true,
            }}
            value={result}
            language="swift"
            onMount={(e, m) => {
              // swiftRef.current = e;
            }}
          />
        </Allotment.Pane>
      </Allotment>
    </>
  );
};
