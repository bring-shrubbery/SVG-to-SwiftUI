import { transform } from "@astrojs/compiler";
import { renderMarkdown } from "@astrojs/markdown-remark";
import ancestor from "common-ancestor-path";
import esbuild from "esbuild";
import fs from "fs";
import matter from "gray-matter";
import { fileURLToPath } from "url";
import { pagesVirtualModuleId } from "../core/app/index.js";
import { collectErrorMetadata } from "../core/errors.js";
import { prependForwardSlash } from "../core/path.js";
import { resolvePages, viteID } from "../core/util.js";
import { PAGE_SSR_SCRIPT_ID } from "../vite-plugin-scripts/index.js";
import { getFileInfo } from "../vite-plugin-utils/index.js";
const MARKDOWN_IMPORT_FLAG = "?mdImport";
const MARKDOWN_CONTENT_FLAG = "?content";
function safeMatter(source, id) {
  try {
    return matter(source);
  } catch (e) {
    e.id = id;
    throw collectErrorMetadata(e);
  }
}
function markdown({ config }) {
  function normalizeFilename(filename) {
    if (filename.startsWith("/@fs")) {
      filename = filename.slice("/@fs".length);
    } else if (filename.startsWith("/") && !ancestor(filename, config.root.pathname)) {
      filename = new URL("." + filename, config.root).pathname;
    }
    return filename;
  }
  const fakeRootImporter = fileURLToPath(new URL("index.html", config.root));
  function isRootImport(importer) {
    if (!importer) {
      return true;
    }
    if (importer === fakeRootImporter) {
      return true;
    }
    if (importer === "\0" + pagesVirtualModuleId) {
      return true;
    }
    return false;
  }
  return {
    name: "astro:markdown",
    enforce: "pre",
    async resolveId(id, importer, options) {
      if (id.endsWith(`.md${MARKDOWN_CONTENT_FLAG}`)) {
        const resolvedId = await this.resolve(id, importer, { skipSelf: true, ...options });
        return resolvedId == null ? void 0 : resolvedId.id.replace(MARKDOWN_CONTENT_FLAG, "");
      }
      if (id.endsWith(".md") && !isRootImport(importer)) {
        const resolvedId = await this.resolve(id, importer, { skipSelf: true, ...options });
        if (resolvedId) {
          return resolvedId.id + MARKDOWN_IMPORT_FLAG;
        }
      }
      return void 0;
    },
    async load(id) {
      if (id.endsWith(`.md${MARKDOWN_IMPORT_FLAG}`)) {
        const { fileId, fileUrl } = getFileInfo(id, config);
        const source = await fs.promises.readFile(fileId, "utf8");
        const { data: frontmatter, content: rawContent } = safeMatter(source, fileId);
        return {
          code: `
						// Static
						export const frontmatter = ${escapeViteEnvReferences(JSON.stringify(frontmatter))};
						export const file = ${JSON.stringify(fileId)};
						export const url = ${JSON.stringify(fileUrl)};
						export function rawContent() {
							return ${escapeViteEnvReferences(JSON.stringify(rawContent))};
						}
						export async function compiledContent() {
							return load().then((m) => m.compiledContent());
						}
						export function $$loadMetadata() {
							return load().then((m) => m.$$metadata);
						}
						
						// Deferred
						export default async function load() {
							return (await import(${JSON.stringify(fileId + MARKDOWN_CONTENT_FLAG)}));
						}
						export function Content(...args) {
							return load().then((m) => m.default(...args));
						}
						Content.isAstroComponentFactory = true;
						export function getHeaders() {
							return load().then((m) => m.metadata.headers);
						};`,
          map: null
        };
      }
      if (id.endsWith(".md")) {
        const filename = normalizeFilename(id);
        const source = await fs.promises.readFile(filename, "utf8");
        const renderOpts = config.markdown;
        const fileUrl = new URL(`file://${filename}`);
        const isPage = fileUrl.pathname.startsWith(resolvePages(config).pathname);
        const hasInjectedScript = isPage && config._ctx.scripts.some((s) => s.stage === "page-ssr");
        let { data: frontmatter, content: markdownContent } = safeMatter(source, filename);
        markdownContent = markdownContent.replace(/<\s*!--([^-->]*)(.*?)-->/gs, (whole) => `{/*${whole.replace(/\*\//g, "*\u200B/")}*/}`);
        let renderResult = await renderMarkdown(markdownContent, {
          ...renderOpts,
          fileURL: fileUrl
        });
        let { code: astroResult, metadata } = renderResult;
        const { layout = "", components = "", setup = "", ...content } = frontmatter;
        content.astro = metadata;
        const prelude = `---
import { slug as $$slug } from '@astrojs/markdown-remark/ssr-utils';
${layout ? `import Layout from '${layout}';` : ""}
${components ? `import * from '${components}';` : ""}
${hasInjectedScript ? `import '${PAGE_SSR_SCRIPT_ID}';` : ""}
${setup}

const $$content = ${JSON.stringify(content)}
---`;
        const imports = `${layout ? `import Layout from '${layout}';` : ""}
${setup}`.trim();
        if (/\bLayout\b/.test(imports)) {
          astroResult = `${prelude}
<Layout content={$$content}>

${astroResult}

</Layout>`;
        } else {
          astroResult = `${prelude}
${astroResult}`;
        }
        let transformResult = await transform(astroResult, {
          pathname: "/@fs" + prependForwardSlash(fileUrl.pathname),
          projectRoot: config.root.toString(),
          site: config.site ? new URL(config.base, config.site).toString() : `http://localhost:${config.server.port}/`,
          sourcefile: id,
          sourcemap: "inline",
          experimentalStaticExtraction: true,
          internalURL: `/@fs${prependForwardSlash(viteID(new URL("../runtime/server/index.js", import.meta.url)))}`
        });
        let { code: tsResult } = transformResult;
        tsResult = `
export const metadata = ${JSON.stringify(metadata)};
export const frontmatter = ${JSON.stringify(content)};
export function rawContent() {
	return ${JSON.stringify(markdownContent)};
}
export function compiledContent() {
		return ${JSON.stringify(renderResult.metadata.html)};
}
${tsResult}`;
        const { code } = await esbuild.transform(tsResult, {
          loader: "ts",
          sourcemap: false,
          sourcefile: id
        });
        const astroMetadata = {
          clientOnlyComponents: transformResult.clientOnlyComponents,
          hydratedComponents: transformResult.hydratedComponents,
          scripts: transformResult.scripts
        };
        return {
          code: escapeViteEnvReferences(code),
          map: null,
          meta: {
            astro: astroMetadata,
            vite: {
              lang: "ts"
            }
          }
        };
      }
      return null;
    }
  };
}
function escapeViteEnvReferences(code) {
  return code.replace(/import\.meta\.env/g, "import\\u002Emeta.env");
}
export {
  markdown as default
};
