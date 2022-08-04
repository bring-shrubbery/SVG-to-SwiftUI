import { renderPage } from "../../runtime/server/index.js";
import { getParams } from "../routing/params.js";
import { createResult } from "./result.js";
import { callGetStaticPaths, findPathItemByKey } from "./route-cache.js";
var GetParamsAndPropsError = /* @__PURE__ */ ((GetParamsAndPropsError2) => {
  GetParamsAndPropsError2[GetParamsAndPropsError2["NoMatchingStaticPath"] = 0] = "NoMatchingStaticPath";
  return GetParamsAndPropsError2;
})(GetParamsAndPropsError || {});
async function getParamsAndProps(opts) {
  const { logging, mod, route, routeCache, pathname, ssr } = opts;
  let params = {};
  let pageProps;
  if (route && !route.pathname) {
    if (route.params.length) {
      const paramsMatch = route.pattern.exec(pathname);
      if (paramsMatch) {
        params = getParams(route.params)(paramsMatch);
      }
    }
    let routeCacheEntry = routeCache.get(route);
    if (!routeCacheEntry) {
      routeCacheEntry = await callGetStaticPaths({ mod, route, isValidate: true, logging, ssr });
      routeCache.set(route, routeCacheEntry);
    }
    const matchedStaticPath = findPathItemByKey(routeCacheEntry.staticPaths, params);
    if (!matchedStaticPath && !ssr) {
      return 0 /* NoMatchingStaticPath */;
    }
    pageProps = (matchedStaticPath == null ? void 0 : matchedStaticPath.props) ? { ...matchedStaticPath.props } : {};
  } else {
    pageProps = {};
  }
  return [params, pageProps];
}
async function render(opts) {
  const {
    links,
    styles,
    logging,
    origin,
    markdown,
    mod,
    pathname,
    scripts,
    renderers,
    request,
    resolve,
    route,
    routeCache,
    site,
    ssr,
    streaming
  } = opts;
  const paramsAndPropsRes = await getParamsAndProps({
    logging,
    mod,
    route,
    routeCache,
    pathname,
    ssr
  });
  if (paramsAndPropsRes === 0 /* NoMatchingStaticPath */) {
    throw new Error(`[getStaticPath] route pattern matched, but no matching static path found. (${pathname})`);
  }
  const [params, pageProps] = paramsAndPropsRes;
  const Component = await mod.default;
  if (!Component)
    throw new Error(`Expected an exported Astro component but received typeof ${typeof Component}`);
  const result = createResult({
    links,
    styles,
    logging,
    markdown,
    origin,
    params,
    props: pageProps,
    pathname,
    resolve,
    renderers,
    request,
    site,
    scripts,
    ssr,
    streaming
  });
  if (typeof mod.components === "object") {
    Object.assign(pageProps, { components: mod.components });
  }
  return await renderPage(result, Component, pageProps, null, streaming);
}
export {
  GetParamsAndPropsError,
  getParamsAndProps,
  render
};
