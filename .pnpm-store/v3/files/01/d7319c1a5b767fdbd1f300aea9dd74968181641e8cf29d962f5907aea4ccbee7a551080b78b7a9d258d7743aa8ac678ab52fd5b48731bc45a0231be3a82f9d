import { transform } from "@astrojs/compiler";
import { fileURLToPath } from "url";
import { AstroErrorCodes } from "../core/errors.js";
import { prependForwardSlash } from "../core/path.js";
import { viteID } from "../core/util.js";
import { transformWithVite } from "./styles.js";
function createImportPlaceholder(spec) {
  return `/*IMPORT:${spec}*/`;
}
function safelyReplaceImportPlaceholder(code) {
  return code.replace(/\/\*IMPORT\:(.*?)\*\//g, `@import '$1';`);
}
const configCache = /* @__PURE__ */ new WeakMap();
async function compile({
  config,
  filename,
  moduleId,
  source,
  ssr,
  viteTransform,
  pluginContext
}) {
  const filenameURL = new URL(`file://${filename}`);
  const normalizedID = fileURLToPath(filenameURL);
  let rawCSSDeps = /* @__PURE__ */ new Set();
  let cssTransformError;
  const transformResult = await transform(source, {
    pathname: `/@fs${prependForwardSlash(moduleId)}`,
    projectRoot: config.root.toString(),
    site: config.site ? new URL(config.base, config.site).toString() : `http://localhost:${config.server.port}/`,
    sourcefile: filename,
    sourcemap: "both",
    internalURL: `/@fs${prependForwardSlash(viteID(new URL("../runtime/server/index.js", import.meta.url)))}`,
    experimentalStaticExtraction: true,
    preprocessStyle: async (value, attrs) => {
      const lang = `.${(attrs == null ? void 0 : attrs.lang) || "css"}`.toLowerCase();
      try {
        value.replace(/(?:@import)\s(?:url\()?\s?["\'](.*?)["\']\s?\)?(?:[^;]*);?/gi, (match, spec) => {
          rawCSSDeps.add(spec);
          if (lang === ".css") {
            return createImportPlaceholder(spec);
          } else {
            return match;
          }
        });
        const result = await transformWithVite({
          value,
          lang,
          id: normalizedID,
          transformHook: viteTransform,
          ssr,
          pluginContext
        });
        let map;
        if (!result)
          return null;
        if (result.map) {
          if (typeof result.map === "string") {
            map = result.map;
          } else if (result.map.mappings) {
            map = result.map.toString();
          }
        }
        const code = safelyReplaceImportPlaceholder(result.code);
        return { code, map };
      } catch (err) {
        cssTransformError = err;
        return null;
      }
    }
  }).catch((err) => {
    err.code = err.code || AstroErrorCodes.UnknownCompilerError;
    throw err;
  }).then((result) => {
    if (cssTransformError) {
      cssTransformError.code = cssTransformError.code || AstroErrorCodes.UnknownCompilerCSSError;
      throw cssTransformError;
    }
    return result;
  });
  const compileResult = Object.create(transformResult, {
    rawCSSDeps: {
      value: rawCSSDeps
    }
  });
  return compileResult;
}
function isCached(config, filename) {
  return configCache.has(config) && configCache.get(config).has(filename);
}
function invalidateCompilation(config, filename) {
  if (configCache.has(config)) {
    const cache = configCache.get(config);
    cache.delete(filename);
  }
}
async function cachedCompilation(props) {
  const { config, filename } = props;
  let cache;
  if (!configCache.has(config)) {
    cache = /* @__PURE__ */ new Map();
    configCache.set(config, cache);
  } else {
    cache = configCache.get(config);
  }
  if (cache.has(filename)) {
    return cache.get(filename);
  }
  const compileResult = await compile(props);
  cache.set(filename, compileResult);
  return compileResult;
}
export {
  cachedCompilation,
  invalidateCompilation,
  isCached
};
