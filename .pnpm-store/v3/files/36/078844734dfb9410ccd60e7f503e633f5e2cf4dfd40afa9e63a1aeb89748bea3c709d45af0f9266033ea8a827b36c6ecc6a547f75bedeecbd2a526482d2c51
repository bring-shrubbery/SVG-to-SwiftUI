import crypto from "crypto";
import esbuild from "esbuild";
import { getTopLevelPages, walkParentInfos } from "../core/build/graph.js";
import { getPageDataByViteID, getPageDatasByClientOnlyID } from "../core/build/internal.js";
import { isCSSRequest } from "../core/render/util.js";
function rollupPluginAstroBuildCSS(options) {
  const { internals } = options;
  function createHashOfPageParents(id, ctx) {
    const parents = Array.from(getTopLevelPages(id, ctx)).sort();
    const hash = crypto.createHash("sha256");
    for (const page of parents) {
      hash.update(page, "utf-8");
    }
    return hash.digest("hex").slice(0, 8);
  }
  function* getParentClientOnlys(id, ctx) {
    for (const info of walkParentInfos(id, ctx)) {
      yield* getPageDatasByClientOnlyID(internals, info.id);
    }
  }
  const CSS_PLUGIN_NAME = "@astrojs/rollup-plugin-build-css";
  const CSS_MINIFY_PLUGIN_NAME = "@astrojs/rollup-plugin-build-css-minify";
  return [
    {
      name: CSS_PLUGIN_NAME,
      outputOptions(outputOptions) {
        const manualChunks = outputOptions.manualChunks || Function.prototype;
        outputOptions.manualChunks = function(id, ...args) {
          if (typeof manualChunks == "object") {
            if (id in manualChunks) {
              return manualChunks[id];
            }
          } else if (typeof manualChunks === "function") {
            const outid = manualChunks.call(this, id, ...args);
            if (outid) {
              return outid;
            }
          }
          if (isCSSRequest(id)) {
            return createHashOfPageParents(id, args[0]);
          }
        };
      },
      async generateBundle(_outputOptions, bundle) {
        for (const [_, chunk] of Object.entries(bundle)) {
          if (chunk.type === "chunk") {
            const c = chunk;
            if ("viteMetadata" in chunk) {
              const meta = chunk["viteMetadata"];
              if (meta.importedCss.size) {
                if (options.target === "client") {
                  for (const [id] of Object.entries(c.modules)) {
                    for (const pageData of getParentClientOnlys(id, this)) {
                      for (const importedCssImport of meta.importedCss) {
                        pageData.css.add(importedCssImport);
                      }
                    }
                  }
                }
                for (const [id] of Object.entries(c.modules)) {
                  for (const pageViteID of getTopLevelPages(id, this)) {
                    const pageData = getPageDataByViteID(internals, pageViteID);
                    for (const importedCssImport of meta.importedCss) {
                      pageData == null ? void 0 : pageData.css.add(importedCssImport);
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      name: CSS_MINIFY_PLUGIN_NAME,
      enforce: "post",
      async generateBundle(_outputOptions, bundle) {
        var _a;
        if (options.target === "server") {
          for (const [, output] of Object.entries(bundle)) {
            if (output.type === "asset") {
              if (((_a = output.name) == null ? void 0 : _a.endsWith(".css")) && typeof output.source === "string") {
                const { code: minifiedCSS } = await esbuild.transform(output.source, {
                  loader: "css",
                  minify: true
                });
                output.source = minifiedCSS;
              }
            } else if (output.type === "chunk") {
              for (const [imp, bindings] of Object.entries(output.importedBindings)) {
                if (imp.startsWith("chunks/") && !bundle[imp] && output.code.includes(imp)) {
                  const depChunk = {
                    type: "chunk",
                    fileName: imp,
                    name: imp,
                    facadeModuleId: imp,
                    code: `/* Pure CSS chunk ${imp} */ ${bindings.map((b) => `export const ${b} = {};`).join("")}`,
                    dynamicImports: [],
                    implicitlyLoadedBefore: [],
                    importedBindings: {},
                    imports: [],
                    referencedFiles: [],
                    exports: Array.from(bindings),
                    isDynamicEntry: false,
                    isEntry: false,
                    isImplicitEntry: false,
                    modules: {}
                  };
                  bundle[imp] = depChunk;
                }
              }
            }
          }
        }
      }
    }
  ];
}
export {
  rollupPluginAstroBuildCSS
};
