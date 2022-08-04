var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var _cache, _result, _slots;
import { bold } from "kleur/colors";
import { renderSlot } from "../../runtime/server/index.js";
import { warn } from "../logger/core.js";
import { isScriptRequest } from "./script.js";
import { createCanonicalURL, isCSSRequest } from "./util.js";
function onlyAvailableInSSR(name) {
  return function _onlyAvailableInSSR() {
    throw new Error(`Oops, you are trying to use ${name}, which is only available with SSR.`);
  };
}
function getFunctionExpression(slot) {
  var _a;
  if (!slot)
    return;
  if (((_a = slot.expressions) == null ? void 0 : _a.length) !== 1)
    return;
  return slot.expressions[0];
}
class Slots {
  constructor(result, slots) {
    __privateAdd(this, _cache, /* @__PURE__ */ new Map());
    __privateAdd(this, _result, void 0);
    __privateAdd(this, _slots, void 0);
    __privateSet(this, _result, result);
    __privateSet(this, _slots, slots);
    if (slots) {
      for (const key of Object.keys(slots)) {
        if (this[key] !== void 0) {
          throw new Error(`Unable to create a slot named "${key}". "${key}" is a reserved slot name!
Please update the name of this slot.`);
        }
        Object.defineProperty(this, key, {
          get() {
            return true;
          },
          enumerable: true
        });
      }
    }
  }
  has(name) {
    if (!__privateGet(this, _slots))
      return false;
    return Boolean(__privateGet(this, _slots)[name]);
  }
  async render(name, args = []) {
    const cacheable = args.length === 0;
    if (!__privateGet(this, _slots))
      return void 0;
    if (cacheable && __privateGet(this, _cache).has(name)) {
      const result = __privateGet(this, _cache).get(name);
      return result;
    }
    if (!this.has(name))
      return void 0;
    if (!cacheable) {
      const component = await __privateGet(this, _slots)[name]();
      const expression = getFunctionExpression(component);
      if (expression) {
        const slot = expression(...args);
        return await renderSlot(__privateGet(this, _result), slot).then((res) => res != null ? String(res) : res);
      }
    }
    const content = await renderSlot(__privateGet(this, _result), __privateGet(this, _slots)[name]).then((res) => res != null ? String(res) : res);
    if (cacheable)
      __privateGet(this, _cache).set(name, content);
    return content;
  }
}
_cache = new WeakMap();
_result = new WeakMap();
_slots = new WeakMap();
let renderMarkdown = null;
function isPaginatedRoute({ page }) {
  return page && "currentPage" in page;
}
function createResult(args) {
  const { markdown, params, pathname, props: pageProps, renderers, request, resolve, site } = args;
  const paginated = isPaginatedRoute(pageProps);
  const url = new URL(request.url);
  const canonicalURL = createCanonicalURL("." + pathname, site ?? url.origin, paginated);
  const headers = new Headers();
  if (args.streaming) {
    headers.set("Transfer-Encoding", "chunked");
  } else {
    headers.set("Content-Type", "text/html");
  }
  const response = {
    status: 200,
    statusText: "OK",
    headers
  };
  Object.defineProperty(response, "headers", {
    value: response.headers,
    enumerable: true,
    writable: false
  });
  const result = {
    styles: args.styles ?? /* @__PURE__ */ new Set(),
    scripts: args.scripts ?? /* @__PURE__ */ new Set(),
    links: args.links ?? /* @__PURE__ */ new Set(),
    createAstro(astroGlobal, props, slots) {
      const astroSlots = new Slots(result, slots);
      const Astro = {
        __proto__: astroGlobal,
        canonicalURL,
        params,
        props,
        request,
        redirect: args.ssr ? (path) => {
          return new Response(null, {
            status: 302,
            headers: {
              Location: path
            }
          });
        } : onlyAvailableInSSR("Astro.redirect"),
        resolve(path) {
          let extra = `This can be replaced with a dynamic import like so: await import("${path}")`;
          if (isCSSRequest(path)) {
            extra = `It looks like you are resolving styles. If you are adding a link tag, replace with this:
---
import "${path}";
---
`;
          } else if (isScriptRequest(path)) {
            extra = `It looks like you are resolving scripts. If you are adding a script tag, replace with this:

<script type="module" src={(await import("${path}?url")).default}><\/script>

or consider make it a module like so:

<script>
	import MyModule from "${path}";
<\/script>
`;
          }
          warn(args.logging, `deprecation`, `${bold("Astro.resolve()")} is deprecated. We see that you are trying to resolve ${path}.
${extra}`);
          return "";
        },
        response,
        slots: astroSlots
      };
      Object.defineProperty(Astro, "__renderMarkdown", {
        enumerable: false,
        writable: false,
        value: async function(content, opts) {
          if (typeof Deno !== "undefined") {
            throw new Error("Markdown is not supported in Deno SSR");
          }
          if (!renderMarkdown) {
            let astroRemark = "@astrojs/markdown-remark";
            renderMarkdown = (await import(astroRemark)).renderMarkdown;
          }
          const { code } = await renderMarkdown(content, { ...markdown, ...opts ?? {} });
          return code;
        }
      });
      return Astro;
    },
    resolve,
    _metadata: {
      renderers,
      pathname
    },
    response
  };
  return result;
}
export {
  createResult
};
