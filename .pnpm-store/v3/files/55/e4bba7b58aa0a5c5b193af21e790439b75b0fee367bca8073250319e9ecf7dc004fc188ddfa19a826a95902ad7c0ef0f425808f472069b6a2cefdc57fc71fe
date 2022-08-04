import mime from "mime";
import { Readable } from "stream";
import stripAnsi from "strip-ansi";
import { call as callEndpoint } from "../core/endpoint/dev/index.js";
import { collectErrorMetadata, fixViteErrorMessage } from "../core/errors.js";
import { error, info, warn } from "../core/logger/core.js";
import * as msg from "../core/messages.js";
import { appendForwardSlash } from "../core/path.js";
import { getParamsAndProps, GetParamsAndPropsError } from "../core/render/core.js";
import { preload, ssr } from "../core/render/dev/index.js";
import { RouteCache } from "../core/render/route-cache.js";
import { createRequest } from "../core/request.js";
import { createRouteManifest, matchRoute } from "../core/routing/index.js";
import { createSafeError, isBuildingToSSR, resolvePages } from "../core/util.js";
import notFoundTemplate, { subpathNotUsedTemplate } from "../template/4xx.js";
import serverErrorTemplate from "../template/5xx.js";
const BAD_VITE_MIDDLEWARE = [
  "viteIndexHtmlMiddleware",
  "vite404Middleware",
  "viteSpaFallbackMiddleware"
];
function removeViteHttpMiddleware(server) {
  for (let i = server.stack.length - 1; i > 0; i--) {
    if (BAD_VITE_MIDDLEWARE.includes(server.stack[i].handle.name)) {
      server.stack.splice(i, 1);
    }
  }
}
function truncateString(str, n) {
  if (str.length > n) {
    return str.substring(0, n) + "&#8230;";
  } else {
    return str;
  }
}
function writeHtmlResponse(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html, "utf-8")
  });
  res.write(html);
  res.end();
}
async function writeWebResponse(res, webResponse) {
  const { status, headers, body } = webResponse;
  let _headers = {};
  if ("raw" in headers) {
    for (const [key, value] of Object.entries(headers.raw())) {
      res.setHeader(key, value);
    }
  } else {
    _headers = Object.fromEntries(headers.entries());
  }
  res.writeHead(status, _headers);
  if (body) {
    if (Symbol.for("astro.responseBody") in webResponse) {
      let stream = webResponse[Symbol.for("astro.responseBody")];
      for await (const chunk of stream) {
        res.write(chunk.toString());
      }
    } else if (body instanceof Readable) {
      body.pipe(res);
      return;
    } else if (typeof body === "string") {
      res.write(body);
    } else {
      const reader = body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        if (value) {
          res.write(value);
        }
      }
    }
  }
  res.end();
}
async function writeSSRResult(webResponse, res) {
  return writeWebResponse(res, webResponse);
}
async function handle404Response(origin, config, req, res) {
  const site = config.site ? new URL(config.base, config.site) : void 0;
  const devRoot = site ? site.pathname : "/";
  const pathname = decodeURI(new URL(origin + req.url).pathname);
  let html = "";
  if (pathname === "/" && !pathname.startsWith(devRoot)) {
    html = subpathNotUsedTemplate(devRoot, pathname);
  } else {
    const redirectTo = req.method === "GET" && config.base !== "/" && pathname.startsWith(config.base) && pathname.replace(config.base, "/");
    if (redirectTo && redirectTo !== "/") {
      const response = new Response(null, {
        status: 302,
        headers: {
          Location: redirectTo
        }
      });
      await writeWebResponse(res, response);
      return;
    }
    html = notFoundTemplate({
      statusCode: 404,
      title: "Not found",
      tabTitle: "404: Not Found",
      pathname
    });
  }
  writeHtmlResponse(res, 404, html);
}
async function handle500Response(viteServer, origin, req, res, err) {
  const pathname = decodeURI(new URL("./index.html", origin + req.url).pathname);
  const html = serverErrorTemplate({
    statusCode: 500,
    title: "Internal Error",
    tabTitle: "500: Error",
    message: stripAnsi(err.hint ?? err.message),
    url: err.url || void 0,
    stack: truncateString(stripAnsi(err.stack), 500)
  });
  const transformedHtml = await viteServer.transformIndexHtml(pathname, html);
  writeHtmlResponse(res, 500, transformedHtml);
}
function getCustom404Route(config, manifest) {
  const relPages = resolvePages(config).href.replace(config.root.href, "");
  const pattern = new RegExp(`${appendForwardSlash(relPages)}404.(astro|md)`);
  return manifest.routes.find((r) => r.component.match(pattern));
}
function log404(logging, pathname) {
  info(logging, "serve", msg.req({ url: pathname, statusCode: 404 }));
}
async function handleRequest(routeCache, viteServer, logging, manifest, config, req, res) {
  var _a;
  const reqStart = performance.now();
  const site = config.site ? new URL(config.base, config.site) : void 0;
  const devRoot = site ? site.pathname : "/";
  const origin = `${viteServer.config.server.https ? "https" : "http"}://${req.headers.host}`;
  const buildingToSSR = isBuildingToSSR(config);
  const url = new URL(origin + ((_a = req.url) == null ? void 0 : _a.replace(/(index)?\.html$/, "")));
  const pathname = decodeURI(url.pathname);
  const rootRelativeUrl = pathname.substring(devRoot.length - 1);
  if (!buildingToSSR && rootRelativeUrl !== "/_image") {
    const allSearchParams = Array.from(url.searchParams);
    for (const [key] of allSearchParams) {
      url.searchParams.delete(key);
    }
  }
  let body = void 0;
  if (!(req.method === "GET" || req.method === "HEAD")) {
    let bytes = [];
    await new Promise((resolve) => {
      req.setEncoding("utf-8");
      req.on("data", (bts) => bytes.push(bts));
      req.on("end", resolve);
    });
    body = new TextEncoder().encode(bytes.join("")).buffer;
  }
  const request = createRequest({
    url,
    headers: buildingToSSR ? req.headers : new Headers(),
    method: req.method,
    body,
    logging,
    ssr: buildingToSSR
  });
  try {
    if (!pathname.startsWith(devRoot)) {
      log404(logging, pathname);
      return handle404Response(origin, config, req, res);
    }
    let route = matchRoute(rootRelativeUrl, manifest);
    const statusCode = route ? 200 : 404;
    if (!route) {
      log404(logging, pathname);
      const custom404 = getCustom404Route(config, manifest);
      if (custom404) {
        route = custom404;
      } else {
        return handle404Response(origin, config, req, res);
      }
    }
    const filePath = new URL(`./${route.component}`, config.root);
    const preloadedComponent = await preload({ astroConfig: config, filePath, viteServer });
    const [, mod] = preloadedComponent;
    const paramsAndPropsRes = await getParamsAndProps({
      mod,
      route,
      routeCache,
      pathname: rootRelativeUrl,
      logging,
      ssr: isBuildingToSSR(config)
    });
    if (paramsAndPropsRes === GetParamsAndPropsError.NoMatchingStaticPath) {
      warn(logging, "getStaticPaths", `Route pattern matched, but no matching static path found. (${pathname})`);
      log404(logging, pathname);
      const routeCustom404 = getCustom404Route(config, manifest);
      if (routeCustom404) {
        const filePathCustom404 = new URL(`./${routeCustom404.component}`, config.root);
        const preloadedCompCustom404 = await preload({
          astroConfig: config,
          filePath: filePathCustom404,
          viteServer
        });
        const result = await ssr(preloadedCompCustom404, {
          astroConfig: config,
          filePath: filePathCustom404,
          logging,
          mode: "development",
          origin,
          pathname: rootRelativeUrl,
          request,
          route: routeCustom404,
          routeCache,
          viteServer
        });
        return await writeSSRResult(result, res);
      } else {
        return handle404Response(origin, config, req, res);
      }
    }
    const options = {
      astroConfig: config,
      filePath,
      logging,
      mode: "development",
      origin,
      pathname: rootRelativeUrl,
      route,
      routeCache,
      viteServer,
      request
    };
    if (route.type === "endpoint") {
      const result = await callEndpoint(options);
      if (result.type === "response") {
        await writeWebResponse(res, result.response);
      } else {
        let contentType = "text/plain";
        const computedMimeType = route.pathname ? mime.getType(route.pathname) : null;
        if (computedMimeType) {
          contentType = computedMimeType;
        }
        res.writeHead(200, { "Content-Type": `${contentType};charset=utf-8` });
        res.end(result.body);
      }
    } else {
      const result = await ssr(preloadedComponent, options);
      return await writeSSRResult(result, res);
    }
  } catch (_err) {
    const err = fixViteErrorMessage(createSafeError(_err), viteServer);
    const errorWithMetadata = collectErrorMetadata(_err);
    error(logging, null, msg.formatErrorMessage(errorWithMetadata));
    handle500Response(viteServer, origin, req, res, err);
  }
}
const forceTextCSSForStylesMiddleware = function(req, res, next) {
  if (req.url) {
    const url = new URL(req.url, "https://astro.build");
    if (url.searchParams.has("astro") && url.searchParams.has("lang.css")) {
      const setHeader = res.setHeader;
      res.setHeader = function(key, value) {
        if (key.toLowerCase() === "content-type") {
          return setHeader.call(this, key, "text/css");
        }
        return setHeader.apply(this, [key, value]);
      };
    }
  }
  next();
};
function createPlugin({ config, logging }) {
  return {
    name: "astro:server",
    configureServer(viteServer) {
      let routeCache = new RouteCache(logging);
      let manifest = createRouteManifest({ config }, logging);
      function rebuildManifest(needsManifestRebuild, file) {
        routeCache.clearAll();
        if (needsManifestRebuild) {
          manifest = createRouteManifest({ config }, logging);
        }
      }
      viteServer.watcher.on("add", rebuildManifest.bind(null, true));
      viteServer.watcher.on("unlink", rebuildManifest.bind(null, true));
      viteServer.watcher.on("change", rebuildManifest.bind(null, false));
      return () => {
        removeViteHttpMiddleware(viteServer.middlewares);
        viteServer.middlewares.stack.unshift({
          route: "",
          handle: forceTextCSSForStylesMiddleware
        });
        viteServer.middlewares.use(async (req, res) => {
          if (!req.url || !req.method) {
            throw new Error("Incomplete request");
          }
          handleRequest(routeCache, viteServer, logging, manifest, config, req, res);
        });
      };
    }
  };
}
export {
  createPlugin as default
};
