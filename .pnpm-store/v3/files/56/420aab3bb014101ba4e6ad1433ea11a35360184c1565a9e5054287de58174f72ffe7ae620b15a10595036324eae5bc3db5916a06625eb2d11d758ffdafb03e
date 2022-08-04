import MagicString from "magic-string";
import { fileURLToPath } from "url";
import { loadEnv } from "vite";
function getPrivateEnv(viteConfig, astroConfig) {
  let envPrefixes = ["PUBLIC_"];
  if (viteConfig.envPrefix) {
    envPrefixes = Array.isArray(viteConfig.envPrefix) ? viteConfig.envPrefix : [viteConfig.envPrefix];
  }
  const fullEnv = loadEnv(viteConfig.mode, viteConfig.envDir ?? fileURLToPath(astroConfig.root), "");
  const privateKeys = Object.keys(fullEnv).filter((key) => {
    for (const envPrefix of envPrefixes) {
      if (key.startsWith(envPrefix))
        return false;
    }
    return true;
  });
  if (privateKeys.length === 0) {
    return null;
  }
  return Object.fromEntries(privateKeys.map((key) => {
    if (typeof process.env[key] !== "undefined")
      return [key, `process.env.${key}`];
    return [key, JSON.stringify(fullEnv[key])];
  }));
}
function getReferencedPrivateKeys(source, privateEnv) {
  const references = /* @__PURE__ */ new Set();
  for (const key of Object.keys(privateEnv)) {
    if (source.includes(key)) {
      references.add(key);
    }
  }
  return references;
}
function envVitePlugin({
  config: astroConfig
}) {
  let privateEnv;
  let config;
  let replacements;
  let pattern;
  return {
    name: "astro:vite-plugin-env",
    enforce: "pre",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async transform(source, id, options) {
      const ssr = (options == null ? void 0 : options.ssr) === true;
      if (!ssr) {
        return source;
      }
      if (!source.includes("import.meta") || !/\benv\b/.test(source)) {
        return source;
      }
      if (typeof privateEnv === "undefined") {
        privateEnv = getPrivateEnv(config, astroConfig);
        if (privateEnv) {
          privateEnv.SITE = astroConfig.site ? `'${astroConfig.site}'` : "undefined";
          privateEnv.SSR = JSON.stringify(true);
          const entries = Object.entries(privateEnv).map(([key, value]) => [
            `import.meta.env.${key}`,
            value
          ]);
          replacements = Object.fromEntries(entries);
          replacements = Object.assign(replacements, {
            "import.meta.env.SITE": astroConfig.site ? `'${astroConfig.site}'` : "undefined",
            "import.meta.env.SSR": JSON.stringify(true),
            "import.meta.env": `({})`
          });
          pattern = new RegExp("(?<!(?<!\\.\\.)\\.)\\b(" + Object.keys(replacements).map((str) => {
            return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
          }).join("|") + ")\\b(?!\\s*?=[^=])", "g");
        }
      }
      if (!privateEnv || !pattern)
        return source;
      const references = getReferencedPrivateKeys(source, privateEnv);
      if (references.size === 0)
        return source;
      const s = new MagicString(source);
      let match;
      while (match = pattern.exec(source)) {
        const start = match.index;
        const end = start + match[0].length;
        let replacement = "" + replacements[match[1]];
        if (match[0] === "import.meta.env") {
          replacement = `(Object.assign(import.meta.env,{`;
          for (const key of references.values()) {
            replacement += `${key}:${privateEnv[key]},`;
          }
          replacement += "}))";
        }
        s.overwrite(start, end, replacement);
      }
      return s.toString();
    }
  };
}
export {
  envVitePlugin as default
};
