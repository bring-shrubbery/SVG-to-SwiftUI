if (import.meta.hot) {
  let needsManualHMR = function(path) {
    for (const ext of KNOWN_MANUAL_HMR_EXTENSIONS.values()) {
      if (path.endsWith(ext))
        return true;
    }
    return false;
  };
  var needsManualHMR2 = needsManualHMR;
  import.meta.hot.accept((mod) => mod);
  const parser = new DOMParser();
  const KNOWN_MANUAL_HMR_EXTENSIONS = /* @__PURE__ */ new Set([".astro", ".md", ".mdx"]);
  async function updatePage() {
    const { default: diff } = await import("micromorph");
    const html = await fetch(`${window.location}`).then((res) => res.text());
    const doc = parser.parseFromString(html, "text/html");
    for (const style of sheetsMap.values()) {
      doc.head.appendChild(style);
    }
    for (const root of doc.querySelectorAll("astro-island")) {
      const uid = root.getAttribute("uid");
      const current = document.querySelector(`astro-island[uid="${uid}"]`);
      if (current) {
        current.setAttribute("data-persist", "");
        root.replaceWith(current);
      }
    }
    for (const style of document.querySelectorAll("style[type='text/css']")) {
      style.setAttribute("data-persist", "");
      doc.head.appendChild(style.cloneNode(true));
    }
    return diff(document, doc).then(() => {
      for (const root of document.querySelectorAll("astro-island[data-persist]")) {
        root.removeAttribute("data-persist");
      }
      for (const style of document.querySelectorAll("style[type='text/css'][data-persist]")) {
        style.removeAttribute("data-persist");
      }
    });
  }
  async function updateAll(files) {
    var _a;
    let hasManualUpdate = false;
    let styles = [];
    for (const file of files) {
      if (needsManualHMR(file.acceptedPath)) {
        hasManualUpdate = true;
        continue;
      }
      if (file.acceptedPath.includes("svelte&type=style")) {
        const injectedStyle = document.querySelector(`style[data-astro-injected="${file.acceptedPath}"]`);
        if (injectedStyle) {
          (_a = injectedStyle.parentElement) == null ? void 0 : _a.removeChild(injectedStyle);
        }
      }
      if (file.acceptedPath.includes("vue&type=style")) {
        const link = document.querySelector(`link[href="${file.acceptedPath}"]`);
        if (link) {
          link.replaceWith(link.cloneNode(true));
        }
      }
      if (file.acceptedPath.includes("astro&type=style")) {
        styles.push(fetch(file.acceptedPath).then((res) => res.text()).then((res) => [file.acceptedPath, res]));
      }
    }
    if (styles.length > 0) {
      for (const [id, content] of await Promise.all(styles)) {
        updateStyle(id, content);
      }
    }
    if (hasManualUpdate) {
      return await updatePage();
    }
  }
  import.meta.hot.on("vite:beforeUpdate", async (event) => {
    await updateAll(event.updates);
  });
}
const sheetsMap = /* @__PURE__ */ new Map();
function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (style && !(style instanceof HTMLStyleElement)) {
    removeStyle(id);
    style = void 0;
  }
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.innerHTML = content;
    document.head.appendChild(style);
  } else {
    style.innerHTML = content;
  }
  sheetsMap.set(id, style);
}
function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    if (style instanceof CSSStyleSheet) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== style);
    } else {
      document.head.removeChild(style);
    }
    sheetsMap.delete(id);
  }
}
