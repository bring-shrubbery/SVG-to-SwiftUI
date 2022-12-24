<script lang="ts">
  import {
    Listbox,
    ListboxButton,
    ListboxOption,
    ListboxOptions,
  } from "@rgossiaux/svelte-headlessui";

  import { List, PlayOutline, Play, CodeSlashOutline } from "svelte-ionicons";
  import { examples } from "../utils/examples";
  import type { Example } from "../utils/types";

  export let selectedExample: Example | undefined;
</script>

<Listbox
  class="relative text-zinc-900 dark:text-zinc-50"
  bind:value={selectedExample}
  on:change={(e) => {
    selectedExample = e.detail;
  }}
>
  <ListboxButton
    class="flex gap-2 justify-center items-center px-2 py-1 shadow border-2 border-zinc-600 rounded-md"
  >
    {#if selectedExample}
      <CodeSlashOutline size="20" />
    {:else}
      <List size="20" />
    {/if}
    <span>{selectedExample?.label || "Examples"}</span>
  </ListboxButton>

  <ListboxOptions
    class="absolute z-10 bg-white dark:bg-zinc-800 shadow-lg rounded-md border overflow-hidden"
  >
    {#each examples as example (example.id)}
      <ListboxOption
        value={example}
        class="flex gap-1 items-center w-52 first:border-t-0 border-t px-2 py-2 hover:bg-orange-50 dark:hover:bg-zinc-700 cursor-pointer group"
      >
        {#if selectedExample?.id === example.id}
          <Play size="20" />
        {:else}
          <PlayOutline size="20" class="hidden group-hover:block" />
        {/if}
        <span
          class={selectedExample?.id === example.id
            ? ""
            : "ml-6 group-hover:ml-0"}>{example.label}</span
        >
      </ListboxOption>
    {/each}
  </ListboxOptions>
</Listbox>
