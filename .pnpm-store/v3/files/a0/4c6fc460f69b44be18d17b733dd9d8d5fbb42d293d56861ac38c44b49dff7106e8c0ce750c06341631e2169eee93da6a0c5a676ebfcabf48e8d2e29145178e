var _a;
{
  const propTypes = {
    0: (value) => value,
    1: (value) => JSON.parse(value, reviver),
    2: (value) => new RegExp(value),
    3: (value) => new Date(value),
    4: (value) => new Map(JSON.parse(value, reviver)),
    5: (value) => new Set(JSON.parse(value, reviver)),
    6: (value) => BigInt(value),
    7: (value) => new URL(value)
  };
  const reviver = (propKey, raw) => {
    if (propKey === "" || !Array.isArray(raw))
      return raw;
    const [type, value] = raw;
    return type in propTypes ? propTypes[type](value) : void 0;
  };
  if (!customElements.get("astro-island")) {
    customElements.define("astro-island", (_a = class extends HTMLElement {
      constructor() {
        super(...arguments);
        this.hydrate = () => {
          var _a2, _b, _c;
          if (!this.hydrator || ((_a2 = this.parentElement) == null ? void 0 : _a2.closest("astro-island[ssr]"))) {
            return;
          }
          const slotted = this.querySelectorAll("astro-slot");
          const slots = {};
          const templates = this.querySelectorAll("template[data-astro-template]");
          for (const template of templates) {
            if (!((_b = template.closest(this.tagName)) == null ? void 0 : _b.isSameNode(this)))
              continue;
            slots[template.getAttribute("data-astro-template") || "default"] = template.innerHTML;
            template.remove();
          }
          for (const slot of slotted) {
            if (!((_c = slot.closest(this.tagName)) == null ? void 0 : _c.isSameNode(this)))
              continue;
            slots[slot.getAttribute("name") || "default"] = slot.innerHTML;
          }
          const props = this.hasAttribute("props") ? JSON.parse(this.getAttribute("props"), reviver) : {};
          this.hydrator(this)(this.Component, props, slots, {
            client: this.getAttribute("client")
          });
          this.removeAttribute("ssr");
          window.removeEventListener("astro:hydrate", this.hydrate);
          window.dispatchEvent(new CustomEvent("astro:hydrate"));
        };
      }
      connectedCallback() {
        if (!this.hasAttribute("await-children") || this.firstChild) {
          this.childrenConnectedCallback();
        } else {
          new MutationObserver((_, mo) => {
            mo.disconnect();
            this.childrenConnectedCallback();
          }).observe(this, { childList: true });
        }
      }
      async childrenConnectedCallback() {
        window.addEventListener("astro:hydrate", this.hydrate);
        await import(this.getAttribute("before-hydration-url"));
        const opts = JSON.parse(this.getAttribute("opts"));
        Astro[this.getAttribute("client")](async () => {
          const rendererUrl = this.getAttribute("renderer-url");
          const [componentModule, { default: hydrator }] = await Promise.all([
            import(this.getAttribute("component-url")),
            rendererUrl ? import(rendererUrl) : () => () => {
            }
          ]);
          this.Component = componentModule[this.getAttribute("component-export") || "default"];
          this.hydrator = hydrator;
          return this.hydrate;
        }, opts, this);
      }
      attributeChangedCallback() {
        if (this.hydrator)
          this.hydrate();
      }
    }, _a.observedAttributes = ["props"], _a));
  }
}
