import { parse as babelParser } from "@babel/parser";
import { parse, print, types, visit } from "recast";
const ASTRO_GLOB_REGEX = /Astro2?\s*\.\s*glob\s*\(/;
const validAstroGlobalNames = /* @__PURE__ */ new Set(["Astro", "Astro2"]);
function astro({ config }) {
  return {
    name: "astro:postprocess",
    async transform(code, id) {
      if (!id.endsWith(".astro") && !id.endsWith(".md")) {
        return null;
      }
      if (!ASTRO_GLOB_REGEX.test(code)) {
        return null;
      }
      const ast = parse(code, {
        parser: { parse: babelParser }
      });
      visit(ast, {
        visitCallExpression: function(path) {
          if (!types.namedTypes.MemberExpression.check(path.node.callee) || !types.namedTypes.Identifier.check(path.node.callee.property) || !(path.node.callee.property.name === "glob") || !types.namedTypes.Identifier.check(path.node.callee.object) || !(path.node.callee.object.name === "Astro" || path.node.callee.object.name === "Astro2")) {
            this.traverse(path);
            return;
          }
          const argsPath = path.get("arguments", 0);
          const args = argsPath.value;
          argsPath.replace({
            type: "CallExpression",
            callee: {
              type: "MemberExpression",
              object: {
                type: "MetaProperty",
                meta: { type: "Identifier", name: "import" },
                property: { type: "Identifier", name: "meta" }
              },
              property: { type: "Identifier", name: "glob" },
              computed: false
            },
            arguments: [args]
          }, {
            type: "ArrowFunctionExpression",
            body: args,
            params: []
          });
          return false;
        }
      });
      const result = print(ast);
      return { code: result.code, map: result.map };
    }
  };
}
export {
  astro as default
};
