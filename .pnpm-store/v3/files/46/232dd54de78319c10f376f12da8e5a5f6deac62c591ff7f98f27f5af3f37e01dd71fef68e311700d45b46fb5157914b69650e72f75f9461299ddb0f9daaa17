function getVitePluginByName(viteConfig, pluginName) {
  const plugin = viteConfig.plugins.find(({ name }) => name === pluginName);
  if (!plugin)
    throw new Error(`${pluginName} plugin couldn\u2019t be found`);
  return plugin;
}
function getViteResolvePlugin(viteConfig) {
  return getVitePluginByName(viteConfig, "vite:resolve");
}
function getViteLoadFallbackPlugin(viteConfig) {
  return getVitePluginByName(viteConfig, "vite:load-fallback");
}
function getViteResolve(viteConfig) {
  const plugin = getViteResolvePlugin(viteConfig);
  if (!plugin.resolveId)
    throw new Error(`vite:resolve has no resolveId() hook`);
  return plugin.resolveId.bind(null);
}
function getViteLoad(viteConfig) {
  const plugin = getViteLoadFallbackPlugin(viteConfig);
  if (!plugin.load)
    throw new Error(`vite:load-fallback has no load() hook`);
  return plugin.load.bind(null);
}
export {
  getViteLoad,
  getViteLoadFallbackPlugin,
  getVitePluginByName,
  getViteResolve,
  getViteResolvePlugin
};
