# 🤏 micromorph

A very tiny library for diffing live DOM nodes.

Extremely handy when used in conjunction with the [`DOMParser`](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser) API.

---

## Use Cases

#### Want to update one node to match another?

Diff them efficiently and only sync changes between the two nodes.

```js
import diff from 'micromorph';

diff(fromNode, toNode);
```

#### Want to update the current `document` to match a new `document`, maybe from a string?

Micromorph is smart enough to handle full document diffing while avoiding FOUC.

> This feature powers HMR in [Astro](https://github.com/withastro/astro)

```js
import diff from 'micromorph';
const p = new DOMParser();

const newDoc = p.parseFromString(`<h1>Hello world!</h1>`, 'text/html');

diff(document, newDoc);
```

#### Want to turn your MPA into an SPA?

With the `/spa` entrypoint, Micromorph automatically converts your MPA into a SPA while only re-rendering content that has changed.

```js
import listen from 'micromorph/spa';

listen();
```
