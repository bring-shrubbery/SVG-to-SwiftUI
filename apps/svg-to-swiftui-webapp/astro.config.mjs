import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

import svelte from "@astrojs/svelte";

// https://astro.build/config
export default defineConfig({
  site: "https://quassum.github.io/",
  base: "/SVG-to-SwiftUI",
  integrations: [tailwind(), svelte()],
});
