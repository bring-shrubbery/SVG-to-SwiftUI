<script lang="ts">
  import {
    ClipboardOutline,
    SwapHorizontalOutline,
    CogOutline,
  } from "svelte-ionicons";

  import {
    Popover,
    PopoverButton,
    PopoverPanel,
  } from "@rgossiaux/svelte-headlessui";

  import type { SwiftUIGeneratorConfig } from "svg-to-swiftui-core";

  export let onClickConvert;
  export let settingsState: SwiftUIGeneratorConfig;
  export let onCopy;
</script>

<div
  class="w-full mb-1 flex justify-between py-2 px-4 bg-white dark:bg-zinc-800"
>
  <div>
    <span>
      <!-- TODO: Example list. Use Listbox from @rgossiaux/svelte-headlessui -->
    </span>
  </div>
  <div class="flex">
    <button
      class="flex gap-2 justify-center items-center mr-4 px-4 py-1 bg-green-500 hover:bg-green-400 rounded-md text-white shadow"
      on:click={onClickConvert}
    >
      <SwapHorizontalOutline size="20" />
      <span class="mr-1">Convert</span>
    </button>

    <button
      class="flex gap-2 justify-center items-center mr-4 px-3 py-1 rounded-md text-[#F05137] hover:text-[rgb(255,109,87)] border-2 border-[#F05137] hover:border-[rgb(255,109,87)] shadow"
      on:click={onCopy}
    >
      <ClipboardOutline size="20" />
      <span class="mr-1">Copy result</span>
    </button>

    <Popover class="relative">
      <PopoverButton
        class="cursor-pointer w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 rounded-full text-black dark:text-white"
      >
        <CogOutline size="32" />
      </PopoverButton>
      <PopoverPanel
        class="absolute z-10 right-0 bg-white dark:bg-zinc-700 shadow-lg rounded-md border-zinc-200 dark:border-zinc-500 border text-black dark:text-zinc-100"
      >
        <div class="w-full py-1 border-b border-zinc-200 dark:border-zinc-500">
          <div class="flex gap-2 w-fit mx-auto justify-center items-center">
            <CogOutline size="20" />
            <span>Settings</span>
          </div>
        </div>

        <div class="px-4 py-2">
          <div class="flex items-center">
            <span class="w-40">Struct Name</span>
            <input
              bind:value={settingsState.structName}
              class="border dark:border-zinc-500 py-1 px-2 rounded dark:bg-zinc-700"
            />
          </div>

          <div class="flex items-center mt-2">
            <span class="w-40">Precision</span>
            <input
              bind:value={settingsState.precision}
              type="number"
              class="border dark:border-zinc-500 py-1 px-2 rounded dark:bg-zinc-700"
            />
          </div>

          <div class="flex items-center mt-2">
            <span class="w-40">Indentation</span>
            <input
              bind:value={settingsState.indentationSize}
              type="number"
              class="border dark:border-zinc-500 py-1 px-2 rounded dark:bg-zinc-700"
            />
          </div>
        </div>
      </PopoverPanel>
    </Popover>
  </div>
</div>
