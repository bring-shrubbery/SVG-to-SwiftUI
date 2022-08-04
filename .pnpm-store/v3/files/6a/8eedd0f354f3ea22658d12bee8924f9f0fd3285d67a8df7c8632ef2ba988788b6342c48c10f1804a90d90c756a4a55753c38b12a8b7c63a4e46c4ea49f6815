import npath from "path";
import { appendForwardSlash } from "../../core/path.js";
const STATUS_CODE_PAGES = /* @__PURE__ */ new Set(["/404", "/500"]);
function getOutRoot(astroConfig) {
  return new URL("./", astroConfig.outDir);
}
function getOutFolder(astroConfig, pathname, routeType) {
  const outRoot = getOutRoot(astroConfig);
  switch (routeType) {
    case "endpoint":
      return new URL("." + appendForwardSlash(npath.dirname(pathname)), outRoot);
    case "page":
      switch (astroConfig.build.format) {
        case "directory": {
          if (STATUS_CODE_PAGES.has(pathname)) {
            return new URL("." + appendForwardSlash(npath.dirname(pathname)), outRoot);
          }
          return new URL("." + appendForwardSlash(pathname), outRoot);
        }
        case "file": {
          return new URL("." + appendForwardSlash(npath.dirname(pathname)), outRoot);
        }
      }
  }
}
function getOutFile(astroConfig, outFolder, pathname, routeType) {
  switch (routeType) {
    case "endpoint":
      return new URL(npath.basename(pathname), outFolder);
    case "page":
      switch (astroConfig.build.format) {
        case "directory": {
          if (STATUS_CODE_PAGES.has(pathname)) {
            const baseName = npath.basename(pathname);
            return new URL("./" + (baseName || "index") + ".html", outFolder);
          }
          return new URL("./index.html", outFolder);
        }
        case "file": {
          const baseName = npath.basename(pathname);
          return new URL("./" + (baseName || "index") + ".html", outFolder);
        }
      }
  }
}
export {
  getOutFile,
  getOutFolder
};
