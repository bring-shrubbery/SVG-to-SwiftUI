import * as fs from "fs";
import { deserializeManifest } from "./common.js";
import { App } from "./index.js";
function createRequestFromNodeRequest(req) {
  let url = `http://${req.headers.host}${req.url}`;
  const entries = Object.entries(req.headers);
  let request = new Request(url, {
    method: req.method || "GET",
    headers: new Headers(entries)
  });
  return request;
}
class NodeApp extends App {
  match(req) {
    return super.match(req instanceof Request ? req : createRequestFromNodeRequest(req));
  }
  render(req) {
    return super.render(req instanceof Request ? req : createRequestFromNodeRequest(req));
  }
}
async function loadManifest(rootFolder) {
  const manifestFile = new URL("./manifest.json", rootFolder);
  const rawManifest = await fs.promises.readFile(manifestFile, "utf-8");
  const serializedManifest = JSON.parse(rawManifest);
  return deserializeManifest(serializedManifest);
}
async function loadApp(rootFolder) {
  const manifest = await loadManifest(rootFolder);
  return new NodeApp(manifest);
}
export {
  NodeApp,
  loadApp,
  loadManifest
};
