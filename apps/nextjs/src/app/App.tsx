"use client";

import type { editor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { analyticsAtom } from "@/components/analytics";
import { announcementBarAtom } from "@/components/announcement-bar";
import { Toolbar } from "@/components/toolbar";
import { useToast } from "@/components/ui/use-toast";
import { Settings } from "@/lib/store";
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

  const [analytics] = useAtom(analyticsAtom);

  // Settings

  const [structName] = useAtom(Settings.structName);
  const [precision] = useAtom(Settings.precision);
  const [indentation] = useAtom(Settings.indentation);

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

        analytics.track("convert_click", {
          status: "success",
        });
      })
      .catch(() => {
        toast({
          title: "Copy failed!",
          description: "Could not copy result into clipboard.",
          variant: "destructive",
        });

        analytics.track("convert_click", {
          status: "failure",
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
      });
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
            onMount={(e, m) => {
              // swiftRef.current = e;
            }}
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
