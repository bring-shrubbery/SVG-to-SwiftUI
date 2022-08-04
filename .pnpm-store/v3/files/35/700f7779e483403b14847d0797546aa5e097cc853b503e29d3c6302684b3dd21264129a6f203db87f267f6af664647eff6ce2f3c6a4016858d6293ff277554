import fs from "fs";
import { createRequire } from "module";
import path from "path";
import slash from "slash";
import { fileURLToPath } from "url";
import { warn } from "../../logger/core.js";
import { removeLeadingForwardSlash } from "../../path.js";
import { resolvePages } from "../../util.js";
import { getRouteGenerator } from "./generator.js";
const require2 = createRequire(import.meta.url);
function countOccurrences(needle, haystack) {
  let count = 0;
  for (let i = 0; i < haystack.length; i += 1) {
    if (haystack[i] === needle)
      count += 1;
  }
  return count;
}
function getParts(part, file) {
  const result = [];
  part.split(/\[(.+?\(.+?\)|.+?)\]/).map((str, i) => {
    if (!str)
      return;
    const dynamic = i % 2 === 1;
    const [, content] = dynamic ? /([^(]+)$/.exec(str) || [null, null] : [null, str];
    if (!content || dynamic && !/^(\.\.\.)?[a-zA-Z0-9_$]+$/.test(content)) {
      throw new Error(`Invalid route ${file} \u2014 parameter name must match /^[a-zA-Z0-9_$]+$/`);
    }
    result.push({
      content,
      dynamic,
      spread: dynamic && /^\.{3}.+$/.test(content)
    });
  });
  return result;
}
function getPattern(segments, addTrailingSlash) {
  const pathname = segments.map((segment) => {
    return segment[0].spread ? "(?:\\/(.*?))?" : "\\/" + segment.map((part) => {
      if (part)
        return part.dynamic ? "([^/]+?)" : part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
  }).join("");
  const trailing = addTrailingSlash && segments.length ? getTrailingSlashPattern(addTrailingSlash) : "$";
  return new RegExp(`^${pathname || "\\/"}${trailing}`);
}
function getTrailingSlashPattern(addTrailingSlash) {
  if (addTrailingSlash === "always") {
    return "\\/$";
  }
  if (addTrailingSlash === "never") {
    return "$";
  }
  return "\\/?$";
}
function isSpread(str) {
  const spreadPattern = /\[\.{3}/g;
  return spreadPattern.test(str);
}
function validateSegment(segment, file = "") {
  if (!file)
    file = segment;
  if (/^\$/.test(segment)) {
    throw new Error(`Invalid route ${file} \u2014 Astro's Collections API has been replaced by dynamic route params.`);
  }
  if (/\]\[/.test(segment)) {
    throw new Error(`Invalid route ${file} \u2014 parameters must be separated`);
  }
  if (countOccurrences("[", segment) !== countOccurrences("]", segment)) {
    throw new Error(`Invalid route ${file} \u2014 brackets are unbalanced`);
  }
  if (/.+\[\.\.\.[^\]]+\]/.test(segment) || /\[\.\.\.[^\]]+\].+/.test(segment)) {
    throw new Error(`Invalid route ${file} \u2014 rest parameter must be a standalone segment`);
  }
}
function comparator(a, b) {
  if (a.isIndex !== b.isIndex) {
    if (a.isIndex)
      return isSpread(a.file) ? 1 : -1;
    return isSpread(b.file) ? -1 : 1;
  }
  const max = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < max; i += 1) {
    const aSubPart = a.parts[i];
    const bSubPart = b.parts[i];
    if (!aSubPart)
      return 1;
    if (!bSubPart)
      return -1;
    if (aSubPart.spread && bSubPart.spread) {
      return a.isIndex ? 1 : -1;
    }
    if (aSubPart.spread !== bSubPart.spread)
      return aSubPart.spread ? 1 : -1;
    if (aSubPart.dynamic !== bSubPart.dynamic) {
      return aSubPart.dynamic ? 1 : -1;
    }
    if (!aSubPart.dynamic && aSubPart.content !== bSubPart.content) {
      return bSubPart.content.length - aSubPart.content.length || (aSubPart.content < bSubPart.content ? -1 : 1);
    }
  }
  if (a.isPage !== b.isPage) {
    return a.isPage ? 1 : -1;
  }
  return a.file < b.file ? -1 : 1;
}
function createRouteManifest({ config, cwd }, logging) {
  var _a, _b, _c, _d;
  const components = [];
  const routes = [];
  const validPageExtensions = /* @__PURE__ */ new Set([
    ".astro",
    ".md",
    ...config._ctx.pageExtensions
  ]);
  const validEndpointExtensions = /* @__PURE__ */ new Set([".js", ".ts"]);
  function walk(dir, parentSegments, parentParams) {
    let items = [];
    fs.readdirSync(dir).forEach((basename) => {
      const resolved = path.join(dir, basename);
      const file = slash(path.relative(cwd || fileURLToPath(config.root), resolved));
      const isDir = fs.statSync(resolved).isDirectory();
      const ext = path.extname(basename);
      const name = ext ? basename.slice(0, -ext.length) : basename;
      if (name[0] === "_") {
        return;
      }
      if (basename[0] === "." && basename !== ".well-known") {
        return;
      }
      if (!isDir && !validPageExtensions.has(ext) && !validEndpointExtensions.has(ext)) {
        return;
      }
      const segment = isDir ? basename : name;
      validateSegment(segment, file);
      const parts = getParts(segment, file);
      const isIndex = isDir ? false : basename.startsWith("index.");
      const routeSuffix = basename.slice(basename.indexOf("."), -ext.length);
      const isPage = validPageExtensions.has(ext);
      items.push({
        basename,
        ext,
        parts,
        file: file.replace(/\\/g, "/"),
        isDir,
        isIndex,
        isPage,
        routeSuffix
      });
    });
    items = items.sort(comparator);
    items.forEach((item) => {
      const segments = parentSegments.slice();
      if (item.isIndex) {
        if (item.routeSuffix) {
          if (segments.length > 0) {
            const lastSegment = segments[segments.length - 1].slice();
            const lastPart = lastSegment[lastSegment.length - 1];
            if (lastPart.dynamic) {
              lastSegment.push({
                dynamic: false,
                spread: false,
                content: item.routeSuffix
              });
            } else {
              lastSegment[lastSegment.length - 1] = {
                dynamic: false,
                spread: false,
                content: `${lastPart.content}${item.routeSuffix}`
              };
            }
            segments[segments.length - 1] = lastSegment;
          } else {
            segments.push(item.parts);
          }
        }
      } else {
        segments.push(item.parts);
      }
      const params = parentParams.slice();
      params.push(...item.parts.filter((p) => p.dynamic).map((p) => p.content));
      if (item.isDir) {
        walk(path.join(dir, item.basename), segments, params);
      } else {
        components.push(item.file);
        const component = item.file;
        const trailingSlash = item.isPage ? config.trailingSlash : "never";
        const pattern = getPattern(segments, trailingSlash);
        const generate = getRouteGenerator(segments, trailingSlash);
        const pathname = segments.every((segment) => segment.length === 1 && !segment[0].dynamic) ? `/${segments.map((segment) => segment[0].content).join("/")}` : null;
        const route = `/${segments.map(([{ dynamic, content }]) => dynamic ? `[${content}]` : content).join("/")}`.toLowerCase();
        routes.push({
          route,
          type: item.isPage ? "page" : "endpoint",
          pattern,
          segments,
          params,
          component,
          generate,
          pathname: pathname || void 0
        });
      }
    });
  }
  const pages = resolvePages(config);
  if (fs.existsSync(pages)) {
    walk(fileURLToPath(pages), [], []);
  } else if (((_b = (_a = config == null ? void 0 : config._ctx) == null ? void 0 : _a.injectedRoutes) == null ? void 0 : _b.length) === 0) {
    const pagesDirRootRelative = pages.href.slice(config.root.href.length);
    warn(logging, "astro", `Missing pages directory: ${pagesDirRootRelative}`);
  }
  (_d = (_c = config == null ? void 0 : config._ctx) == null ? void 0 : _c.injectedRoutes) == null ? void 0 : _d.forEach(({ pattern: name, entryPoint }) => {
    const resolved = require2.resolve(entryPoint, { paths: [cwd || fileURLToPath(config.root)] });
    const component = slash(path.relative(cwd || fileURLToPath(config.root), resolved));
    const isDynamic = (str) => (str == null ? void 0 : str[0]) === "[";
    const normalize = (str) => str == null ? void 0 : str.substring(1, (str == null ? void 0 : str.length) - 1);
    const segments = removeLeadingForwardSlash(name).split(path.sep).filter(Boolean).map((s) => {
      validateSegment(s);
      const dynamic = isDynamic(s);
      const content = dynamic ? normalize(s) : s;
      return [
        {
          content,
          dynamic,
          spread: isSpread(s)
        }
      ];
    });
    const type = resolved.endsWith(".astro") ? "page" : "endpoint";
    const isPage = type === "page";
    const trailingSlash = isPage ? config.trailingSlash : "never";
    const pattern = getPattern(segments, trailingSlash);
    const generate = getRouteGenerator(segments, trailingSlash);
    const pathname = segments.every((segment) => segment.length === 1 && !segment[0].dynamic) ? `/${segments.map((segment) => segment[0].content).join("/")}` : null;
    const params = segments.flat().filter((p) => p.dynamic).map((p) => p.content);
    const route = `/${segments.map(([{ dynamic, content }]) => dynamic ? `[${content}]` : content).join("/")}`.toLowerCase();
    const collision = routes.find(({ route: r }) => r === route);
    if (collision) {
      throw new Error(`An integration attempted to inject a route that is already used in your project: "${route}" at "${component}". 
This route collides with: "${collision.component}".`);
    }
    routes.push({
      type,
      route,
      pattern,
      segments,
      params,
      component,
      generate,
      pathname: pathname || void 0
    });
  });
  return {
    routes
  };
}
export {
  createRouteManifest
};
