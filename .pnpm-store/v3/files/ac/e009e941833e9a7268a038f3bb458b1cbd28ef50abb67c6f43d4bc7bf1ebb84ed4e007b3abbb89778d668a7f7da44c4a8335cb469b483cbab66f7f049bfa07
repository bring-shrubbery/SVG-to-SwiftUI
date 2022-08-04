import npath from "path-browserify";
import { appendForwardSlash } from "../../core/path.js";
function getRootPath(site) {
  return appendForwardSlash(new URL(site || "http://localhost/").pathname);
}
function joinToRoot(href, site) {
  return npath.posix.join(getRootPath(site), href);
}
function createLinkStylesheetElement(href, site) {
  return {
    props: {
      rel: "stylesheet",
      href: joinToRoot(href, site)
    },
    children: ""
  };
}
function createLinkStylesheetElementSet(hrefs, site) {
  return new Set(hrefs.map((href) => createLinkStylesheetElement(href, site)));
}
function createModuleScriptElement(script, site) {
  if (script.type === "external") {
    return createModuleScriptElementWithSrc(script.value, site);
  } else {
    return {
      props: {
        type: "module"
      },
      children: script.value
    };
  }
}
function createModuleScriptElementWithSrc(src, site) {
  return {
    props: {
      type: "module",
      src: joinToRoot(src, site)
    },
    children: ""
  };
}
function createModuleScriptElementWithSrcSet(srces, site) {
  return new Set(srces.map((src) => createModuleScriptElementWithSrc(src, site)));
}
function createModuleScriptsSet(scripts, site) {
  return new Set(scripts.map((script) => createModuleScriptElement(script, site)));
}
export {
  createLinkStylesheetElement,
  createLinkStylesheetElementSet,
  createModuleScriptElement,
  createModuleScriptElementWithSrc,
  createModuleScriptElementWithSrcSet,
  createModuleScriptsSet
};
