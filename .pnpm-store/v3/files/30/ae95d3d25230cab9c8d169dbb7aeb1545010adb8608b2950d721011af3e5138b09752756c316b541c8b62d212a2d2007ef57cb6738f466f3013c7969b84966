import { preload } from "../../render/dev/index.js";
import { isBuildingToSSR } from "../../util.js";
import { call as callEndpoint } from "../index.js";
async function call(ssrOpts) {
  const [, mod] = await preload(ssrOpts);
  return await callEndpoint(mod, {
    ...ssrOpts,
    ssr: isBuildingToSSR(ssrOpts.astroConfig)
  });
}
export {
  call
};
