import http from "http";
import { performance } from "perf_hooks";
import sirv from "sirv";
import { fileURLToPath } from "url";
import { notFoundTemplate, subpathNotUsedTemplate } from "../../template/4xx.js";
import { error, info } from "../logger/core.js";
import * as msg from "../messages.js";
import { getResolvedHostForHttpServer } from "./util.js";
const HAS_FILE_EXTENSION_REGEXP = /^.*\.[^\\]+$/;
async function preview(config, { logging }) {
  const startServerTime = performance.now();
  const defaultOrigin = "http://localhost";
  const trailingSlash = config.trailingSlash;
  let baseURL = new URL(config.base, new URL(config.site || "/", defaultOrigin));
  const staticFileServer = sirv(fileURLToPath(config.outDir), {
    dev: true,
    etag: true,
    maxAge: 0
  });
  const server = http.createServer((req, res) => {
    var _a;
    const requestURL = new URL(req.url, defaultOrigin);
    if (!requestURL.pathname.startsWith(baseURL.pathname)) {
      res.statusCode = 404;
      res.end(subpathNotUsedTemplate(baseURL.pathname, requestURL.pathname));
      return;
    }
    const pathname = requestURL.pathname.slice(baseURL.pathname.length - 1);
    const isRoot = pathname === "/";
    const hasTrailingSlash = isRoot || pathname.endsWith("/");
    function sendError(message) {
      res.statusCode = 404;
      res.end(notFoundTemplate(pathname, message));
    }
    switch (true) {
      case (hasTrailingSlash && trailingSlash == "never" && !isRoot):
        sendError('Not Found (trailingSlash is set to "never")');
        return;
      case (!hasTrailingSlash && trailingSlash == "always" && !isRoot && !HAS_FILE_EXTENSION_REGEXP.test(pathname)):
        sendError('Not Found (trailingSlash is set to "always")');
        return;
      default: {
        req.url = "/" + ((_a = req.url) == null ? void 0 : _a.replace(baseURL.pathname, ""));
        staticFileServer(req, res, () => sendError("Not Found"));
        return;
      }
    }
  });
  let { port } = config.server;
  const host = getResolvedHostForHttpServer(config.server.host);
  let httpServer;
  function startServer(timerStart) {
    let showedPortTakenMsg = false;
    let showedListenMsg = false;
    return new Promise((resolve, reject) => {
      const listen = () => {
        httpServer = server.listen(port, host, async () => {
          if (!showedListenMsg) {
            const devServerAddressInfo = server.address();
            info(logging, null, msg.devStart({
              startupTime: performance.now() - timerStart,
              config,
              devServerAddressInfo,
              https: false,
              site: baseURL
            }));
          }
          showedListenMsg = true;
          resolve();
        });
        httpServer == null ? void 0 : httpServer.on("error", onError);
      };
      const onError = (err) => {
        if (err.code && err.code === "EADDRINUSE") {
          if (!showedPortTakenMsg) {
            info(logging, "astro", msg.portInUse({ port }));
            showedPortTakenMsg = true;
          }
          port++;
          return listen();
        } else {
          error(logging, "astro", err.stack);
          httpServer == null ? void 0 : httpServer.removeListener("error", onError);
          reject(err);
        }
      };
      listen();
    });
  }
  await startServer(startServerTime);
  function closed() {
    return new Promise((resolve, reject) => {
      httpServer.addListener("close", resolve);
      httpServer.addListener("error", reject);
    });
  }
  return {
    host,
    port,
    closed,
    server: httpServer,
    stop: async () => {
      await new Promise((resolve, reject) => {
        httpServer.close((err) => err ? reject(err) : resolve(void 0));
      });
    }
  };
}
export {
  preview as default
};
