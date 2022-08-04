import { AstroJSX, isVNode } from "../../jsx-runtime/index.js";
import {
  escapeHTML,
  Fragment,
  HTMLString,
  markHTMLString,
  renderComponent,
  renderToString,
  spreadAttributes,
  voidElementNames
} from "./index.js";
async function renderJSX(result, vnode) {
  switch (true) {
    case vnode instanceof HTMLString:
      return vnode;
    case typeof vnode === "string":
      return markHTMLString(escapeHTML(vnode));
    case (!vnode && vnode !== 0):
      return "";
    case vnode.type === Fragment:
      return renderJSX(result, vnode.props.children);
    case Array.isArray(vnode):
      return markHTMLString((await Promise.all(vnode.map((v) => renderJSX(result, v)))).join(""));
    case vnode.type.isAstroComponentFactory: {
      let props = {};
      let slots = {};
      for (const [key, value] of Object.entries(vnode.props ?? {})) {
        if (key === "children" || value && typeof value === "object" && value["$$slot"]) {
          slots[key === "children" ? "default" : key] = () => renderJSX(result, value);
        } else {
          props[key] = value;
        }
      }
      return await renderToString(result, vnode.type, props, slots);
    }
  }
  if (vnode[AstroJSX]) {
    if (!vnode.type && vnode.type !== 0)
      return "";
    if (typeof vnode.type === "string") {
      return await renderElement(result, vnode.type, vnode.props ?? {});
    }
    if (!!vnode.type) {
      let extractSlots2 = function(child) {
        if (Array.isArray(child)) {
          return child.map((c) => extractSlots2(c));
        }
        if (!isVNode(child)) {
          return slots.default.push(child);
        }
        if ("slot" in child.props) {
          slots[child.props.slot] = [...slots[child.props.slot] ?? [], child];
          delete child.props.slot;
          return;
        }
        slots.default.push(child);
      };
      var extractSlots = extractSlots2;
      try {
        const output = await vnode.type(vnode.props ?? {});
        if (output && output[AstroJSX]) {
          return await renderJSX(result, output);
        } else if (!output) {
          return await renderJSX(result, output);
        }
      } catch (e) {
      }
      const { children = null, ...props } = vnode.props ?? {};
      const slots = {
        default: []
      };
      extractSlots2(children);
      for (const [key, value] of Object.entries(slots)) {
        slots[key] = () => renderJSX(result, value);
      }
      return markHTMLString(await renderComponent(result, vnode.type.name, vnode.type, props, slots));
    }
  }
  return markHTMLString(`${vnode}`);
}
async function renderElement(result, tag, { children, ...props }) {
  return markHTMLString(`<${tag}${spreadAttributes(props)}${markHTMLString((children == null || children == "") && voidElementNames.test(tag) ? `/>` : `>${children == null ? "" : await renderJSX(result, children)}</${tag}>`)}`);
}
export {
  renderJSX
};
