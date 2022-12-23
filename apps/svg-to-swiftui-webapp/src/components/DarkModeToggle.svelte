<script lang="ts">
  import { SunnyOutline, MoonOutline } from "svelte-ionicons";
  import { onMount } from "svelte";

  const isDark = () => localStorage.theme === "dark";
  let localDark = isDark();

  const systemDark =
    !("theme" in localStorage) &&
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const handleThemeChange = () => {
    // On page load or when changing themes, best to add inline in `head` to avoid FOUC
    if (isDark() || systemDark) {
      if (typeof document !== "undefined") {
        document.documentElement.classList.add("dark");
      }
    } else {
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const toggleTheme = () => {
    localDark = isDark() ? false : true;
    localStorage.theme = isDark() ? "light" : "dark";
    handleThemeChange();
  };

  onMount(() => {
    handleThemeChange();
  });
</script>

{#if localDark}
  <div
    class="cursor-pointer mx-4 w-10 h-10 flex items-center justify-center hover:bg-zinc-700 rounded-full"
    on:click={toggleTheme}
    on:keyup={toggleTheme}
    aria-label="switch color mode"
  >
    <MoonOutline size="30" />
  </div>
{:else}
  <div
    class="cursor-pointer mx-4 w-10 h-10 flex items-center justify-center hover:bg-zinc-100 rounded-full"
    aria-label="switch color mode"
    on:click={toggleTheme}
    on:keyup={toggleTheme}
  >
    <SunnyOutline size="32" />
  </div>
{/if}
