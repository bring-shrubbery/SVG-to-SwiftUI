"use client";

import { announcementBarAtom } from "@/components/announcement-bar";
import { Toolbar } from "@/components/toolbar";
import { cn } from "@/lib/utils";
import { Allotment } from "allotment";
import { useAtom } from "jotai";

import Editor from "@monaco-editor/react";

export const App = () => {
  const [announcementBarHidden] = useAtom(announcementBarAtom);
  const height = announcementBarHidden
    ? "min-h-[calc(100vh-136px)]"
    : "min-h-[calc(100vh-200px)]";

  return (
    <>
      <Toolbar
        onConvert={console.log}
        onCopyResult={console.log}
        onExampleSelect={console.log}
      />

      <Allotment className={height}>
        <Allotment.Pane className={height}>
          <Editor height="100%" className="py-2" />
        </Allotment.Pane>
        <Allotment.Pane className={height}>
          <Editor
            height="100%"
            className="py-2"
            options={{ readOnly: true }}
            value={"hello"}
          />
        </Allotment.Pane>
      </Allotment>
    </>
  );
};
