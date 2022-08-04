import { addAstro } from "@astrojs/prism/internal";
import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";
import { visit } from "unist-util-visit";
const noVisit = /* @__PURE__ */ new Set(["root", "html", "text"]);
const languageMap = /* @__PURE__ */ new Map([["ts", "typescript"]]);
function runHighlighter(lang, code) {
  let classLanguage = `language-${lang}`;
  if (lang == null) {
    lang = "plaintext";
  }
  const ensureLoaded = (language) => {
    if (language && !Prism.languages[language]) {
      loadLanguages([language]);
    }
  };
  if (languageMap.has(lang)) {
    ensureLoaded(languageMap.get(lang));
  } else if (lang === "astro") {
    ensureLoaded("typescript");
    addAstro(Prism);
  } else {
    ensureLoaded("markup-templating");
    ensureLoaded(lang);
  }
  if (lang && !Prism.languages[lang]) {
    console.warn(`Unable to load the language: ${lang}`);
  }
  const grammar = Prism.languages[lang];
  let html = code;
  if (grammar) {
    html = Prism.highlight(code, grammar, lang);
  }
  return { classLanguage, html };
}
function transformer(className) {
  return function(tree) {
    const visitor = (node) => {
      let { lang, value } = node;
      node.type = "html";
      let { html, classLanguage } = runHighlighter(lang, value);
      let classes = [classLanguage];
      if (className) {
        classes.push(className);
      }
      node.value = `<pre class="${classes.join(" ")}"><code is:raw class="${classLanguage}">${html}</code></pre>`;
      return node;
    };
    return visit(tree, "code", visitor);
  };
}
function plugin(className) {
  return transformer.bind(null, className);
}
var remark_prism_default = plugin;
export {
  remark_prism_default as default
};
