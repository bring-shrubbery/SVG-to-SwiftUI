import ssgAdapter from "../adapter-ssg/index.js";
import { mergeConfig } from "../core/config.js";
import { isBuildingToSSR } from "../core/util.js";
async function runHookConfigSetup({
  config: _config,
  command
}) {
  var _a;
  if (_config.adapter) {
    _config.integrations.push(_config.adapter);
  }
  let updatedConfig = { ..._config };
  for (const integration of _config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:config:setup"]) {
      let addPageExtension2 = function(...input) {
        const exts = input.flat(Infinity).map((ext) => `.${ext.replace(/^\./, "")}`);
        updatedConfig._ctx.pageExtensions.push(...exts);
      };
      var addPageExtension = addPageExtension2;
      const hooks = {
        config: updatedConfig,
        command,
        addRenderer(renderer) {
          updatedConfig._ctx.renderers.push(renderer);
        },
        injectScript: (stage, content) => {
          updatedConfig._ctx.scripts.push({ stage, content });
        },
        updateConfig: (newConfig) => {
          updatedConfig = mergeConfig(updatedConfig, newConfig);
        },
        injectRoute: (injectRoute) => {
          updatedConfig._ctx.injectedRoutes.push(injectRoute);
        }
      };
      Object.defineProperty(hooks, "addPageExtension", {
        value: addPageExtension2,
        writable: false,
        enumerable: false
      });
      await integration.hooks["astro:config:setup"](hooks);
    }
  }
  return updatedConfig;
}
async function runHookConfigDone({ config }) {
  var _a, _b;
  for (const integration of config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:config:done"]) {
      await integration.hooks["astro:config:done"]({
        config,
        setAdapter(adapter) {
          if (config._ctx.adapter && config._ctx.adapter.name !== adapter.name) {
            throw new Error(`Adapter already set to ${config._ctx.adapter.name}. You can only have one adapter.`);
          }
          config._ctx.adapter = adapter;
        }
      });
    }
  }
  if (!config._ctx.adapter) {
    const integration = ssgAdapter();
    config.integrations.push(integration);
    if ((_b = integration == null ? void 0 : integration.hooks) == null ? void 0 : _b["astro:config:done"]) {
      await integration.hooks["astro:config:done"]({
        config,
        setAdapter(adapter) {
          config._ctx.adapter = adapter;
        }
      });
    }
  }
}
async function runHookServerSetup({
  config,
  server
}) {
  var _a;
  for (const integration of config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:server:setup"]) {
      await integration.hooks["astro:server:setup"]({ server });
    }
  }
}
async function runHookServerStart({
  config,
  address
}) {
  var _a;
  for (const integration of config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:server:start"]) {
      await integration.hooks["astro:server:start"]({ address });
    }
  }
}
async function runHookServerDone({ config }) {
  var _a;
  for (const integration of config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:server:done"]) {
      await integration.hooks["astro:server:done"]();
    }
  }
}
async function runHookBuildStart({
  config,
  buildConfig
}) {
  var _a;
  for (const integration of config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:build:start"]) {
      await integration.hooks["astro:build:start"]({ buildConfig });
    }
  }
}
async function runHookBuildSetup({
  config,
  vite,
  pages,
  target
}) {
  var _a;
  for (const integration of config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:build:setup"]) {
      await integration.hooks["astro:build:setup"]({
        vite,
        pages,
        target,
        updateConfig: (newConfig) => {
          mergeConfig(vite, newConfig);
        }
      });
    }
  }
}
async function runHookBuildSsr({
  config,
  manifest
}) {
  var _a;
  for (const integration of config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:build:ssr"]) {
      await integration.hooks["astro:build:ssr"]({ manifest });
    }
  }
}
async function runHookBuildDone({
  config,
  buildConfig,
  pages,
  routes
}) {
  var _a;
  const dir = isBuildingToSSR(config) ? buildConfig.client : config.outDir;
  for (const integration of config.integrations) {
    if ((_a = integration == null ? void 0 : integration.hooks) == null ? void 0 : _a["astro:build:done"]) {
      await integration.hooks["astro:build:done"]({
        pages: pages.map((p) => ({ pathname: p })),
        dir,
        routes
      });
    }
  }
}
export {
  runHookBuildDone,
  runHookBuildSetup,
  runHookBuildSsr,
  runHookBuildStart,
  runHookConfigDone,
  runHookConfigSetup,
  runHookServerDone,
  runHookServerSetup,
  runHookServerStart
};
