import { getHighlighter } from "shiki";
import { visit } from "unist-util-visit";
const highlighterCacheAsync = /* @__PURE__ */ new Map();
const remarkShiki = async ({ langs = [], theme = "github-dark", wrap = false }, scopedClassName) => {
  const cacheID = typeof theme === "string" ? theme : theme.name;
  let highlighterAsync = highlighterCacheAsync.get(cacheID);
  if (!highlighterAsync) {
    highlighterAsync = getHighlighter({ theme });
    highlighterCacheAsync.set(cacheID, highlighterAsync);
  }
  const highlighter = await highlighterAsync;
  for (const lang of langs) {
    await highlighter.loadLanguage(lang);
  }
  return () => (tree) => {
    visit(tree, "code", (node) => {
      let html = highlighter.codeToHtml(node.value, { lang: node.lang ?? "plaintext" });
      html = html.replace('<pre class="shiki"', `<pre is:raw class="astro-code${scopedClassName ? " " + scopedClassName : ""}"`);
      html = html.replace(/style="(background-)?color: var\(--shiki-/g, 'style="$1color: var(--astro-code-');
      if (node.lang === "diff") {
        html = html.replace(/<span class="line"><span style="(.*?)">([\+|\-])/g, '<span class="line"><span style="$1"><span style="user-select: none;">$2</span>');
      }
      if (wrap === false) {
        html = html.replace(/style="(.*?)"/, 'style="$1; overflow-x: auto;"');
      } else if (wrap === true) {
        html = html.replace(/style="(.*?)"/, 'style="$1; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;"');
      }
      if (scopedClassName) {
        html = html.replace(/\<span class="line"\>/g, `<span class="line ${scopedClassName}"`);
      }
      node.type = "html";
      node.value = html;
      node.children = [];
    });
  };
};
var remark_shiki_default = remarkShiki;
export {
  remark_shiki_default as default
};
