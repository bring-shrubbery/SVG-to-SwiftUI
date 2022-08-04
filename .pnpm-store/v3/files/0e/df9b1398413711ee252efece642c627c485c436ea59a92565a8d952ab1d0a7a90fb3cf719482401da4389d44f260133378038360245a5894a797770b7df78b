import ancestor from "common-ancestor-path";
import esbuild from "esbuild";
import fs from "fs";
import slash from "slash";
import { fileURLToPath } from "url";
import { isRelativePath, startsWithForwardSlash } from "../core/path.js";
import { resolvePages } from "../core/util.js";
import { PAGE_SCRIPT_ID, PAGE_SSR_SCRIPT_ID } from "../vite-plugin-scripts/index.js";
import { getFileInfo } from "../vite-plugin-utils/index.js";
import { cachedCompilation } from "./compile.js";
import { handleHotUpdate, trackCSSDependencies } from "./hmr.js";
import { parseAstroRequest } from "./query.js";
import { getViteTransform } from "./styles.js";
const FRONTMATTER_PARSE_REGEXP = /^\-\-\-(.*)^\-\-\-/ms;
function astro({ config, logging }) {
  function normalizeFilename(filename) {
    if (filename.startsWith("/@fs")) {
      filename = filename.slice("/@fs".length);
    } else if (filename.startsWith("/") && !ancestor(filename, config.root.pathname)) {
      filename = new URL("." + filename, config.root).pathname;
    }
    return filename;
  }
  function relativeToRoot(pathname) {
    const arg = startsWithForwardSlash(pathname) ? "." + pathname : pathname;
    const url = new URL(arg, config.root);
    return slash(fileURLToPath(url)) + url.search;
  }
  let resolvedConfig;
  let viteTransform;
  let viteDevServer = null;
  const srcRootWeb = config.srcDir.pathname.slice(config.root.pathname.length - 1);
  const isBrowserPath = (path) => path.startsWith(srcRootWeb);
  function resolveRelativeFromAstroParent(id, parsedFrom) {
    const filename = normalizeFilename(parsedFrom.filename);
    const resolvedURL = new URL(id, `file://${filename}`);
    const resolved = resolvedURL.pathname;
    if (isBrowserPath(resolved)) {
      return relativeToRoot(resolved + resolvedURL.search);
    }
    return slash(fileURLToPath(resolvedURL)) + resolvedURL.search;
  }
  return {
    name: "astro:build",
    enforce: "pre",
    configResolved(_resolvedConfig) {
      resolvedConfig = _resolvedConfig;
      viteTransform = getViteTransform(resolvedConfig);
    },
    configureServer(server) {
      viteDevServer = server;
    },
    async resolveId(id, from, opts) {
      if (from) {
        const parsedFrom = parseAstroRequest(from);
        const isAstroScript = parsedFrom.query.astro && parsedFrom.query.type === "script";
        if (isAstroScript && isRelativePath(id)) {
          return this.resolve(resolveRelativeFromAstroParent(id, parsedFrom), from, {
            custom: opts.custom,
            skipSelf: true
          });
        }
      }
      const { query } = parseAstroRequest(id);
      if (query.astro) {
        if (query.type === "style" && isBrowserPath(id)) {
          return relativeToRoot(id);
        }
        return id;
      }
    },
    async load(id, opts) {
      var _a, _b;
      const parsedId = parseAstroRequest(id);
      const query = parsedId.query;
      if (!id.endsWith(".astro") && !query.astro) {
        return null;
      }
      if (isRelativePath(parsedId.filename)) {
        return null;
      }
      const filename = normalizeFilename(parsedId.filename);
      const fileUrl = new URL(`file://${filename}`);
      let source = await fs.promises.readFile(fileUrl, "utf-8");
      const isPage = fileUrl.pathname.startsWith(resolvePages(config).pathname);
      if (isPage && config._ctx.scripts.some((s) => s.stage === "page")) {
        source += `
<script src="${PAGE_SCRIPT_ID}" />`;
      }
      const compileProps = {
        config,
        filename,
        moduleId: id,
        source,
        ssr: Boolean(opts == null ? void 0 : opts.ssr),
        viteTransform,
        pluginContext: this
      };
      if (query.astro) {
        if (query.type === "style") {
          if (typeof query.index === "undefined") {
            throw new Error(`Requests for Astro CSS must include an index.`);
          }
          const transformResult = await cachedCompilation(compileProps);
          await trackCSSDependencies.call(this, {
            viteDevServer,
            id,
            filename,
            deps: transformResult.rawCSSDeps
          });
          const csses = transformResult.css;
          const code = csses[query.index];
          return {
            code
          };
        } else if (query.type === "script") {
          if (typeof query.index === "undefined") {
            throw new Error(`Requests for hoisted scripts must include an index`);
          }
          if (opts == null ? void 0 : opts.ssr) {
            return {
              code: `/* client hoisted script, empty in SSR: ${id} */`
            };
          }
          const transformResult = await cachedCompilation(compileProps);
          const scripts = transformResult.scripts;
          const hoistedScript = scripts[query.index];
          if (!hoistedScript) {
            throw new Error(`No hoisted script at index ${query.index}`);
          }
          if (hoistedScript.type === "external") {
            const src = hoistedScript.src;
            if (src.startsWith("/") && !isBrowserPath(src)) {
              const publicDir = config.publicDir.pathname.replace(/\/$/, "").split("/").pop() + "/";
              throw new Error(`

<script src="${src}"> references an asset in the "${publicDir}" directory. Please add the "is:inline" directive to keep this asset from being bundled.

File: ${filename}`);
            }
          }
          return {
            code: hoistedScript.type === "inline" ? hoistedScript.code : `import "${hoistedScript.src}";`,
            meta: {
              vite: {
                lang: "ts"
              }
            }
          };
        }
      }
      try {
        const transformResult = await cachedCompilation(compileProps);
        const { fileId: file, fileUrl: url } = getFileInfo(id, config);
        const { code, map } = await esbuild.transform(transformResult.code, {
          loader: "ts",
          sourcemap: "external",
          sourcefile: id,
          define: (_a = config.vite) == null ? void 0 : _a.define
        });
        let SUFFIX = "";
        SUFFIX += `
const $$file = ${JSON.stringify(file)};
const $$url = ${JSON.stringify(url)};export { $$file as file, $$url as url };
`;
        if (!resolvedConfig.isProduction) {
          const metadata = transformResult.code.split("$$createMetadata(")[1].split("});\n")[0];
          const pattern = /specifier:\s*'([^']*)'/g;
          const deps = /* @__PURE__ */ new Set();
          let match;
          while (match = (_b = pattern.exec(metadata)) == null ? void 0 : _b[1]) {
            deps.add(match);
          }
          let i = 0;
          while (i < transformResult.scripts.length) {
            deps.add(`${id}?astro&type=script&index=${i}&lang.ts`);
            SUFFIX += `import "${id}?astro&type=script&index=${i}&lang.ts";`;
            i++;
          }
          SUFFIX += `
if (import.meta.hot) {
						import.meta.hot.accept(mod => mod);
					}`;
        }
        if (isPage) {
          SUFFIX += `
import "${PAGE_SSR_SCRIPT_ID}";`;
        }
        const astroMetadata = {
          clientOnlyComponents: transformResult.clientOnlyComponents,
          hydratedComponents: transformResult.hydratedComponents,
          scripts: transformResult.scripts
        };
        return {
          code: `${code}${SUFFIX}`,
          map,
          meta: {
            astro: astroMetadata,
            vite: {
              lang: "ts"
            }
          }
        };
      } catch (err) {
        const scannedFrontmatter = FRONTMATTER_PARSE_REGEXP.exec(source);
        if (scannedFrontmatter) {
          try {
            await esbuild.transform(scannedFrontmatter[1], {
              loader: "ts",
              sourcemap: false,
              sourcefile: id
            });
          } catch (frontmatterErr) {
            if (frontmatterErr && frontmatterErr.message) {
              frontmatterErr.message = frontmatterErr.message.replace("end of file", "end of frontmatter");
            }
            throw frontmatterErr;
          }
        }
        if (err.stack.includes("wasm-function")) {
          const search = new URLSearchParams({
            labels: "compiler",
            title: "\u{1F41B} BUG: `@astrojs/compiler` panic",
            template: "---01-bug-report.yml",
            "bug-description": `\`@astrojs/compiler\` encountered an unrecoverable error when compiling the following file.

**${id.replace(fileURLToPath(config.root), "")}**
\`\`\`astro
${source}
\`\`\``
          });
          err.url = `https://github.com/withastro/astro/issues/new?${search.toString()}`;
          err.message = `Error: Uh oh, the Astro compiler encountered an unrecoverable error!

    Please open
    a GitHub issue using the link below:
    ${err.url}`;
          if (logging.level !== "debug") {
            err.stack = `    at ${id}`;
          }
        }
        throw err;
      }
    },
    async handleHotUpdate(context) {
      if (context.server.config.isProduction)
        return;
      return handleHotUpdate.call(this, context, config, logging);
    }
  };
}
export {
  astro as default
};
