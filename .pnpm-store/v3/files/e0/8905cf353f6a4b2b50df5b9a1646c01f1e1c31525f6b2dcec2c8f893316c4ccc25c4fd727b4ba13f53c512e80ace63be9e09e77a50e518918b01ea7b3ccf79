import glob from "fast-glob";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { runHookBuildSsr } from "../../integrations/index.js";
import { BEFORE_HYDRATION_SCRIPT_ID } from "../../vite-plugin-scripts/index.js";
import { pagesVirtualModuleId } from "../app/index.js";
import { serializeRouteData } from "../routing/index.js";
import { addRollupInput } from "./add-rollup-input.js";
import { eachPageData } from "./internal.js";
const virtualModuleId = "@astrojs-ssr-virtual-entry";
const resolvedVirtualModuleId = "\0" + virtualModuleId;
const manifestReplace = "@@ASTRO_MANIFEST_REPLACE@@";
const replaceExp = new RegExp(`['"](${manifestReplace})['"]`, "g");
function vitePluginSSR(buildOpts, internals, adapter) {
  return {
    name: "@astrojs/vite-plugin-astro-ssr",
    enforce: "post",
    options(opts) {
      return addRollupInput(opts, [virtualModuleId]);
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        return `import * as adapter from '${adapter.serverEntrypoint}';
import * as _main from '${pagesVirtualModuleId}';
import { deserializeManifest as _deserializeManifest } from 'astro/app';
const _manifest = Object.assign(_deserializeManifest('${manifestReplace}'), {
	pageMap: _main.pageMap,
	renderers: _main.renderers
});
const _args = ${adapter.args ? JSON.stringify(adapter.args) : "undefined"};

${adapter.exports ? `const _exports = adapter.createExports(_manifest, _args);
${adapter.exports.map((name) => {
          if (name === "default") {
            return `const _default = _exports['default'];
export { _default as default };`;
          } else {
            return `export const ${name} = _exports['${name}'];`;
          }
        }).join("\n")}
` : ""}
const _start = 'start';
if(_start in adapter) {
	adapter[_start](_manifest, _args);
}`;
      }
      return void 0;
    },
    async generateBundle(_opts, bundle) {
      for (const [_chunkName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "asset") {
          internals.staticFiles.add(chunk.fileName);
        }
      }
      for (const [chunkName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "asset") {
          continue;
        }
        if (chunk.modules[resolvedVirtualModuleId]) {
          internals.ssrEntryChunk = chunk;
          delete bundle[chunkName];
        }
      }
    }
  };
}
async function injectManifest(buildOpts, internals) {
  if (!internals.ssrEntryChunk) {
    throw new Error(`Did not generate an entry chunk for SSR`);
  }
  const clientStatics = new Set(await glob("**/*", {
    cwd: fileURLToPath(buildOpts.buildConfig.client)
  }));
  for (const file of clientStatics) {
    internals.staticFiles.add(file);
  }
  const staticFiles = internals.staticFiles;
  const manifest = buildManifest(buildOpts, internals, Array.from(staticFiles));
  await runHookBuildSsr({ config: buildOpts.astroConfig, manifest });
  const chunk = internals.ssrEntryChunk;
  const code = chunk.code;
  chunk.code = code.replace(replaceExp, () => {
    return JSON.stringify(manifest);
  });
  const serverEntryURL = new URL(buildOpts.buildConfig.serverEntry, buildOpts.buildConfig.server);
  await fs.promises.mkdir(new URL("./", serverEntryURL), { recursive: true });
  await fs.promises.writeFile(serverEntryURL, chunk.code, "utf-8");
}
function buildManifest(opts, internals, staticFiles) {
  const { astroConfig } = opts;
  const routes = [];
  for (const pageData of eachPageData(internals)) {
    const scripts = [];
    if (pageData.hoistedScript) {
      scripts.unshift(pageData.hoistedScript);
    }
    routes.push({
      file: "",
      links: Array.from(pageData.css),
      scripts: [
        ...scripts,
        ...astroConfig._ctx.scripts.filter((script) => script.stage === "head-inline").map(({ stage, content }) => ({ stage, children: content }))
      ],
      routeData: serializeRouteData(pageData.route, astroConfig.trailingSlash)
    });
  }
  const entryModules = Object.fromEntries(internals.entrySpecifierToBundleMap.entries());
  entryModules[BEFORE_HYDRATION_SCRIPT_ID] = "data:text/javascript;charset=utf-8,//[no before-hydration script]";
  const ssrManifest = {
    routes,
    site: astroConfig.site,
    base: astroConfig.base,
    markdown: astroConfig.markdown,
    pageMap: null,
    renderers: [],
    entryModules,
    assets: staticFiles.map((s) => "/" + s)
  };
  return ssrManifest;
}
export {
  injectManifest,
  virtualModuleId,
  vitePluginSSR
};
