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
import { useToast } from "@/components/ui/use-toast";
import { Settings } from "@/lib/store";
import urlJoin from "url-join";
import xmlFormat from "xml-formatter";
import { analyticsAtom } from "@/components/analytics";

import { Adsense } from "@ctrl/react-adsense";

export const App = ({
  exampleList,
  ads,
}: {
  ads?: boolean;
  exampleList: { example: string; content: string }[];
}) => {
  const svgRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Hooks

  const { toast } = useToast();
  const { theme } = useTheme();
  const monaco = useMonaco();

  const [announcementBarHidden] = useAtom(announcementBarAtom);
  const height = announcementBarHidden
    ? "min-h-[calc(100vh-236px)]"
    : "min-h-[calc(100vh-300px)]";

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
      const result = convert(svgCode, {
        structName,
        precision,
        indentationSize: indentation,
      });

      setResult(result);
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
  }, [theme]);

  useEffect(() => {
    if ("adsbygoogle" in window) {
      // @ts-ignore
      window.adsbygoogle.push({});
    } else {
      // @ts-ignore
      window.adsbygoogle = window.adsbygoogle || [];
    }
  }, []);

  useEffect(() => {
    const pushAd = () => {
      try {
        // @ts-ignore
        const adsbygoogle = window.adsbygoogle;
        console.log({ adsbygoogle });
        adsbygoogle.push({});
      } catch (e) {
        console.error(e);
      }
    };

    let interval = setInterval(() => {
      // Check if Adsense script is loaded every 300ms
      // @ts-ignore
      if (window.adsbygoogle) {
        pushAd();
        // clear the interval once the ad is pushed so that function isn't called indefinitely
        clearInterval(interval);
      }
    }, 300);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Toolbar
        exampleList={exampleList}
        onConvert={handleConvert}
        onCopyResult={handleCopyResult}
        onExampleSelect={handleExampleSelect}
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

      {ads && (
        // <Adsense
        //   client="ca-pub-3063505422248547"
        //   slot="7774359292"
        //   style={{ display: "block", height: 100 }}
        //   format="auto"
        //   responsive="true"
        // />
        <ins
          className="adsbygoogle"
          style={{ display: "block", height: 100 }}
          data-ad-client="ca-pub-3063505422248547"
          data-ad-slot="7774359292"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </>
  );
};
