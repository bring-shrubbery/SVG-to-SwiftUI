var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var __privateMethod = (obj, member, method) => {
  __accessCheck(obj, member, "access private method");
  return method;
};
var _manifest, _manifestData, _routeDataToRouteInfo, _routeCache, _encoder, _logging, _streaming, _renderPage, renderPage_fn, _callEndpoint, callEndpoint_fn;
import mime from "mime";
import { call as callEndpoint } from "../endpoint/index.js";
import { consoleLogDestination } from "../logger/console.js";
import { joinPaths, prependForwardSlash } from "../path.js";
import { render } from "../render/core.js";
import { RouteCache } from "../render/route-cache.js";
import {
  createLinkStylesheetElementSet,
  createModuleScriptElement
} from "../render/ssr-element.js";
import { matchRoute } from "../routing/match.js";
import { deserializeManifest } from "./common.js";
const pagesVirtualModuleId = "@astrojs-pages-virtual-entry";
const resolvedPagesVirtualModuleId = "\0" + pagesVirtualModuleId;
class App {
  constructor(manifest, streaming = true) {
    __privateAdd(this, _renderPage);
    __privateAdd(this, _callEndpoint);
    __privateAdd(this, _manifest, void 0);
    __privateAdd(this, _manifestData, void 0);
    __privateAdd(this, _routeDataToRouteInfo, void 0);
    __privateAdd(this, _routeCache, void 0);
    __privateAdd(this, _encoder, new TextEncoder());
    __privateAdd(this, _logging, {
      dest: consoleLogDestination,
      level: "info"
    });
    __privateAdd(this, _streaming, void 0);
    __privateSet(this, _manifest, manifest);
    __privateSet(this, _manifestData, {
      routes: manifest.routes.map((route) => route.routeData)
    });
    __privateSet(this, _routeDataToRouteInfo, new Map(manifest.routes.map((route) => [route.routeData, route])));
    __privateSet(this, _routeCache, new RouteCache(__privateGet(this, _logging)));
    __privateSet(this, _streaming, streaming);
  }
  match(request) {
    const url = new URL(request.url);
    return matchRoute(url.pathname, __privateGet(this, _manifestData));
  }
  async render(request, routeData) {
    if (!routeData) {
      routeData = this.match(request);
      if (!routeData) {
        return new Response(null, {
          status: 404,
          statusText: "Not found"
        });
      }
    }
    const mod = __privateGet(this, _manifest).pageMap.get(routeData.component);
    if (routeData.type === "page") {
      return __privateMethod(this, _renderPage, renderPage_fn).call(this, request, routeData, mod);
    } else if (routeData.type === "endpoint") {
      return __privateMethod(this, _callEndpoint, callEndpoint_fn).call(this, request, routeData, mod);
    } else {
      throw new Error(`Unsupported route type [${routeData.type}].`);
    }
  }
}
_manifest = new WeakMap();
_manifestData = new WeakMap();
_routeDataToRouteInfo = new WeakMap();
_routeCache = new WeakMap();
_encoder = new WeakMap();
_logging = new WeakMap();
_streaming = new WeakMap();
_renderPage = new WeakSet();
renderPage_fn = async function(request, routeData, mod) {
  const url = new URL(request.url);
  const manifest = __privateGet(this, _manifest);
  const renderers = manifest.renderers;
  const info = __privateGet(this, _routeDataToRouteInfo).get(routeData);
  const links = createLinkStylesheetElementSet(info.links, manifest.site);
  let scripts = /* @__PURE__ */ new Set();
  for (const script of info.scripts) {
    if ("stage" in script) {
      if (script.stage === "head-inline") {
        scripts.add({
          props: {},
          children: script.children
        });
      }
    } else {
      scripts.add(createModuleScriptElement(script, manifest.site));
    }
  }
  const response = await render({
    links,
    logging: __privateGet(this, _logging),
    markdown: manifest.markdown,
    mod,
    origin: url.origin,
    pathname: url.pathname,
    scripts,
    renderers,
    async resolve(specifier) {
      if (!(specifier in manifest.entryModules)) {
        throw new Error(`Unable to resolve [${specifier}]`);
      }
      const bundlePath = manifest.entryModules[specifier];
      return bundlePath.startsWith("data:") ? bundlePath : prependForwardSlash(joinPaths(manifest.base, bundlePath));
    },
    route: routeData,
    routeCache: __privateGet(this, _routeCache),
    site: __privateGet(this, _manifest).site,
    ssr: true,
    request,
    streaming: __privateGet(this, _streaming)
  });
  return response;
};
_callEndpoint = new WeakSet();
callEndpoint_fn = async function(request, routeData, mod) {
  const url = new URL(request.url);
  const handler = mod;
  const result = await callEndpoint(handler, {
    logging: __privateGet(this, _logging),
    origin: url.origin,
    pathname: url.pathname,
    request,
    route: routeData,
    routeCache: __privateGet(this, _routeCache),
    ssr: true
  });
  if (result.type === "response") {
    return result.response;
  } else {
    const body = result.body;
    const headers = new Headers();
    const mimeType = mime.getType(url.pathname);
    if (mimeType) {
      headers.set("Content-Type", `${mimeType};charset=utf-8`);
    } else {
      headers.set("Content-Type", "text/plain;charset=utf-8");
    }
    const bytes = __privateGet(this, _encoder).encode(body);
    headers.set("Content-Length", bytes.byteLength.toString());
    return new Response(bytes, {
      status: 200,
      headers
    });
  }
};
export {
  App,
  deserializeManifest,
  pagesVirtualModuleId,
  resolvedPagesVirtualModuleId
};
