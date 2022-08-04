import { info } from "../core/logger/core.js";
import * as msg from "../core/messages.js";
import { invalidateCompilation, isCached } from "./compile.js";
async function trackCSSDependencies(opts) {
  const { viteDevServer, filename, deps, id } = opts;
  if (viteDevServer) {
    const mod = viteDevServer.moduleGraph.getModuleById(id);
    if (mod) {
      const cssDeps = (await Promise.all(Array.from(deps).map((spec) => {
        return this.resolve(spec, id);
      }))).filter(Boolean).map((dep) => dep.id);
      const { moduleGraph } = viteDevServer;
      const depModules = new Set(mod.importedModules);
      for (const dep of cssDeps) {
        depModules.add(moduleGraph.createFileOnlyEntry(dep));
      }
      moduleGraph.updateModuleInfo(mod, depModules, /* @__PURE__ */ new Set(), true);
      for (const dep of cssDeps) {
        this.addWatchFile(dep);
      }
    }
  }
}
async function handleHotUpdate(ctx, config, logging) {
  var _a, _b;
  invalidateCompilation(config, ctx.file);
  const filtered = new Set(ctx.modules);
  const files = /* @__PURE__ */ new Set();
  for (const mod of ctx.modules) {
    if ((_a = mod.id) == null ? void 0 : _a.endsWith(".astro?html-proxy&index=0.js")) {
      filtered.delete(mod);
      continue;
    }
    if (mod.file && isCached(config, mod.file)) {
      filtered.add(mod);
      files.add(mod.file);
    }
    for (const imp of mod.importers) {
      if (imp.file && isCached(config, imp.file)) {
        filtered.add(imp);
        files.add(imp.file);
      }
    }
  }
  for (const file2 of files) {
    invalidateCompilation(config, file2);
  }
  const mods = ctx.modules.filter((m) => !m.url.endsWith("="));
  for (const mod of mods) {
    for (const imp of mod.importedModules) {
      if ((_b = imp.id) == null ? void 0 : _b.includes("?astro&type=script")) {
        mods.push(imp);
      }
    }
  }
  const isSelfAccepting = mods.every((m) => m.isSelfAccepting || m.url.endsWith(".svelte"));
  const file = ctx.file.replace(config.root.pathname, "/");
  if (isSelfAccepting) {
    info(logging, "astro", msg.hmr({ file }));
  } else {
    info(logging, "astro", msg.reload({ file }));
  }
  return mods;
}
export {
  handleHotUpdate,
  trackCSSDependencies
};
