import glob from "fast-glob";
import fs from "fs";
import { bgGreen, bgMagenta, black, dim } from "kleur/colors";
import { fileURLToPath } from "url";
import * as vite from "vite";
import { createBuildInternals } from "../../core/build/internal.js";
import { prependForwardSlash } from "../../core/path.js";
import { emptyDir, removeDir } from "../../core/util.js";
import { runHookBuildSetup } from "../../integrations/index.js";
import { rollupPluginAstroBuildCSS } from "../../vite-plugin-build-css/index.js";
import { info } from "../logger/core.js";
import { isBuildingToSSR } from "../util.js";
import { generatePages } from "./generate.js";
import { trackPageData } from "./internal.js";
import { getTimeStat } from "./util.js";
import { vitePluginAnalyzer } from "./vite-plugin-analyzer.js";
import { vitePluginHoistedScripts } from "./vite-plugin-hoisted-scripts.js";
import { vitePluginInternals } from "./vite-plugin-internals.js";
import { vitePluginPages } from "./vite-plugin-pages.js";
import { injectManifest, vitePluginSSR } from "./vite-plugin-ssr.js";
async function staticBuild(opts) {
  const { allPages, astroConfig } = opts;
  const pageInput = /* @__PURE__ */ new Set();
  const facadeIdToPageDataMap = /* @__PURE__ */ new Map();
  const internals = createBuildInternals();
  const timer = {};
  timer.buildStart = performance.now();
  for (const [component, pageData] of Object.entries(allPages)) {
    const astroModuleURL = new URL("./" + component, astroConfig.root);
    const astroModuleId = prependForwardSlash(component);
    trackPageData(internals, component, pageData, astroModuleId, astroModuleURL);
    pageInput.add(astroModuleId);
    facadeIdToPageDataMap.set(fileURLToPath(astroModuleURL), pageData);
  }
  emptyDir(astroConfig.outDir, new Set(".git"));
  timer.ssr = performance.now();
  info(opts.logging, "build", isBuildingToSSR(astroConfig) ? "Building SSR entrypoints..." : "Building entrypoints for prerendering...");
  const ssrResult = await ssrBuild(opts, internals, pageInput);
  info(opts.logging, "build", dim(`Completed in ${getTimeStat(timer.ssr, performance.now())}.`));
  const clientInput = /* @__PURE__ */ new Set([
    ...internals.discoveredHydratedComponents,
    ...internals.discoveredClientOnlyComponents,
    ...astroConfig._ctx.renderers.map((r) => r.clientEntrypoint).filter((a) => a),
    ...internals.discoveredScripts
  ]);
  timer.clientBuild = performance.now();
  await clientBuild(opts, internals, clientInput);
  timer.generate = performance.now();
  if (opts.buildConfig.staticMode) {
    try {
      await generatePages(ssrResult, opts, internals, facadeIdToPageDataMap);
    } finally {
      await cleanSsrOutput(opts);
    }
  } else {
    await injectManifest(opts, internals);
    info(opts.logging, null, `
${bgMagenta(black(" finalizing server assets "))}
`);
    await ssrMoveAssets(opts);
  }
}
async function ssrBuild(opts, internals, input) {
  var _a, _b, _c, _d;
  const { astroConfig, viteConfig } = opts;
  const ssr = isBuildingToSSR(astroConfig);
  const out = ssr ? opts.buildConfig.server : astroConfig.outDir;
  const viteBuildConfig = {
    logLevel: opts.viteConfig.logLevel ?? "error",
    mode: "production",
    css: viteConfig.css,
    optimizeDeps: {
      include: [...((_a = viteConfig.optimizeDeps) == null ? void 0 : _a.include) ?? []],
      exclude: [...((_b = viteConfig.optimizeDeps) == null ? void 0 : _b.exclude) ?? []]
    },
    build: {
      ...viteConfig.build,
      emptyOutDir: false,
      manifest: false,
      outDir: fileURLToPath(out),
      rollupOptions: {
        input: [],
        output: {
          format: "esm",
          chunkFileNames: "chunks/[name].[hash].mjs",
          assetFileNames: "assets/[name].[hash][extname]",
          ...(_d = (_c = viteConfig.build) == null ? void 0 : _c.rollupOptions) == null ? void 0 : _d.output,
          entryFileNames: opts.buildConfig.serverEntry
        }
      },
      ssr: true,
      target: "esnext",
      minify: false,
      polyfillModulePreload: false,
      reportCompressedSize: false
    },
    plugins: [
      vitePluginInternals(input, internals),
      vitePluginPages(opts, internals),
      rollupPluginAstroBuildCSS({
        internals,
        target: "server"
      }),
      ...viteConfig.plugins || [],
      isBuildingToSSR(opts.astroConfig) && vitePluginSSR(opts, internals, opts.astroConfig._ctx.adapter),
      vitePluginAnalyzer(opts.astroConfig, internals)
    ],
    publicDir: ssr ? false : viteConfig.publicDir,
    root: viteConfig.root,
    envPrefix: "PUBLIC_",
    server: viteConfig.server,
    base: astroConfig.base,
    ssr: viteConfig.ssr,
    resolve: viteConfig.resolve
  };
  await runHookBuildSetup({
    config: astroConfig,
    pages: internals.pagesByComponent,
    vite: viteBuildConfig,
    target: "server"
  });
  return await vite.build(viteBuildConfig);
}
async function clientBuild(opts, internals, input) {
  var _a, _b, _c, _d;
  const { astroConfig, viteConfig } = opts;
  const timer = performance.now();
  const ssr = isBuildingToSSR(astroConfig);
  const out = ssr ? opts.buildConfig.client : astroConfig.outDir;
  if (!input.size) {
    if (ssr) {
      await copyFiles(astroConfig.publicDir, out);
    }
    return null;
  }
  info(opts.logging, null, `
${bgGreen(black(" building client "))}`);
  const viteBuildConfig = {
    logLevel: "info",
    mode: "production",
    css: viteConfig.css,
    optimizeDeps: {
      include: [...((_a = viteConfig.optimizeDeps) == null ? void 0 : _a.include) ?? []],
      exclude: [...((_b = viteConfig.optimizeDeps) == null ? void 0 : _b.exclude) ?? []]
    },
    build: {
      emptyOutDir: false,
      minify: "esbuild",
      outDir: fileURLToPath(out),
      rollupOptions: {
        input: Array.from(input),
        output: {
          format: "esm",
          entryFileNames: "[name].[hash].js",
          chunkFileNames: "chunks/[name].[hash].js",
          assetFileNames: "assets/[name].[hash][extname]",
          ...(_d = (_c = viteConfig.build) == null ? void 0 : _c.rollupOptions) == null ? void 0 : _d.output
        },
        preserveEntrySignatures: "exports-only"
      },
      target: "esnext"
    },
    plugins: [
      vitePluginInternals(input, internals),
      vitePluginHoistedScripts(astroConfig, internals),
      rollupPluginAstroBuildCSS({
        internals,
        target: "client"
      }),
      ...viteConfig.plugins || []
    ],
    publicDir: viteConfig.publicDir,
    root: viteConfig.root,
    envPrefix: "PUBLIC_",
    server: viteConfig.server,
    base: astroConfig.base
  };
  await runHookBuildSetup({
    config: astroConfig,
    pages: internals.pagesByComponent,
    vite: viteBuildConfig,
    target: "client"
  });
  const buildResult = await vite.build(viteBuildConfig);
  info(opts.logging, null, dim(`Completed in ${getTimeStat(timer, performance.now())}.
`));
  return buildResult;
}
async function cleanSsrOutput(opts) {
  const files = await glob("**/*.mjs", {
    cwd: fileURLToPath(opts.astroConfig.outDir)
  });
  await Promise.all(files.map(async (filename) => {
    const url = new URL(filename, opts.astroConfig.outDir);
    await fs.promises.rm(url);
  }));
}
async function copyFiles(fromFolder, toFolder) {
  const files = await glob("**/*", {
    cwd: fileURLToPath(fromFolder)
  });
  await Promise.all(files.map(async (filename) => {
    const from = new URL(filename, fromFolder);
    const to = new URL(filename, toFolder);
    const lastFolder = new URL("./", to);
    return fs.promises.mkdir(lastFolder, { recursive: true }).then(() => fs.promises.copyFile(from, to));
  }));
}
async function ssrMoveAssets(opts) {
  info(opts.logging, "build", "Rearranging server assets...");
  const serverRoot = opts.buildConfig.staticMode ? opts.buildConfig.client : opts.buildConfig.server;
  const clientRoot = opts.buildConfig.client;
  const serverAssets = new URL("./assets/", serverRoot);
  const clientAssets = new URL("./assets/", clientRoot);
  const files = await glob("assets/**/*", {
    cwd: fileURLToPath(serverRoot)
  });
  await fs.promises.mkdir(clientAssets, { recursive: true });
  await Promise.all(files.map(async (filename) => {
    const currentUrl = new URL(filename, serverRoot);
    const clientUrl = new URL(filename, clientRoot);
    return fs.promises.rename(currentUrl, clientUrl);
  }));
  removeDir(serverAssets);
}
export {
  staticBuild
};
