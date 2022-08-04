import { runHookServerSetup } from "../integrations/index.js";
function astroIntegrationsContainerPlugin({
  config
}) {
  return {
    name: "astro:integration-container",
    configureServer(server) {
      runHookServerSetup({ config, server });
    }
  };
}
export {
  astroIntegrationsContainerPlugin as default
};
