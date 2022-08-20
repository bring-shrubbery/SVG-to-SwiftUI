<script lang="ts">
  import { convert } from "svg-to-swiftui-core";
  import hljs from "highlight.js";
  import swift from "highlight.js/es/languages/swift";
  import SettingsIcon from "./SettingsIcon.svelte";

  hljs.registerLanguage("string", swift);

  let svgInput = "";
  let swiftOutput = "";
  let swiftHTML = "";
  let lines = [];

  let settingsShown = false;
  const toggleSettings = () => (settingsShown = !settingsShown);
  let options = {
    structName: "MyCustomShape",
    precision: 5,
    indentationSize: 4,
  };

  const generateSwiftCode = () => {
    try {
      swiftOutput = convert(svgInput, options).trim();

      lines = new Array(swiftOutput.split("\n").length)
        .fill(0)
        .map((_, i) => i + 1);

      swiftHTML = hljs.highlight(swiftOutput, { language: "swift" }).value;
    } catch (e) {
      alert(e);
    }
  };
</script>

<!-- <div class="mx-auto my-4 flex">
  <img
    src="https://img.icons8.com/ios-filled/50/000000/settings.png"
    alt="click here for settings"
    width="16px"
    height="16px"
    on:click={toggleSettings}
    title={`${settingsShown ? 'Hide' : 'Show'} settings`} />
</div>
{#if settingsShown}
  <ul>
    <li>
      <label for="indentation-input">Indentation Spaces:</label>
      <input
        id="indentation-input"
        type="number"
        min="0"
        max="12"
        bind:value={options.indentationSize} />
    </li>
    <li>
      <label for="precision-input">Round to decimal points:</label>
      <input
        id="precision-input"
        type="number"
        min="0"
        max="10"
        bind:value={options.precision} />
    </li>
    <li>
      <label for="name-input">Struct name:</label>
      <input id="name-input" type="text" bind:value={options.structName} />
    </li>
  </ul>
{/if} -->
<!-- <div>
  <textarea bind:value={svgInput} placeholder="Paste SVG Code here" />
</div>
<button on:click={generateSwiftCode}>Convert to SwiftUI Shape!</button>
<h2>Swift code will be shown below:</h2>
<div>
  <textarea value={swiftOutput} id="swift-output-area" />
</div> -->

<div class="w-full h-full">
  <div class="flex flex-col w-full h-full">
    <div class="w-full flex justify-end p-2">
      <button
        class="mr-4 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-md text-white hover:text-gray-200"
        on:click={generateSwiftCode}>convert</button
      >
      <div
        class="cursor-pointer w-10 h-10 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full"
      >
        <SettingsIcon />
      </div>
    </div>
    <div
      class="w-full h-full bg-red-400 grid grid-cols-1 lg:grid-cols-2 grid-rows-2 lg:grid-rows-none"
    >
      <textarea
        placeholder="Paste SVG code here"
        class="block"
        bind:value={svgInput}
      />
      <!-- <textarea
      placeholder="SwiftUI code will appear here."
      class="block border-l border-zinc-300"
    /> -->
      <div class="flex">
        <div
          class="bg-zinc-900 text-zinc-100 w-9 flex flex-col items-end font-mono px-2 text-md pt-2 overflow-hidden"
        >
          {#each lines as line}
            <span>{line}</span>
          {/each}
        </div>
        <pre
          class="w-full min-h-full h-full bg-white text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 hljs"><code
            >{@html swiftHTML}</code
          ></pre>
      </div>
    </div>
  </div>
</div>
