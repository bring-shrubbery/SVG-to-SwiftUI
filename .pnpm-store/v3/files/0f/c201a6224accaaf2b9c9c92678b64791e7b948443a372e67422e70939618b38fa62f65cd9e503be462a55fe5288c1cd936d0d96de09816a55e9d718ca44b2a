import path from "path";
import { unwrapId, viteID } from "../../util.js";
import { STYLE_EXTENSIONS } from "../util.js";
const fileExtensionsToSSR = /* @__PURE__ */ new Set([".md"]);
async function getStylesForURL(filePath, viteServer, mode) {
  const importedCssUrls = /* @__PURE__ */ new Set();
  const importedStylesMap = /* @__PURE__ */ new Map();
  async function crawlCSS(_id, isFile, scanned = /* @__PURE__ */ new Set()) {
    var _a;
    const id = unwrapId(_id);
    const importedModules = /* @__PURE__ */ new Set();
    const moduleEntriesForId = isFile ? viteServer.moduleGraph.getModulesByFile(id) ?? /* @__PURE__ */ new Set() : /* @__PURE__ */ new Set([viteServer.moduleGraph.getModuleById(id)]);
    for (const entry of moduleEntriesForId) {
      if (!entry) {
        continue;
      }
      if (id === entry.id) {
        scanned.add(id);
        for (const importedModule of entry.importedModules) {
          if (importedModule.id) {
            const { pathname } = new URL(`file://${importedModule.id}`);
            if (fileExtensionsToSSR.has(path.extname(pathname))) {
              await viteServer.ssrLoadModule(importedModule.id);
            }
          }
          importedModules.add(importedModule);
        }
      }
    }
    for (const importedModule of importedModules) {
      if (!importedModule.id || scanned.has(importedModule.id)) {
        continue;
      }
      const ext = path.extname(importedModule.url).toLowerCase();
      if (STYLE_EXTENSIONS.has(ext)) {
        if (mode === "development" && typeof ((_a = importedModule.ssrModule) == null ? void 0 : _a.default) === "string") {
          importedStylesMap.set(importedModule.url, importedModule.ssrModule.default);
        } else {
          importedCssUrls.add(importedModule.url);
        }
      }
      await crawlCSS(importedModule.id, false, scanned);
    }
  }
  await crawlCSS(viteID(filePath), true);
  return {
    urls: importedCssUrls,
    stylesMap: importedStylesMap
  };
}
export {
  getStylesForURL
};
