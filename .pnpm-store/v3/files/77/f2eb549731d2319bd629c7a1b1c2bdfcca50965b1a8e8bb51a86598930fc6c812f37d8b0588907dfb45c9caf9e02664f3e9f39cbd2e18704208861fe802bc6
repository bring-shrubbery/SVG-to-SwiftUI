import { prependForwardSlash } from "../path.js";
import { viteID } from "../util.js";
function createBuildInternals() {
  const pureCSSChunks = /* @__PURE__ */ new Set();
  const chunkToReferenceIdMap = /* @__PURE__ */ new Map();
  const astroStyleMap = /* @__PURE__ */ new Map();
  const astroPageStyleMap = /* @__PURE__ */ new Map();
  const hoistedScriptIdToHoistedMap = /* @__PURE__ */ new Map();
  const hoistedScriptIdToPagesMap = /* @__PURE__ */ new Map();
  return {
    pureCSSChunks,
    hoistedScriptIdToHoistedMap,
    hoistedScriptIdToPagesMap,
    entrySpecifierToBundleMap: /* @__PURE__ */ new Map(),
    pagesByComponent: /* @__PURE__ */ new Map(),
    pagesByViteID: /* @__PURE__ */ new Map(),
    pagesByClientOnly: /* @__PURE__ */ new Map(),
    discoveredHydratedComponents: /* @__PURE__ */ new Set(),
    discoveredClientOnlyComponents: /* @__PURE__ */ new Set(),
    discoveredScripts: /* @__PURE__ */ new Set(),
    staticFiles: /* @__PURE__ */ new Set()
  };
}
function trackPageData(internals, component, pageData, componentModuleId, componentURL) {
  pageData.moduleSpecifier = componentModuleId;
  internals.pagesByComponent.set(component, pageData);
  internals.pagesByViteID.set(viteID(componentURL), pageData);
}
function trackClientOnlyPageDatas(internals, pageData, clientOnlys) {
  for (const clientOnlyComponent of clientOnlys) {
    let pageDataSet;
    if (internals.pagesByClientOnly.has(clientOnlyComponent)) {
      pageDataSet = internals.pagesByClientOnly.get(clientOnlyComponent);
    } else {
      pageDataSet = /* @__PURE__ */ new Set();
      internals.pagesByClientOnly.set(clientOnlyComponent, pageDataSet);
    }
    pageDataSet.add(pageData);
  }
}
function* getPageDatasByChunk(internals, chunk) {
  const pagesByViteID = internals.pagesByViteID;
  for (const [modulePath] of Object.entries(chunk.modules)) {
    if (pagesByViteID.has(modulePath)) {
      yield pagesByViteID.get(modulePath);
    }
  }
}
function* getPageDatasByClientOnlyID(internals, viteid) {
  const pagesByClientOnly = internals.pagesByClientOnly;
  if (pagesByClientOnly.size) {
    const pathname = `/@fs${prependForwardSlash(viteid)}`;
    const pageBuildDatas = pagesByClientOnly.get(pathname);
    if (pageBuildDatas) {
      for (const pageData of pageBuildDatas) {
        yield pageData;
      }
    }
  }
}
function getPageDataByComponent(internals, component) {
  if (internals.pagesByComponent.has(component)) {
    return internals.pagesByComponent.get(component);
  }
  return void 0;
}
function getPageDataByViteID(internals, viteid) {
  if (internals.pagesByViteID.has(viteid)) {
    return internals.pagesByViteID.get(viteid);
  }
  return void 0;
}
function hasPageDataByViteID(internals, viteid) {
  return internals.pagesByViteID.has(viteid);
}
function* eachPageData(internals) {
  yield* internals.pagesByComponent.values();
}
export {
  createBuildInternals,
  eachPageData,
  getPageDataByComponent,
  getPageDataByViteID,
  getPageDatasByChunk,
  getPageDatasByClientOnlyID,
  hasPageDataByViteID,
  trackClientOnlyPageDatas,
  trackPageData
};
