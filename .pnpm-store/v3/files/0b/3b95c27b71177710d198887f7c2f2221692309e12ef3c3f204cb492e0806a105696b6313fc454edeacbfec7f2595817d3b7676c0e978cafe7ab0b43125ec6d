import { resolvedPagesVirtualModuleId } from "../app/index.js";
function* walkParentInfos(id, ctx, seen = /* @__PURE__ */ new Set()) {
  seen.add(id);
  const info = ctx.getModuleInfo(id);
  if (info) {
    yield info;
  }
  const importers = ((info == null ? void 0 : info.importers) || []).concat((info == null ? void 0 : info.dynamicImporters) || []);
  for (const imp of importers) {
    if (seen.has(imp)) {
      continue;
    }
    yield* walkParentInfos(imp, ctx, seen);
  }
}
function* getTopLevelPages(id, ctx) {
  for (const info of walkParentInfos(id, ctx)) {
    const importers = ((info == null ? void 0 : info.importers) || []).concat((info == null ? void 0 : info.dynamicImporters) || []);
    if (importers.length <= 2 && importers[0] === resolvedPagesVirtualModuleId) {
      yield info.id;
    }
  }
}
export {
  getTopLevelPages,
  walkParentInfos
};
