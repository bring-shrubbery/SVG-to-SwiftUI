import babel from "@babel/core";
import * as eslexer from "es-module-lexer";
import esbuild from "esbuild";
import * as colors from "kleur/colors";
import path from "path";
import { error } from "../core/logger/core.js";
import { parseNpmName } from "../core/util.js";
const JSX_RENDERER_CACHE = /* @__PURE__ */ new WeakMap();
const JSX_EXTENSIONS = /* @__PURE__ */ new Set([".jsx", ".tsx", ".mdx"]);
const IMPORT_STATEMENTS = {
  react: "import React from 'react'",
  preact: "import { h } from 'preact'",
  "solid-js": "import 'solid-js'",
  astro: "import 'astro/jsx-runtime'"
};
const PREVENT_UNUSED_IMPORTS = ";;(React,Fragment,h);";
function getEsbuildLoader(fileExt) {
  if (fileExt === ".mdx")
    return "jsx";
  return fileExt.slice(1);
}
function collectJSXRenderers(renderers) {
  const renderersWithJSXSupport = renderers.filter((r) => r.jsxImportSource);
  return new Map(renderersWithJSXSupport.map((r) => [r.jsxImportSource, r]));
}
async function transformJSX({
  code,
  mode,
  id,
  ssr,
  renderer
}) {
  const { jsxTransformOptions } = renderer;
  const options = await jsxTransformOptions({ mode, ssr });
  const plugins = [...options.plugins || []];
  const result = await babel.transformAsync(code, {
    presets: options.presets,
    plugins,
    cwd: process.cwd(),
    filename: id,
    ast: false,
    compact: false,
    sourceMaps: true,
    configFile: false,
    babelrc: false,
    inputSourceMap: options.inputSourceMap
  });
  if (!result)
    return null;
  return {
    code: result.code || "",
    map: result.map
  };
}
function jsx({ config, logging }) {
  let viteConfig;
  return {
    name: "astro:jsx",
    enforce: "pre",
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },
    async transform(code, id, opts) {
      const ssr = Boolean(opts == null ? void 0 : opts.ssr);
      if (!JSX_EXTENSIONS.has(path.extname(id))) {
        return null;
      }
      const { mode } = viteConfig;
      let jsxRenderers = JSX_RENDERER_CACHE.get(config);
      if (!jsxRenderers) {
        jsxRenderers = /* @__PURE__ */ new Map();
        const possibleRenderers = await collectJSXRenderers(config._ctx.renderers);
        if (possibleRenderers.size === 0) {
          throw new Error(`${colors.yellow(id)}
Unable to resolve a JSX renderer! Did you forget to include one? Add a JSX integration like \`@astrojs/react\` to your \`astro.config.mjs\` file.`);
        }
        for (const [importSource2, renderer] of possibleRenderers) {
          jsxRenderers.set(importSource2, renderer);
        }
        JSX_RENDERER_CACHE.set(config, jsxRenderers);
      }
      if (jsxRenderers.size === 1) {
        const { code: jsxCode } = await esbuild.transform(code, {
          loader: getEsbuildLoader(path.extname(id)),
          jsx: "preserve",
          sourcefile: id,
          sourcemap: "inline"
        });
        return transformJSX({
          code: jsxCode,
          id,
          renderer: [...jsxRenderers.values()][0],
          mode,
          ssr
        });
      }
      const { code: jsCode } = await esbuild.transform(code + PREVENT_UNUSED_IMPORTS, {
        loader: getEsbuildLoader(path.extname(id)),
        jsx: "transform",
        jsxFactory: "h",
        jsxFragment: "Fragment",
        sourcefile: id,
        sourcemap: "inline"
      });
      let imports = [];
      if (/import/.test(jsCode)) {
        let [i] = eslexer.parse(jsCode);
        imports = i;
      }
      let importSource;
      if (imports.length > 0) {
        for (let { n: spec } of imports) {
          const pkg = spec && parseNpmName(spec);
          if (!pkg)
            continue;
          if (jsxRenderers.has(pkg.name)) {
            importSource = pkg.name;
            break;
          }
        }
      }
      if (!importSource) {
        const multiline = code.match(/\/\*\*?[\S\s]*\*\//gm) || [];
        for (const comment of multiline) {
          const [_, lib] = comment.slice(0, -2).match(/@jsxImportSource\s*(\S+)/) || [];
          if (lib) {
            importSource = lib.trim();
            break;
          }
        }
      }
      if (!importSource && jsxRenderers.has("astro") && id.includes(".mdx")) {
        importSource = "astro";
      }
      if (importSource) {
        const jsxRenderer = jsxRenderers.get(importSource);
        if (!jsxRenderer) {
          error(logging, "renderer", `${colors.yellow(id)} No renderer installed for ${importSource}. Try adding \`@astrojs/${importSource}\` to your project.`);
          return null;
        }
        const { code: jsxCode } = await esbuild.transform(code, {
          loader: getEsbuildLoader(path.extname(id)),
          jsx: "preserve",
          sourcefile: id,
          sourcemap: "inline"
        });
        return await transformJSX({
          code: jsxCode,
          id,
          renderer: jsxRenderers.get(importSource),
          mode,
          ssr
        });
      }
      const defaultRenderer = [...jsxRenderers.keys()][0];
      error(logging, "renderer", `${colors.yellow(id)}
Unable to resolve a renderer that handles this file! With more than one renderer enabled, you should include an import or use a pragma comment.
Add ${colors.cyan(IMPORT_STATEMENTS[defaultRenderer] || `import '${defaultRenderer}';`)} or ${colors.cyan(`/* jsxImportSource: ${defaultRenderer} */`)} to this file.
`);
      return null;
    }
  };
}
export {
  jsx as default
};
