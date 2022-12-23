<script lang="ts">
  import { convert } from "svg-to-swiftui-core";
  import type { SwiftUIGeneratorConfig } from "svg-to-swiftui-core";

  import type monaco from "monaco-editor";
  import { onMount } from "svelte";

  import { Pane, Splitpanes } from "svelte-splitpanes";
  import Toolbar from "./Toolbar.svelte";

  let options: SwiftUIGeneratorConfig = {
    structName: "MyCustomShape",
    precision: 5,
    indentationSize: 4,
  };

  let svgDivEl: HTMLDivElement = null;
  let swiftDivEl: HTMLDivElement = null;
  let svgEditor: monaco.editor.IStandaloneCodeEditor;
  let swiftEditor: monaco.editor.IStandaloneCodeEditor;
  let Monaco: typeof monaco;

  function onClassChange(element, callback) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          callback(mutation.target);
        }
      });
    });
    observer.observe(element, { attributes: true });
    return observer.disconnect;
  }

  onMount(async () => {
    const lightTheme = await import("monaco-themes/themes/IDLE.json");
    const darkTheme = await import("monaco-themes/themes/idleFingers.json");

    self.MonacoEnvironment = {
      getWorker: function (workerId: string, label: string) {
        const getWorkerModule = (moduleUrl: string, label: string): Worker => {
          // @ts-ignore
          return new Worker(self.MonacoEnvironment.getWorkerUrl(moduleUrl), {
            name: label,
            type: "module",
          });
        };

        switch (label) {
          case "html":
          case "svg":
            return getWorkerModule(
              "/monaco-editor/esm/vs/language/html/html.worker?worker",
              label
            );
          default:
            return getWorkerModule(
              "/monaco-editor/esm/vs/editor/editor.worker?worker",
              label
            );
        }
      },
    };

    Monaco = await import("monaco-editor");

    // @ts-ignore
    Monaco.editor.defineTheme("s2s-dark", darkTheme);
    // @ts-ignore
    Monaco.editor.defineTheme("s2s-light", lightTheme);

    svgEditor = Monaco.editor.create(svgDivEl, {
      value: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="50"/>
</svg>`,
      language: "xml",
      automaticLayout: true,
      minimap: { enabled: false },
      padding: { top: 16 },
    });

    swiftEditor = Monaco.editor.create(swiftDivEl, {
      value: "",
      language: "swift",
      automaticLayout: true,
      readOnly: true,
      minimap: { enabled: false },
      padding: { top: 16 },
    });

    const htmlEl = document.getElementsByTagName("html")[0];

    const updateEditorTheme = () => {
      if (htmlEl.classList.contains("dark")) {
        Monaco.editor.setTheme("s2s-dark");
      } else {
        Monaco.editor.setTheme("s2s-light");
      }
    };

    onClassChange(htmlEl, updateEditorTheme);

    updateEditorTheme();

    return () => {
      svgEditor.dispose();
      swiftEditor.dispose();
    };
  });

  const generateSwiftCode = () => {
    try {
      const swiftOutput = convert(svgEditor.getValue(), options).trim();
      swiftEditor.setValue(swiftOutput);
      swiftEditor.focus();
    } catch (e) {
      alert(e);
    }
  };

  const handleCopyResult = () => {
    const swiftCode = swiftEditor.getValue();
    if (!swiftCode) return;
    navigator.clipboard.writeText(swiftCode);
  };
</script>

<div class="w-full h-full">
  <div class="flex flex-col w-full h-full">
    <Toolbar
      onClickConvert={generateSwiftCode}
      settingsState={options}
      onCopy={handleCopyResult}
    />
    <Splitpanes>
      <Pane minSize={20}>
        <div class="h-full" bind:this={svgDivEl} />
      </Pane>
      <Pane minSize={20}>
        <div class="h-full" bind:this={swiftDivEl} />
      </Pane>
    </Splitpanes>
  </div>
</div>
