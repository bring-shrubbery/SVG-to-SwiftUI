import idlePrebuilt from "../client/idle.prebuilt.js";
import loadPrebuilt from "../client/load.prebuilt.js";
import mediaPrebuilt from "../client/media.prebuilt.js";
import onlyPrebuilt from "../client/only.prebuilt.js";
import visiblePrebuilt from "../client/visible.prebuilt.js";
import islandScript from "./astro-island.prebuilt.js";
const resultsWithHydrationScript = /* @__PURE__ */ new WeakSet();
function determineIfNeedsHydrationScript(result) {
  if (resultsWithHydrationScript.has(result)) {
    return false;
  }
  resultsWithHydrationScript.add(result);
  return true;
}
const hydrationScripts = {
  idle: idlePrebuilt,
  load: loadPrebuilt,
  only: onlyPrebuilt,
  media: mediaPrebuilt,
  visible: visiblePrebuilt
};
const resultsWithDirectiveScript = /* @__PURE__ */ new Map();
function determinesIfNeedsDirectiveScript(result, directive) {
  if (!resultsWithDirectiveScript.has(directive)) {
    resultsWithDirectiveScript.set(directive, /* @__PURE__ */ new WeakSet());
  }
  const set = resultsWithDirectiveScript.get(directive);
  if (set.has(result)) {
    return false;
  }
  set.add(result);
  return true;
}
function getDirectiveScriptText(directive) {
  if (!(directive in hydrationScripts)) {
    throw new Error(`Unknown directive: ${directive}`);
  }
  const directiveScriptText = hydrationScripts[directive];
  return directiveScriptText;
}
function getPrescripts(type, directive) {
  switch (type) {
    case "both":
      return `<style>astro-island,astro-slot{display:contents}</style><script>${getDirectiveScriptText(directive) + islandScript}<\/script>`;
    case "directive":
      return `<script>${getDirectiveScriptText(directive)}<\/script>`;
  }
  return "";
}
export {
  determineIfNeedsHydrationScript,
  determinesIfNeedsDirectiveScript,
  getPrescripts,
  hydrationScripts
};
