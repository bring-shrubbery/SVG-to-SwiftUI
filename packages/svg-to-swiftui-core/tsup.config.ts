import { defineConfig } from "tsup";

export default defineConfig({
  // css-select is ESM-only. Bundle it so the published CommonJS entry remains loadable.
  noExternal: ["css-select"],
});
