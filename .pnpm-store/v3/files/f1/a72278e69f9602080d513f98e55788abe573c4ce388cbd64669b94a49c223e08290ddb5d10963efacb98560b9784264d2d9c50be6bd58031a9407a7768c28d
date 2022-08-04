import { fileURLToPath } from "url";
import { prependForwardSlash } from "../../../core/path.js";
import { isBuildingToSSR, isPage } from "../../util.js";
import { render as coreRender } from "../core.js";
import { createModuleScriptElementWithSrcSet } from "../ssr-element.js";
import { collectMdMetadata } from "../util.js";
import { getStylesForURL } from "./css.js";
import { resolveClientDevPath } from "./resolve.js";
const svelteStylesRE = /svelte\?svelte&type=style/;
async function loadRenderer(viteServer, renderer) {
  var _a;
  const id = ((_a = viteServer.moduleGraph.urlToModuleMap.get(renderer.serverEntrypoint)) == null ? void 0 : _a.id) ?? renderer.serverEntrypoint;
  const mod = await viteServer.ssrLoadModule(id);
  return { ...renderer, ssr: mod.default };
}
async function loadRenderers(viteServer, astroConfig) {
  return Promise.all(astroConfig._ctx.renderers.map((r) => loadRenderer(viteServer, r)));
}
async function preload({
  astroConfig,
  filePath,
  viteServer
}) {
  const renderers = await loadRenderers(viteServer, astroConfig);
  const mod = await viteServer.ssrLoadModule(fileURLToPath(filePath));
  if (viteServer.config.mode === "development" || !(mod == null ? void 0 : mod.$$metadata)) {
    return [renderers, mod];
  }
  const modGraph = await viteServer.moduleGraph.getModuleByUrl(fileURLToPath(filePath));
  if (modGraph) {
    await collectMdMetadata(mod.$$metadata, modGraph, viteServer);
  }
  return [renderers, mod];
}
async function render(renderers, mod, ssrOpts) {
  const {
    astroConfig,
    filePath,
    logging,
    mode,
    origin,
    pathname,
    request,
    route,
    routeCache,
    viteServer
  } = ssrOpts;
  const scripts = createModuleScriptElementWithSrcSet(mod.hasOwnProperty("$$metadata") ? Array.from(mod.$$metadata.hoistedScriptPaths()) : []);
  if (isPage(filePath, astroConfig) && mode === "development") {
    scripts.add({
      props: { type: "module", src: "/@vite/client" },
      children: ""
    });
    scripts.add({
      props: {
        type: "module",
        src: new URL("../../../runtime/client/hmr.js", import.meta.url).pathname
      },
      children: ""
    });
  }
  for (const script of astroConfig._ctx.scripts) {
    if (script.stage === "head-inline") {
      scripts.add({
        props: {},
        children: script.content
      });
    }
  }
  const { urls: styleUrls, stylesMap } = await getStylesForURL(filePath, viteServer, mode);
  let links = /* @__PURE__ */ new Set();
  [...styleUrls].forEach((href) => {
    links.add({
      props: {
        rel: "stylesheet",
        href,
        "data-astro-injected": true
      },
      children: ""
    });
  });
  let styles = /* @__PURE__ */ new Set();
  [...stylesMap].forEach(([url, content]) => {
    styles.add({
      props: {
        "data-astro-injected": svelteStylesRE.test(url) ? url : true
      },
      children: content
    });
  });
  let response = await coreRender({
    links,
    styles,
    logging,
    markdown: astroConfig.markdown,
    mod,
    origin,
    pathname,
    scripts,
    async resolve(s) {
      if (s.startsWith("/@fs")) {
        return resolveClientDevPath(s);
      }
      return "/@id" + prependForwardSlash(s);
    },
    renderers,
    request,
    route,
    routeCache,
    site: astroConfig.site ? new URL(astroConfig.base, astroConfig.site).toString() : void 0,
    ssr: isBuildingToSSR(astroConfig),
    streaming: true
  });
  return response;
}
async function ssr(preloadedComponent, ssrOpts) {
  const [renderers, mod] = preloadedComponent;
  return await render(renderers, mod, ssrOpts);
}
export {
  loadRenderers,
  preload,
  render,
  ssr
};
