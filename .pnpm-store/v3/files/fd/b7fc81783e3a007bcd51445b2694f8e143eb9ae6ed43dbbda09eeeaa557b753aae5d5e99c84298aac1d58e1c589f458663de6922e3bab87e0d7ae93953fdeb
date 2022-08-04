import npath from "path-browserify";
function createCanonicalURL(url, base, paginated) {
  let pathname = url.replace(/\/index.html$/, "");
  if (paginated) {
    pathname = pathname.replace(/\/1\/?$/, "");
  }
  if (!npath.extname(pathname))
    pathname = pathname.replace(/(\/+)?$/, "/");
  pathname = pathname.replace(/\/+/g, "/");
  return new URL(pathname, base);
}
function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
  }
  return false;
}
const STYLE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".css",
  ".pcss",
  ".postcss",
  ".scss",
  ".sass",
  ".styl",
  ".stylus",
  ".less"
]);
const MARKDOWN_IMPORT_FLAG = "?mdImport";
const cssRe = new RegExp(`\\.(${Array.from(STYLE_EXTENSIONS).map((s) => s.slice(1)).join("|")})($|\\?)`);
const isCSSRequest = (request) => cssRe.test(request);
const seenMdMetadata = /* @__PURE__ */ new Set();
async function collectMdMetadata(metadata, modGraph, viteServer) {
  const importedModules = [...(modGraph == null ? void 0 : modGraph.importedModules) ?? []];
  await Promise.all(importedModules.map(async (importedModule) => {
    var _a, _b;
    if (!importedModule.id || seenMdMetadata.has(importedModule.id))
      return;
    seenMdMetadata.add(importedModule.id);
    await collectMdMetadata(metadata, importedModule, viteServer);
    if (!((_a = importedModule == null ? void 0 : importedModule.id) == null ? void 0 : _a.endsWith(MARKDOWN_IMPORT_FLAG)))
      return;
    const mdSSRMod = await viteServer.ssrLoadModule(importedModule.id);
    const mdMetadata = await ((_b = mdSSRMod.$$loadMetadata) == null ? void 0 : _b.call(mdSSRMod));
    if (!mdMetadata)
      return;
    for (let mdMod of mdMetadata.modules) {
      mdMod.specifier = mdMetadata.resolvePath(mdMod.specifier);
      metadata.modules.push(mdMod);
    }
    for (let mdHoisted of mdMetadata.hoisted) {
      metadata.hoisted.push(mdHoisted);
    }
    for (let mdHydrated of mdMetadata.hydratedComponents) {
      metadata.hydratedComponents.push(mdHydrated);
    }
    for (let mdClientOnly of mdMetadata.clientOnlyComponents) {
      metadata.clientOnlyComponents.push(mdClientOnly);
    }
    for (let mdHydrationDirective of mdMetadata.hydrationDirectives) {
      metadata.hydrationDirectives.add(mdHydrationDirective);
    }
  }));
}
export {
  STYLE_EXTENSIONS,
  collectMdMetadata,
  createCanonicalURL,
  isCSSRequest,
  isValidURL
};
