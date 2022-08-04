import { appendForwardSlash } from "../core/path.js";
function getFileInfo(id, config) {
  const sitePathname = appendForwardSlash(config.site ? new URL(config.base, config.site).pathname : config.base);
  const fileId = id.split("?")[0];
  let fileUrl = fileId.includes("/pages/") ? fileId.replace(/^.*?\/pages\//, sitePathname).replace(/(\/index)?\.(md|astro)$/, "") : void 0;
  if (fileUrl && config.trailingSlash === "always") {
    fileUrl = appendForwardSlash(fileUrl);
  }
  return { fileId, fileUrl };
}
export {
  getFileInfo
};
