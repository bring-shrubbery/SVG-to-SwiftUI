<script lang="ts">
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

  // // Whenever the user explicitly chooses light mode
  // localStorage.theme = 'light'

  // // Whenever the user explicitly chooses dark mode
  // localStorage.theme = 'dark'

  // // Whenever the user explicitly chooses to respect the OS preference
  // localStorage.removeItem('theme')

  const toggleTheme = () => {
    localDark = isDark() ? false : true;
    localStorage.theme = isDark() ? "light" : "dark";
    handleThemeChange();
  };

  onMount(() => {
    handleThemeChange();
  });
</script>

<!-- TODO: Solid.js will probably make it possible to not have this bad double storage of the theme state, while keeping the reactiveness -->

{#if localDark}
  <div
    class="cursor-pointer mx-4 w-10 h-10 flex items-center justify-center hover:bg-zinc-700 rounded-full"
  >
    <svg
      enable-background="new 0 0 512 512"
      version="1.1"
      viewBox="0 0 512 512"
      width="32"
      height="32"
      xml:space="preserve"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      on:click={toggleTheme}
    >
      <g>
        <path
          d="M256,144c-61.75,0-112,50.25-112,112s50.25,112,112,112s112-50.25,112-112S317.75,144,256,144z M256,336    c-44.188,0-80-35.812-80-80c0-44.188,35.812-80,80-80c44.188,0,80,35.812,80,80C336,300.188,300.188,336,256,336z M256,112    c8.833,0,16-7.167,16-16V64c0-8.833-7.167-16-16-16s-16,7.167-16,16v32C240,104.833,247.167,112,256,112z M256,400    c-8.833,0-16,7.167-16,16v32c0,8.833,7.167,16,16,16s16-7.167,16-16v-32C272,407.167,264.833,400,256,400z M380.438,154.167    l22.625-22.625c6.25-6.25,6.25-16.375,0-22.625s-16.375-6.25-22.625,0l-22.625,22.625c-6.25,6.25-6.25,16.375,0,22.625    S374.188,160.417,380.438,154.167z M131.562,357.834l-22.625,22.625c-6.25,6.249-6.25,16.374,0,22.624s16.375,6.25,22.625,0    l22.625-22.624c6.25-6.271,6.25-16.376,0-22.625C147.938,351.583,137.812,351.562,131.562,357.834z M112,256    c0-8.833-7.167-16-16-16H64c-8.833,0-16,7.167-16,16s7.167,16,16,16h32C104.833,272,112,264.833,112,256z M448,240h-32    c-8.833,0-16,7.167-16,16s7.167,16,16,16h32c8.833,0,16-7.167,16-16S456.833,240,448,240z M131.541,154.167    c6.251,6.25,16.376,6.25,22.625,0c6.251-6.25,6.251-16.375,0-22.625l-22.625-22.625c-6.25-6.25-16.374-6.25-22.625,0    c-6.25,6.25-6.25,16.375,0,22.625L131.541,154.167z M380.459,357.812c-6.271-6.25-16.376-6.25-22.625,0    c-6.251,6.25-6.271,16.375,0,22.625l22.625,22.625c6.249,6.25,16.374,6.25,22.624,0s6.25-16.375,0-22.625L380.459,357.812z"
          fill="white"
        />
      </g>
    </svg>
  </div>
{:else}
  <div
    class="cursor-pointer mx-4 w-10 h-10 flex items-center justify-center hover:bg-zinc-100 rounded-full"
  >
    <svg
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      xmlns="http://www.w3.org/2000/svg"
      on:click={toggleTheme}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </div>
{/if}
