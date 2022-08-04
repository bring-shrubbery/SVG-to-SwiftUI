import { loadPlugins } from "./load-plugins.js";
import createCollectHeaders from "./rehype-collect-headers.js";
import rehypeEscape from "./rehype-escape.js";
import rehypeExpressions from "./rehype-expressions.js";
import rehypeIslands from "./rehype-islands.js";
import rehypeJsx from "./rehype-jsx.js";
import remarkEscape from "./remark-escape.js";
import remarkMarkAndUnravel from "./remark-mark-and-unravel.js";
import remarkMdxish from "./remark-mdxish.js";
import remarkPrism from "./remark-prism.js";
import scopedStyles from "./remark-scoped-styles.js";
import remarkShiki from "./remark-shiki.js";
import remarkUnwrap from "./remark-unwrap.js";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import markdown from "remark-parse";
import markdownToHtml from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";
export * from "./types.js";
const DEFAULT_REMARK_PLUGINS = ["remark-gfm", "remark-smartypants"];
const DEFAULT_REHYPE_PLUGINS = [];
async function renderMarkdown(content, opts = {}) {
  var _a;
  let {
    fileURL,
    mode = "mdx",
    syntaxHighlight = "shiki",
    shikiConfig = {},
    remarkPlugins = [],
    rehypePlugins = []
  } = opts;
  const input = new VFile({ value: content, path: fileURL });
  const scopedClassName = (_a = opts.$) == null ? void 0 : _a.scopedClassName;
  const isMDX = mode === "mdx";
  const { headers, rehypeCollectHeaders } = createCollectHeaders();
  let parser = unified().use(markdown).use(isMDX ? [remarkMdxish, remarkMarkAndUnravel] : []).use([remarkUnwrap, remarkEscape]);
  if (remarkPlugins.length === 0 && rehypePlugins.length === 0) {
    remarkPlugins = [...DEFAULT_REMARK_PLUGINS];
    rehypePlugins = [...DEFAULT_REHYPE_PLUGINS];
  }
  const loadedRemarkPlugins = await Promise.all(loadPlugins(remarkPlugins));
  const loadedRehypePlugins = await Promise.all(loadPlugins(rehypePlugins));
  loadedRemarkPlugins.forEach(([plugin, pluginOpts]) => {
    parser.use([[plugin, pluginOpts]]);
  });
  if (scopedClassName) {
    parser.use([scopedStyles(scopedClassName)]);
  }
  if (syntaxHighlight === "shiki") {
    parser.use([await remarkShiki(shikiConfig, scopedClassName)]);
  } else if (syntaxHighlight === "prism") {
    parser.use([remarkPrism(scopedClassName)]);
  }
  parser.use([
    [
      markdownToHtml,
      {
        allowDangerousHtml: true,
        passThrough: [
          "raw",
          "mdxFlowExpression",
          "mdxJsxFlowElement",
          "mdxJsxTextElement",
          "mdxTextExpression"
        ]
      }
    ]
  ]);
  loadedRehypePlugins.forEach(([plugin, pluginOpts]) => {
    parser.use([[plugin, pluginOpts]]);
  });
  parser.use(isMDX ? [rehypeJsx, rehypeExpressions] : [rehypeRaw]).use(rehypeEscape).use(rehypeIslands).use([rehypeCollectHeaders]).use(rehypeStringify, { allowDangerousHtml: true });
  let result;
  try {
    const vfile = await parser.process(input);
    result = vfile.toString();
  } catch (err) {
    err = prefixError(err, `Failed to parse Markdown file "${input.path}"`);
    console.error(err);
    throw err;
  }
  return {
    metadata: { headers, source: content, html: result.toString() },
    code: result.toString()
  };
}
function prefixError(err, prefix) {
  if (err && err.message) {
    try {
      err.message = `${prefix}:
${err.message}`;
      return err;
    } catch (error) {
    }
  }
  const wrappedError = new Error(`${prefix}${err ? `: ${err}` : ""}`);
  try {
    wrappedError.stack = err.stack;
    wrappedError.cause = err;
  } catch (error) {
  }
  return wrappedError;
}
export {
  DEFAULT_REHYPE_PLUGINS,
  DEFAULT_REMARK_PLUGINS,
  renderMarkdown
};
