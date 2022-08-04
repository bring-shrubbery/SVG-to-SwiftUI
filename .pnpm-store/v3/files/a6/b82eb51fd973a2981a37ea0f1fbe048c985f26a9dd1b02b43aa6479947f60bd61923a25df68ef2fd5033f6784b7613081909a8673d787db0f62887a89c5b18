const SCRIPT_ID_PREFIX = `astro:scripts/`;
const BEFORE_HYDRATION_SCRIPT_ID = `${SCRIPT_ID_PREFIX}${"before-hydration"}.js`;
const PAGE_SCRIPT_ID = `${SCRIPT_ID_PREFIX}${"page"}.js`;
const PAGE_SSR_SCRIPT_ID = `${SCRIPT_ID_PREFIX}${"page-ssr"}.js`;
function astroScriptsPlugin({ config }) {
  return {
    name: "astro:scripts",
    async resolveId(id) {
      if (id.startsWith(SCRIPT_ID_PREFIX)) {
        return id;
      }
      return void 0;
    },
    async load(id) {
      if (id === BEFORE_HYDRATION_SCRIPT_ID) {
        return config._ctx.scripts.filter((s) => s.stage === "before-hydration").map((s) => s.content).join("\n");
      }
      if (id === PAGE_SCRIPT_ID) {
        return config._ctx.scripts.filter((s) => s.stage === "page").map((s) => s.content).join("\n");
      }
      if (id === PAGE_SSR_SCRIPT_ID) {
        return config._ctx.scripts.filter((s) => s.stage === "page-ssr").map((s) => s.content).join("\n");
      }
      return null;
    },
    buildStart(options) {
      const hasHydratedComponents = Array.isArray(options.input) && options.input.some((input) => input.startsWith("astro/client"));
      const hasHydrationScripts = config._ctx.scripts.some((s) => s.stage === "before-hydration");
      if (hasHydratedComponents && hasHydrationScripts) {
        this.emitFile({
          type: "chunk",
          id: BEFORE_HYDRATION_SCRIPT_ID,
          name: BEFORE_HYDRATION_SCRIPT_ID
        });
      }
    }
  };
}
export {
  BEFORE_HYDRATION_SCRIPT_ID,
  PAGE_SCRIPT_ID,
  PAGE_SSR_SCRIPT_ID,
  astroScriptsPlugin as default
};
