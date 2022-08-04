import { info } from "../logger/core.js";
import * as colors from "kleur/colors";
import { fileURLToPath } from "url";
import { debug } from "../logger/core.js";
import { removeTrailingForwardSlash } from "../path.js";
import { callGetStaticPaths } from "../render/route-cache.js";
import { matchRoute } from "../routing/match.js";
import { isBuildingToSSR } from "../util.js";
async function collectPagesData(opts) {
  const { astroConfig, logging, manifest, origin, routeCache, viteServer } = opts;
  const assets = {};
  const allPages = {};
  const builtPaths = /* @__PURE__ */ new Set();
  const buildMode = isBuildingToSSR(astroConfig) ? "ssr" : "static";
  const dataCollectionLogTimeout = setInterval(() => {
    info(opts.logging, "build", "The data collection step may take longer for larger projects...");
    clearInterval(dataCollectionLogTimeout);
  }, 3e4);
  for (const route of manifest.routes) {
    if (route.pathname) {
      const routeCollectionLogTimeout = setInterval(() => {
        info(opts.logging, "build", `${colors.bold(route.component)} is taking a bit longer to import. This is common for larger "Astro.glob(...)" or "import.meta.globEager(...)" calls, for instance. Hang tight!`);
        clearInterval(routeCollectionLogTimeout);
      }, 1e4);
      builtPaths.add(route.pathname);
      allPages[route.component] = {
        component: route.component,
        route,
        paths: [route.pathname],
        moduleSpecifier: "",
        css: /* @__PURE__ */ new Set(),
        hoistedScript: void 0
      };
      clearInterval(routeCollectionLogTimeout);
      if (buildMode === "static") {
        const html = `${route.pathname}`.replace(/\/?$/, "/index.html");
        debug("build", `\u251C\u2500\u2500 ${colors.bold(colors.green("\u2714"))} ${route.component} \u2192 ${colors.yellow(html)}`);
      } else {
        debug("build", `\u251C\u2500\u2500 ${colors.bold(colors.green("\u2714"))} ${route.component}`);
      }
      continue;
    }
    const result = await getStaticPathsForRoute(opts, route).then((_result) => {
      const label = _result.staticPaths.length === 1 ? "page" : "pages";
      debug("build", `\u251C\u2500\u2500 ${colors.bold(colors.green("\u2714"))} ${route.component} \u2192 ${colors.magenta(`[${_result.staticPaths.length} ${label}]`)}`);
      return _result;
    }).catch((err) => {
      debug("build", `\u251C\u2500\u2500 ${colors.bold(colors.red("\u2717"))} ${route.component}`);
      throw err;
    });
    const finalPaths = result.staticPaths.map((staticPath) => staticPath.params && route.generate(staticPath.params)).filter((staticPath) => {
      if (!staticPath) {
        return false;
      }
      if (!builtPaths.has(removeTrailingForwardSlash(staticPath))) {
        return true;
      }
      const matchedRoute = matchRoute(staticPath, manifest);
      return matchedRoute === route;
    });
    finalPaths.map((staticPath) => builtPaths.add(removeTrailingForwardSlash(staticPath)));
    allPages[route.component] = {
      component: route.component,
      route,
      paths: finalPaths,
      moduleSpecifier: "",
      css: /* @__PURE__ */ new Set(),
      hoistedScript: void 0
    };
  }
  clearInterval(dataCollectionLogTimeout);
  return { assets, allPages };
}
async function getStaticPathsForRoute(opts, route) {
  const { astroConfig, logging, routeCache, ssr, viteServer } = opts;
  if (!viteServer)
    throw new Error(`vite.createServer() not called!`);
  const filePath = new URL(`./${route.component}`, astroConfig.root);
  const mod = await viteServer.ssrLoadModule(fileURLToPath(filePath));
  const result = await callGetStaticPaths({ mod, route, isValidate: false, logging, ssr });
  routeCache.set(route, result);
  return result;
}
export {
  collectPagesData
};
