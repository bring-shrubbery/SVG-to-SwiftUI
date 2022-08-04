import { pagesVirtualModuleId, resolvedPagesVirtualModuleId } from "../app/index.js";
import { isBuildingToSSR } from "../util.js";
import { addRollupInput } from "./add-rollup-input.js";
import { eachPageData } from "./internal.js";
function vitePluginPages(opts, internals) {
  return {
    name: "@astro/plugin-build-pages",
    options(options) {
      if (!isBuildingToSSR(opts.astroConfig)) {
        return addRollupInput(options, [pagesVirtualModuleId]);
      }
    },
    resolveId(id) {
      if (id === pagesVirtualModuleId) {
        return resolvedPagesVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedPagesVirtualModuleId) {
        let importMap = "";
        let imports = [];
        let i = 0;
        for (const pageData of eachPageData(internals)) {
          const variable = `_page${i}`;
          imports.push(`import * as ${variable} from '${pageData.moduleSpecifier}';`);
          importMap += `['${pageData.component}', ${variable}],`;
          i++;
        }
        i = 0;
        let rendererItems = "";
        for (const renderer of opts.astroConfig._ctx.renderers) {
          const variable = `_renderer${i}`;
          imports.unshift(`import ${variable} from '${renderer.serverEntrypoint}';`);
          rendererItems += `Object.assign(${JSON.stringify(renderer)}, { ssr: ${variable} }),`;
          i++;
        }
        const def = `${imports.join("\n")}

export const pageMap = new Map([${importMap}]);
export const renderers = [${rendererItems}];`;
        return def;
      }
    }
  };
}
export {
  vitePluginPages
};
