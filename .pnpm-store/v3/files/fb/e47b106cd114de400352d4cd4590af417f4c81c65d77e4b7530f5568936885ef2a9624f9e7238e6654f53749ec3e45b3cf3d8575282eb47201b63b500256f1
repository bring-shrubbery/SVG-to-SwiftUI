# unist-util-map

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]
[![Sponsors][sponsors-badge]][collective]
[![Backers][backers-badge]][collective]
[![Chat][chat-badge]][chat]

[**unist**][unist] utility to create a new [tree][] by mapping all [node][]s
with the given function.

## Install

This package is [ESM only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c):
Node 12+ is needed to use it and it must be `import`ed instead of `require`d.

[npm][]:

```sh
npm install unist-util-map
```

## Use

```js
import {u} from 'unist-builder'
import {map} from 'unist-util-map'

var tree = u('tree', [
  u('leaf', 'leaf 1'),
  u('node', [u('leaf', 'leaf 2')]),
  u('void'),
  u('leaf', 'leaf 3')
])

var next = map(tree, function(node) {
  return node.type === 'leaf'
    ? Object.assign({}, node, {value: 'CHANGED'})
    : node
})

console.dir(next, {depth: null})
```

Yields:

```js
{
  type: 'tree',
  children: [
    {type: 'leaf', value: 'CHANGED'},
    {type: 'node', children: [{type: 'leaf', value: 'CHANGED'}]},
    {type: 'void'},
    {type: 'leaf', value: 'CHANGED'}
  ]
}
```

…note that `tree` is not mutated.

## API

This package exports the following identifiers: `map`.
There is no default export.

### `map(tree, mapFn)`

Create a new [tree][] by mapping all [node][]s with the given function.

###### Parameters

*   `tree` ([`Node`][node]) — [Tree][] to map
*   `callback` ([`Function`][callback]) — Function that returns a new node

###### Returns

[`Node`][node] — New mapped [tree][].

#### `function mapFn(node[, index, parent])`

Function called with a [node][] to produce a new node.

###### Parameters

*   `node` ([`Node`][node]) — Current [node][] being processed
*   `index` (`number?`) — [Index][] of `node`, or `null`
*   `parent` (`Node?`) — [Parent][] of `node`, or `null`

###### Returns

[`Node`][node] — Node to be used in the new [tree][].
Its children are not used: if the original node has children, those are mapped.

## Related

*   [`unist-util-filter`](https://github.com/syntax-tree/unist-util-filter)
    — Create a new tree with all nodes that pass the given function
*   [`unist-util-flatmap`](https://gitlab.com/staltz/unist-util-flatmap)
    — Create a new tree by expanding a node into many
*   [`unist-util-remove`](https://github.com/syntax-tree/unist-util-remove)
    — Remove nodes from trees
*   [`unist-util-select`](https://github.com/syntax-tree/unist-util-select)
    — Select nodes with CSS-like selectors
*   [`unist-util-visit`](https://github.com/syntax-tree/unist-util-visit)
    — Recursively walk over nodes
*   [`unist-builder`](https://github.com/syntax-tree/unist-builder)
    — Creating trees

## Contribute

See [`contributing.md` in `syntax-tree/.github`][contributing] for ways to get
started.
See [`support.md`][support] for ways to get help.

This project has a [code of conduct][coc].
By interacting with this repository, organization, or community you agree to
abide by its terms.

## License

[MIT][license] © [azu][author]

<!-- Definitions -->

[build-badge]: https://github.com/syntax-tree/unist-util-map/workflows/main/badge.svg

[build]: https://github.com/syntax-tree/unist-util-map/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/syntax-tree/unist-util-map.svg

[coverage]: https://codecov.io/github/syntax-tree/unist-util-map

[downloads-badge]: https://img.shields.io/npm/dm/unist-util-map.svg

[downloads]: https://www.npmjs.com/package/unist-util-map

[size-badge]: https://img.shields.io/bundlephobia/minzip/unist-util-map.svg

[size]: https://bundlephobia.com/result?p=unist-util-map

[sponsors-badge]: https://opencollective.com/unified/sponsors/badge.svg

[backers-badge]: https://opencollective.com/unified/backers/badge.svg

[collective]: https://opencollective.com/unified

[chat-badge]: https://img.shields.io/badge/chat-discussions-success.svg

[chat]: https://github.com/syntax-tree/unist/discussions

[npm]: https://docs.npmjs.com/cli/install

[license]: license

[author]: https://efcl.info

[unist]: https://github.com/syntax-tree/unist

[node]: https://github.com/syntax-tree/unist#node

[tree]: https://github.com/syntax-tree/unist#tree

[parent]: https://github.com/syntax-tree/unist#parent-1

[index]: https://github.com/syntax-tree/unist#index

[callback]: #function-mapfnnode-index-parent

[contributing]: https://github.com/syntax-tree/.github/blob/HEAD/contributing.md

[support]: https://github.com/syntax-tree/.github/blob/HEAD/support.md

[coc]: https://github.com/syntax-tree/.github/blob/HEAD/code-of-conduct.md
