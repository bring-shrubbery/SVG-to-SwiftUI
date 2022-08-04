import fs from "fs";
import { bgGreen, black, cyan, dim, green, magenta } from "kleur/colors";
import npath from "path";
import { fileURLToPath } from "url";
import { joinPaths, prependForwardSlash, removeLeadingForwardSlash } from "../../core/path.js";
import { BEFORE_HYDRATION_SCRIPT_ID } from "../../vite-plugin-scripts/index.js";
import { call as callEndpoint } from "../endpoint/index.js";
import { debug, info } from "../logger/core.js";
import { render } from "../render/core.js";
import { createLinkStylesheetElementSet, createModuleScriptsSet } from "../render/ssr-element.js";
import { createRequest } from "../request.js";
import { getOutputFilename, isBuildingToSSR } from "../util.js";
import { getOutFile, getOutFolder } from "./common.js";
import { eachPageData, getPageDataByComponent } from "./internal.js";
import { getTimeStat } from "./util.js";
const MAX_CONCURRENT_RENDERS = 1;
function* throttle(max, inPaths) {
  let tmp = [];
  let i = 0;
  for (let path of inPaths) {
    tmp.push(path);
    if (i === max) {
      yield tmp;
      tmp.length = 0;
      i = 0;
    } else {
      i++;
    }
  }
  if (tmp.length) {
    yield tmp;
  }
}
function shouldSkipDraft(pageModule, astroConfig) {
  return !astroConfig.markdown.drafts && "frontmatter" in pageModule && pageModule.frontmatter.draft === true;
}
function rootRelativeFacadeId(facadeId, astroConfig) {
  return facadeId.slice(fileURLToPath(astroConfig.root).length);
}
function chunkIsPage(astroConfig, output, internals) {
  if (output.type !== "chunk") {
    return false;
  }
  const chunk = output;
  if (chunk.facadeModuleId) {
    const facadeToEntryId = prependForwardSlash(rootRelativeFacadeId(chunk.facadeModuleId, astroConfig));
    return internals.entrySpecifierToBundleMap.has(facadeToEntryId);
  }
  return false;
}
async function generatePages(result, opts, internals, facadeIdToPageDataMap) {
  const timer = performance.now();
  info(opts.logging, null, `
${bgGreen(black(" generating static routes "))}`);
  const ssr = isBuildingToSSR(opts.astroConfig);
  const serverEntry = opts.buildConfig.serverEntry;
  const outFolder = ssr ? opts.buildConfig.server : opts.astroConfig.outDir;
  const ssrEntryURL = new URL("./" + serverEntry + `?time=${Date.now()}`, outFolder);
  const ssrEntry = await import(ssrEntryURL.toString());
  for (const pageData of eachPageData(internals)) {
    await generatePage(opts, internals, pageData, ssrEntry);
  }
  info(opts.logging, null, dim(`Completed in ${getTimeStat(timer, performance.now())}.
`));
}
async function generatePage(opts, internals, pageData, ssrEntry) {
  let timeStart = performance.now();
  const renderers = ssrEntry.renderers;
  const pageInfo = getPageDataByComponent(internals, pageData.route.component);
  const linkIds = Array.from((pageInfo == null ? void 0 : pageInfo.css) ?? []);
  const scripts = (pageInfo == null ? void 0 : pageInfo.hoistedScript) ?? null;
  const pageModule = ssrEntry.pageMap.get(pageData.component);
  if (!pageModule) {
    throw new Error(`Unable to find the module for ${pageData.component}. This is unexpected and likely a bug in Astro, please report.`);
  }
  if (shouldSkipDraft(pageModule, opts.astroConfig)) {
    info(opts.logging, null, `${magenta("\u26A0\uFE0F")}  Skipping draft ${pageData.route.component}`);
    return;
  }
  const generationOptions = {
    pageData,
    internals,
    linkIds,
    scripts,
    mod: pageModule,
    renderers
  };
  const icon = pageData.route.type === "page" ? green("\u25B6") : magenta("\u03BB");
  info(opts.logging, null, `${icon} ${pageData.route.component}`);
  for (let i = 0; i < pageData.paths.length; i++) {
    const path = pageData.paths[i];
    await generatePath(path, opts, generationOptions);
    const timeEnd = performance.now();
    const timeChange = getTimeStat(timeStart, timeEnd);
    const timeIncrease = `(+${timeChange})`;
    const filePath = getOutputFilename(opts.astroConfig, path);
    const lineIcon = i === pageData.paths.length - 1 ? "\u2514\u2500" : "\u251C\u2500";
    info(opts.logging, null, `  ${cyan(lineIcon)} ${dim(filePath)} ${dim(timeIncrease)}`);
  }
}
function addPageName(pathname, opts) {
  opts.pageNames.push(pathname.replace(/\/?$/, "/").replace(/^\//, ""));
}
async function generatePath(pathname, opts, gopts) {
  var _a;
  const { astroConfig, logging, origin, routeCache } = opts;
  const { mod, internals, linkIds, scripts: hoistedScripts, pageData, renderers } = gopts;
  if (pageData.route.type === "page") {
    addPageName(pathname, opts);
  }
  debug("build", `Generating: ${pathname}`);
  const site = astroConfig.base !== "/" ? joinPaths(((_a = astroConfig.site) == null ? void 0 : _a.toString()) || "http://localhost/", astroConfig.base) : astroConfig.site;
  const links = createLinkStylesheetElementSet(linkIds.reverse(), site);
  const scripts = createModuleScriptsSet(hoistedScripts ? [hoistedScripts] : [], site);
  for (const script of astroConfig._ctx.scripts) {
    if (script.stage === "head-inline") {
      scripts.add({
        props: {},
        children: script.content
      });
    }
  }
  const ssr = isBuildingToSSR(opts.astroConfig);
  const url = new URL(opts.astroConfig.base + removeLeadingForwardSlash(pathname), origin);
  const options = {
    links,
    logging,
    markdown: astroConfig.markdown,
    mod,
    origin,
    pathname,
    scripts,
    renderers,
    async resolve(specifier) {
      const hashedFilePath = internals.entrySpecifierToBundleMap.get(specifier);
      if (typeof hashedFilePath !== "string") {
        if (specifier === BEFORE_HYDRATION_SCRIPT_ID) {
          return "data:text/javascript;charset=utf-8,//[no before-hydration script]";
        }
        throw new Error(`Cannot find the built path for ${specifier}`);
      }
      return prependForwardSlash(npath.posix.join(astroConfig.base, hashedFilePath));
    },
    request: createRequest({ url, headers: new Headers(), logging, ssr }),
    route: pageData.route,
    routeCache,
    site: astroConfig.site ? new URL(astroConfig.base, astroConfig.site).toString() : astroConfig.site,
    ssr,
    streaming: true
  };
  let body;
  if (pageData.route.type === "endpoint") {
    const result = await callEndpoint(mod, options);
    if (result.type === "response") {
      throw new Error(`Returning a Response from an endpoint is not supported in SSG mode.`);
    }
    body = result.body;
  } else {
    const response = await render(options);
    if (response.status !== 200 || !response.body) {
      return;
    }
    body = await response.text();
  }
  const outFolder = getOutFolder(astroConfig, pathname, pageData.route.type);
  const outFile = getOutFile(astroConfig, outFolder, pathname, pageData.route.type);
  pageData.route.distURL = outFile;
  await fs.promises.mkdir(outFolder, { recursive: true });
  await fs.promises.writeFile(outFile, body, "utf-8");
}
export {
  chunkIsPage,
  generatePages,
  rootRelativeFacadeId
};
