import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import image from "@astrojs/image";
import svelte from "@astrojs/svelte";

// https://astro.build/config
export default defineConfig({
	site: "https://svg-to-swiftui.quassum.com/",
	// base: "/SVG-to-SwiftUI",
	integrations: [
		tailwind(),
		svelte(),
		image({
			serviceEntryPoint: "@astrojs/image/sharp",
		}),
	],
});
