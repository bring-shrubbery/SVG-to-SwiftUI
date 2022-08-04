import { debug, warn } from "../logger/core.js";
import { stringifyParams } from "../routing/params.js";
import {
  validateGetStaticPathsModule,
  validateGetStaticPathsResult
} from "../routing/validation.js";
import { generatePaginateFunction } from "./paginate.js";
async function callGetStaticPaths({
  isValidate,
  logging,
  mod,
  route,
  ssr
}) {
  validateGetStaticPathsModule(mod, { ssr });
  let staticPaths = [];
  if (mod.getStaticPaths) {
    staticPaths = (await mod.getStaticPaths({
      paginate: generatePaginateFunction(route),
      rss() {
        throw new Error("The RSS helper has been removed from getStaticPaths! Try the new @astrojs/rss package instead. See https://docs.astro.build/en/guides/rss/");
      }
    })).flat();
  }
  const keyedStaticPaths = staticPaths;
  keyedStaticPaths.keyed = /* @__PURE__ */ new Map();
  for (const sp of keyedStaticPaths) {
    const paramsKey = stringifyParams(sp.params);
    keyedStaticPaths.keyed.set(paramsKey, sp);
  }
  if (isValidate) {
    validateGetStaticPathsResult(keyedStaticPaths, logging);
  }
  return {
    staticPaths: keyedStaticPaths
  };
}
class RouteCache {
  constructor(logging) {
    this.cache = {};
    this.logging = logging;
  }
  clearAll() {
    this.cache = {};
  }
  set(route, entry) {
    if (this.cache[route.component]) {
      warn(this.logging, "routeCache", `Internal Warning: route cache overwritten. (${route.component})`);
    }
    this.cache[route.component] = entry;
  }
  get(route) {
    return this.cache[route.component];
  }
}
function findPathItemByKey(staticPaths, params) {
  const paramsKey = stringifyParams(params);
  let matchedStaticPath = staticPaths.keyed.get(paramsKey);
  if (matchedStaticPath) {
    return matchedStaticPath;
  }
  debug("findPathItemByKey", `Unexpected cache miss looking for ${paramsKey}`);
  matchedStaticPath = staticPaths.find(({ params: _params }) => JSON.stringify(_params) === paramsKey);
}
export {
  RouteCache,
  callGetStaticPaths,
  findPathItemByKey
};
