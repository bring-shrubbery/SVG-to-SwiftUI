"use client";

import type { editor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { announcementBarAtom } from "@/components/announcement-bar";
import { Toolbar } from "@/components/toolbar";
import { useToast } from "@/components/ui/use-toast";
import {
  SettingsIndentation,
  SettingsPrecision,
  SettingsStructName,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import Editor, { useMonaco } from "@monaco-editor/react";
import { Allotment } from "allotment";
import { useAtom } from "jotai";
import LIGHT_THEME from "monaco-themes/themes/IDLE.json";
import DARK_THEME from "monaco-themes/themes/idleFingers.json";
import { useTheme } from "next-themes";
import { convert } from "svg-to-swiftui-core";
import urlJoin from "url-join";
import xmlFormat from "xml-formatter";

export const App = ({
  exampleList,
}: {
  exampleList: { example: string; content: string }[];
}) => {
  const svgRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [svgValue, setSvgValue] = useState<string | undefined>("");

  // Hooks

  const { toast } = useToast();
  const { theme } = useTheme();
  const monaco = useMonaco();

  const [announcementBarHidden] = useAtom(announcementBarAtom);
  const height = announcementBarHidden
    ? "min-h-[calc(100vh-136px)]"
    : "min-h-[calc(100vh-200px)]";

  const [result, setResult] = useState("");

  // Settings

  const [structName] = useAtom(SettingsStructName);
  const [precision] = useAtom(SettingsPrecision);
  const [indentation] = useAtom(SettingsIndentation);

  // Handlers

  const handleConvert = () => {
    const svgCode = svgRef.current?.getValue();

    if (!svgCode) return;

    try {
      const res = convert(svgCode, {
        structName,
        precision,
        indentationSize: indentation,
      });

      setResult(res);
    } catch (e) {
      toast({
        title: "Conversion error",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const handleCopyResult = () => {
    navigator.clipboard
      .writeText(result)
      .then(() => {
        toast({
          title: "Success!",
          description: "Code was successfully copied into clipboard.",
        });
      })
      .catch(() => {
        toast({
          title: "Copy failed!",
          description: "Could not copy result into clipboard.",
          variant: "destructive",
        });
      });
  };

  const handleExampleSelect = (iconName: string) => {
    fetch(urlJoin("/lucide", iconName))
      .then((res) => res.text())
      .then((text) => {
        const formattedSVG = xmlFormat(text);
        svgRef.current?.setValue(formattedSVG);
        svgRef.current?.focus();
      })
      .catch(console.error);
  };

  // Effects

  useEffect(() => {
    if (theme) monaco?.editor.setTheme(theme);
  }, [monaco?.editor, theme]);

  return (
    <>
      <Toolbar
        exampleList={exampleList}
        onConvert={handleConvert}
        onCopyResult={handleCopyResult}
        onExampleSelect={handleExampleSelect}
      />

      <Allotment className={cn(height)}>
        <Allotment.Pane className={cn(height, "relative")}>
          <Editor
            height="100%"
            className="py-2"
            language="xml"
            theme="dark"
            onMount={(e, m) => {
              svgRef.current = e;
              // @ts-expect-error No types
              m.editor.defineTheme("light", {
                ...LIGHT_THEME,
                colors: { ...LIGHT_THEME.colors },
              });
              // @ts-expect-error No types
              m.editor.defineTheme("dark", {
                ...DARK_THEME,
                colors: {
                  ...DARK_THEME.colors,
                  "editor.background": "#0C0A09",
                },
              });

              m.editor.setTheme(theme === "light" ? "light" : "dark");
            }}
            options={{ minimap: { enabled: false }, automaticLayout: true }}
            onChange={(val) => setSvgValue(val)}
          />
          {!svgValue && (
            <div className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 font-light italic text-muted-foreground">
              Paste your SVG here
            </div>
          )}
        </Allotment.Pane>
        <Allotment.Pane className={cn(height, "relative")}>
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
          />
          {!result && (
            <div className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 font-light italic text-muted-foreground">
              SwiftUI code will appear here
            </div>
          )}
        </Allotment.Pane>
      </Allotment>
    </>
  );
};
