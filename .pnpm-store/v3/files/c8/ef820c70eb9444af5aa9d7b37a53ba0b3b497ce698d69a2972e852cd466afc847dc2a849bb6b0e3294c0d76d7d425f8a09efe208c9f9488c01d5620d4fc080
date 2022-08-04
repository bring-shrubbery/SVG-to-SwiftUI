import load, { ProloadError, resolve } from "@proload/core";
import loadTypeScript from "@proload/plugin-tsm";
import * as colors from "kleur/colors";
import path from "path";
import postcssrc from "postcss-load-config";
import { BUNDLED_THEMES } from "shiki";
import { fileURLToPath, pathToFileURL } from "url";
import { mergeConfig as mergeViteConfig } from "vite";
import { z } from "zod";
import { appendForwardSlash, prependForwardSlash, trimSlashes } from "./path.js";
import { arraify, isObject } from "./util.js";
load.use([loadTypeScript]);
const ASTRO_CONFIG_DEFAULTS = {
  root: ".",
  srcDir: "./src",
  publicDir: "./public",
  outDir: "./dist",
  base: "/",
  trailingSlash: "ignore",
  build: { format: "directory" },
  server: {
    host: false,
    port: 3e3,
    streaming: true
  },
  style: { postcss: { options: {}, plugins: [] } },
  integrations: [],
  markdown: {
    drafts: false,
    syntaxHighlight: "shiki",
    shikiConfig: {
      langs: [],
      theme: "github-dark",
      wrap: false
    },
    remarkPlugins: [],
    rehypePlugins: []
  },
  vite: {},
  experimental: {
    ssr: false,
    integrations: false
  }
};
async function resolvePostcssConfig(inlineOptions, root) {
  if (isObject(inlineOptions)) {
    const options = { ...inlineOptions };
    delete options.plugins;
    return {
      options,
      plugins: inlineOptions.plugins || []
    };
  }
  const searchPath = typeof inlineOptions === "string" ? inlineOptions : fileURLToPath(root);
  try {
    return await postcssrc({}, searchPath);
  } catch (err) {
    if (!/No PostCSS Config found/.test(err.message)) {
      throw err;
    }
    return {
      options: {},
      plugins: []
    };
  }
}
const LEGACY_ASTRO_CONFIG_KEYS = /* @__PURE__ */ new Set([
  "projectRoot",
  "src",
  "pages",
  "public",
  "dist",
  "styleOptions",
  "markdownOptions",
  "buildOptions",
  "devOptions",
  "experimentalIntegrations"
]);
const AstroConfigSchema = z.object({
  adapter: z.object({ name: z.string(), hooks: z.object({}).passthrough().default({}) }).optional(),
  root: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.root).transform((val) => new URL(val)),
  srcDir: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.srcDir).transform((val) => new URL(val)),
  publicDir: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.publicDir).transform((val) => new URL(val)),
  outDir: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.outDir).transform((val) => new URL(val)),
  site: z.string().url().optional().transform((val) => val ? appendForwardSlash(val) : val).refine((val) => !val || new URL(val).pathname.length <= 1, {
    message: '"site" must be a valid URL origin (ex: "https://example.com") but cannot contain a URL path (ex: "https://example.com/blog"). Use "base" to configure your deployed URL path'
  }),
  base: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.base).transform((val) => prependForwardSlash(appendForwardSlash(trimSlashes(val)))),
  trailingSlash: z.union([z.literal("always"), z.literal("never"), z.literal("ignore")]).optional().default(ASTRO_CONFIG_DEFAULTS.trailingSlash),
  build: z.object({
    format: z.union([z.literal("file"), z.literal("directory")]).optional().default(ASTRO_CONFIG_DEFAULTS.build.format)
  }).optional().default({}),
  server: z.preprocess((val) => typeof val === "function" ? val({ command: "error" }) : val, z.object({
    host: z.union([z.string(), z.boolean()]).optional().default(ASTRO_CONFIG_DEFAULTS.server.host),
    port: z.number().optional().default(ASTRO_CONFIG_DEFAULTS.server.port)
  }).optional().default({})),
  integrations: z.preprocess((val) => Array.isArray(val) ? val.flat(Infinity).filter(Boolean) : val, z.array(z.object({ name: z.string(), hooks: z.object({}).passthrough().default({}) })).default(ASTRO_CONFIG_DEFAULTS.integrations)),
  style: z.object({
    postcss: z.object({
      options: z.any(),
      plugins: z.array(z.any())
    }).optional().default(ASTRO_CONFIG_DEFAULTS.style.postcss)
  }).optional().default({}),
  markdown: z.object({
    mode: z.enum(["md", "mdx"]).default("mdx"),
    drafts: z.boolean().default(false),
    syntaxHighlight: z.union([z.literal("shiki"), z.literal("prism"), z.literal(false)]).default(ASTRO_CONFIG_DEFAULTS.markdown.syntaxHighlight),
    shikiConfig: z.object({
      langs: z.custom().array().default([]),
      theme: z.enum(BUNDLED_THEMES).or(z.custom()).default(ASTRO_CONFIG_DEFAULTS.markdown.shikiConfig.theme),
      wrap: z.boolean().or(z.null()).default(ASTRO_CONFIG_DEFAULTS.markdown.shikiConfig.wrap)
    }).default({}),
    remarkPlugins: z.union([
      z.string(),
      z.tuple([z.string(), z.any()]),
      z.custom((data) => typeof data === "function"),
      z.tuple([z.custom((data) => typeof data === "function"), z.any()])
    ]).array().default(ASTRO_CONFIG_DEFAULTS.markdown.remarkPlugins),
    rehypePlugins: z.union([
      z.string(),
      z.tuple([z.string(), z.any()]),
      z.custom((data) => typeof data === "function"),
      z.tuple([z.custom((data) => typeof data === "function"), z.any()])
    ]).array().default(ASTRO_CONFIG_DEFAULTS.markdown.rehypePlugins)
  }).default({}),
  vite: z.custom((data) => data instanceof Object && !Array.isArray(data)).default(ASTRO_CONFIG_DEFAULTS.vite),
  experimental: z.object({
    ssr: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.experimental.ssr),
    integrations: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.experimental.integrations)
  }).optional().default({})
});
async function validateConfig(userConfig, root, cmd) {
  var _a;
  const fileProtocolRoot = pathToFileURL(root + path.sep);
  if (userConfig.hasOwnProperty("renderers")) {
    console.error('Astro "renderers" are now "integrations"!');
    console.error("Update your configuration and install new dependencies:");
    try {
      const rendererKeywords = userConfig.renderers.map((r) => r.replace("@astrojs/renderer-", ""));
      const rendererImports = rendererKeywords.map((r) => `  import ${r} from '@astrojs/${r === "solid" ? "solid-js" : r}';`).join("\n");
      const rendererIntegrations = rendererKeywords.map((r) => `    ${r}(),`).join("\n");
      console.error("");
      console.error(colors.dim("  // astro.config.js"));
      if (rendererImports.length > 0) {
        console.error(colors.green(rendererImports));
      }
      console.error("");
      console.error(colors.dim("  // ..."));
      if (rendererIntegrations.length > 0) {
        console.error(colors.green("  integrations: ["));
        console.error(colors.green(rendererIntegrations));
        console.error(colors.green("  ],"));
      } else {
        console.error(colors.green("  integrations: [],"));
      }
      console.error("");
    } catch (err) {
    }
    process.exit(1);
  }
  let legacyConfigKey;
  for (const key of Object.keys(userConfig)) {
    if (LEGACY_ASTRO_CONFIG_KEYS.has(key)) {
      legacyConfigKey = key;
      break;
    }
  }
  if (legacyConfigKey) {
    throw new Error(`Legacy configuration detected: "${legacyConfigKey}".
Please update your configuration to the new format!
See https://astro.build/config for more information.`);
  }
  const AstroConfigRelativeSchema = AstroConfigSchema.extend({
    root: z.string().default(ASTRO_CONFIG_DEFAULTS.root).transform((val) => new URL(appendForwardSlash(val), fileProtocolRoot)),
    srcDir: z.string().default(ASTRO_CONFIG_DEFAULTS.srcDir).transform((val) => new URL(appendForwardSlash(val), fileProtocolRoot)),
    publicDir: z.string().default(ASTRO_CONFIG_DEFAULTS.publicDir).transform((val) => new URL(appendForwardSlash(val), fileProtocolRoot)),
    outDir: z.string().default(ASTRO_CONFIG_DEFAULTS.outDir).transform((val) => new URL(appendForwardSlash(val), fileProtocolRoot)),
    server: z.preprocess((val) => typeof val === "function" ? val({ command: cmd === "dev" ? "dev" : "preview" }) : val, z.object({
      host: z.union([z.string(), z.boolean()]).optional().default(ASTRO_CONFIG_DEFAULTS.server.host),
      port: z.number().optional().default(ASTRO_CONFIG_DEFAULTS.server.port),
      streaming: z.boolean().optional().default(true)
    }).optional().default({})),
    style: z.object({
      postcss: z.preprocess((val) => resolvePostcssConfig(val, fileProtocolRoot), z.object({
        options: z.any(),
        plugins: z.array(z.any())
      }).optional().default(ASTRO_CONFIG_DEFAULTS.style.postcss))
    }).optional().default({})
  });
  const result = {
    ...await AstroConfigRelativeSchema.parseAsync(userConfig),
    _ctx: {
      pageExtensions: [".astro", ".md"],
      scripts: [],
      renderers: [],
      injectedRoutes: [],
      adapter: void 0
    }
  };
  if (result.integrations.find((integration) => integration.name === "@astrojs/mdx")) {
    const { default: jsxRenderer } = await import("../jsx/renderer.js");
    result._ctx.renderers.unshift(jsxRenderer);
  }
  if (!((_a = result.experimental) == null ? void 0 : _a.integrations) && !result.integrations.every((int) => int.name.startsWith("@astrojs/"))) {
    throw new Error([
      `Astro integrations are still experimental.`,
      ``,
      `Only official "@astrojs/*" integrations are currently supported.`,
      `To enable 3rd-party integrations, use the "--experimental-integrations" flag.`,
      `Breaking changes may occur in this API before Astro v1.0 is released.`,
      ``
    ].join("\n"));
  }
  return result;
}
function resolveFlags(flags) {
  return {
    root: typeof flags.root === "string" ? flags.root : void 0,
    site: typeof flags.site === "string" ? flags.site : void 0,
    port: typeof flags.port === "number" ? flags.port : void 0,
    config: typeof flags.config === "string" ? flags.config : void 0,
    host: typeof flags.host === "string" || typeof flags.host === "boolean" ? flags.host : void 0,
    experimentalSsr: typeof flags.experimentalSsr === "boolean" ? flags.experimentalSsr : void 0,
    experimentalIntegrations: typeof flags.experimentalIntegrations === "boolean" ? flags.experimentalIntegrations : void 0,
    drafts: typeof flags.drafts === "boolean" ? flags.drafts : false
  };
}
function mergeCLIFlags(astroConfig, flags, cmd) {
  astroConfig.server = astroConfig.server || {};
  astroConfig.experimental = astroConfig.experimental || {};
  astroConfig.markdown = astroConfig.markdown || {};
  if (typeof flags.site === "string")
    astroConfig.site = flags.site;
  if (typeof flags.experimentalSsr === "boolean")
    astroConfig.experimental.ssr = flags.experimentalSsr;
  if (typeof flags.experimentalIntegrations === "boolean")
    astroConfig.experimental.integrations = flags.experimentalIntegrations;
  if (typeof flags.drafts === "boolean")
    astroConfig.markdown.drafts = flags.drafts;
  if (typeof flags.port === "number") {
    astroConfig.server.port = flags.port;
  }
  if (typeof flags.host === "string" || typeof flags.host === "boolean") {
    astroConfig.server.host = flags.host;
  }
  return astroConfig;
}
async function resolveConfigURL(configOptions) {
  const root = configOptions.cwd ? path.resolve(configOptions.cwd) : process.cwd();
  const flags = resolveFlags(configOptions.flags || {});
  let userConfigPath;
  if (flags == null ? void 0 : flags.config) {
    userConfigPath = /^\.*\//.test(flags.config) ? flags.config : `./${flags.config}`;
    userConfigPath = fileURLToPath(new URL(userConfigPath, `file://${root}/`));
  }
  const configPath = await resolve("astro", {
    mustExist: false,
    cwd: root,
    filePath: userConfigPath
  });
  if (configPath) {
    return pathToFileURL(configPath);
  }
}
async function openConfig(configOptions) {
  const root = configOptions.cwd ? path.resolve(configOptions.cwd) : process.cwd();
  const flags = resolveFlags(configOptions.flags || {});
  let userConfig = {};
  let userConfigPath;
  if (flags == null ? void 0 : flags.config) {
    userConfigPath = /^\.*\//.test(flags.config) ? flags.config : `./${flags.config}`;
    userConfigPath = fileURLToPath(new URL(userConfigPath, appendForwardSlash(pathToFileURL(root).toString())));
  }
  let config;
  try {
    config = await load("astro", {
      mustExist: !!userConfigPath,
      cwd: root,
      filePath: userConfigPath
    });
  } catch (err) {
    if (err instanceof ProloadError && flags.config) {
      throw new Error(`Unable to resolve --config "${flags.config}"! Does the file exist?`);
    }
    throw err;
  }
  if (config) {
    userConfig = config.value;
  }
  const astroConfig = await resolveConfig(userConfig, root, flags, configOptions.cmd);
  return {
    astroConfig,
    userConfig,
    flags,
    root
  };
}
async function loadConfig(configOptions) {
  const root = configOptions.cwd ? path.resolve(configOptions.cwd) : process.cwd();
  const flags = resolveFlags(configOptions.flags || {});
  let userConfig = {};
  let userConfigPath;
  if (flags == null ? void 0 : flags.config) {
    userConfigPath = /^\.*\//.test(flags.config) ? flags.config : `./${flags.config}`;
    userConfigPath = fileURLToPath(new URL(userConfigPath, appendForwardSlash(pathToFileURL(root).toString())));
  }
  let config;
  try {
    config = await load("astro", {
      mustExist: !!userConfigPath,
      cwd: root,
      filePath: userConfigPath
    });
  } catch (err) {
    if (err instanceof ProloadError && flags.config) {
      throw new Error(`Unable to resolve --config "${flags.config}"! Does the file exist?`);
    }
    throw err;
  }
  if (config) {
    userConfig = config.value;
  }
  return resolveConfig(userConfig, root, flags, configOptions.cmd);
}
async function resolveConfig(userConfig, root, flags = {}, cmd) {
  const mergedConfig = mergeCLIFlags(userConfig, flags, cmd);
  const validatedConfig = await validateConfig(mergedConfig, root, cmd);
  return validatedConfig;
}
function mergeConfigRecursively(defaults, overrides, rootPath) {
  const merged = { ...defaults };
  for (const key in overrides) {
    const value = overrides[key];
    if (value == null) {
      continue;
    }
    const existing = merged[key];
    if (existing == null) {
      merged[key] = value;
      continue;
    }
    if (key === "vite" && rootPath === "") {
      merged[key] = mergeViteConfig(existing, value);
      continue;
    }
    if (Array.isArray(existing) || Array.isArray(value)) {
      merged[key] = [...arraify(existing ?? []), ...arraify(value ?? [])];
      continue;
    }
    if (isObject(existing) && isObject(value)) {
      merged[key] = mergeConfigRecursively(existing, value, rootPath ? `${rootPath}.${key}` : key);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}
function mergeConfig(defaults, overrides, isRoot = true) {
  return mergeConfigRecursively(defaults, overrides, isRoot ? "" : ".");
}
export {
  AstroConfigSchema,
  LEGACY_ASTRO_CONFIG_KEYS,
  loadConfig,
  mergeConfig,
  openConfig,
  resolveConfig,
  resolveConfigURL,
  validateConfig
};
