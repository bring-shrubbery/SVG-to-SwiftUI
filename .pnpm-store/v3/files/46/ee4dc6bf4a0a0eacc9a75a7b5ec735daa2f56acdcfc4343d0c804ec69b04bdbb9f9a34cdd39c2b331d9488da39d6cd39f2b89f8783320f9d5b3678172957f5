# estree-util-visit

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]
[![Sponsors][sponsors-badge]][collective]
[![Backers][backers-badge]][collective]
[![Chat][chat-badge]][chat]

[**esast**][esast] (and [estree][]) utility to visit nodes.

Similar to [`unist-util-visit`][unist-visit].
Basically the tiniest you can go (while being usable).
Also has nice stack traces if something crashes.

## Install

This package is [ESM only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c):
Node 12+ is needed to use it and it must be `import`ed instead of `require`d.

[npm][]:

```sh
npm install estree-util-visit
```

## Use

```js
import {parse} from 'acorn'
import {visit} from 'estree-util-visit'

var tree = parse(
  'export function x() { console.log(1 + "2"); process.exit(3) }',
  {sourceType: 'module'}
)

visit(tree, function (node) {
  if (node.type === 'Literal') console.log(node.value)
})

// Both enter and leave:
// walk(tree, {
//   enter(node, field, index, parents) {},
//   leave(node, field, index, parents) {}
// })
```

Yields:

```txt
1
"2"
3
```

## API

This package exports the following identifiers: `visit`, `EXIT`, `CONTINUE`, and
`SKIP`.
There is no default export.

### `visit(tree, visitor|visitors)`

Visit nodes ([*inclusive descendants*][descendant] of [`tree`][tree]), with
ancestral information.

This algorithm performs [*depth-first*][depth-first]
[*tree traversal*][tree-traversal] in [*preorder*][preorder] (**NLR**) and/or
[*postorder*][postorder] (**LRN**).

Compared to other estree walkers, this does not need a dictionary of which
fields are nodes, because it ducktypes instead.

Walking the tree is an intensive task.
Make use of the return values of the visitor(s) when possible.
Instead of walking a tree multiple times, walk it once, use
[`unist-util-is`][is] to check if a node matches, and then perform different
operations.

###### Parameters

*   `tree` ([`Node`][node]) — [Tree][] to traverse
*   `visitor` ([`Function`][visitor])
    — Same as passing `{enter: visitor}`
*   `visitors` (`{enter: visitor, exit: visitor}`)
    — Two functions, respectively called when entering a node ([preorder][])
    or before leaving a node ([postorder][])

#### `next? = visitor(node, key, index, ancestors)`

Called when a node is found.

Visitors are free to transform `node`.
They can also transform the [parent][] of node (the last of `ancestors`).
Replacing `node` itself, if `SKIP` is not returned, still causes its
[descendant][]s to be walked.
If adding or removing previous [sibling][]s of `node`, `visitor` should return
a new [`index`][index] (`number`) to specify the sibling to traverse after
`node` is traversed.
Adding or removing next siblings of `node` is handled as expected without
needing to return a new `index`.

###### Parameters

*   `node` ([`Node`][node]) — Found node
*   `key` (`string?`) — Field at which `node` lives in its parent
*   `index` (`number?`) — Index at which `node` lives if `parent[key]` is an
    array
*   `ancestors` (`Array.<Node>`) — [Ancestor][]s of `node`

##### Returns

The return value can have the following forms:

*   `index` (`number`) — Treated as a tuple of `[CONTINUE, index]`
*   `action` (`symbol`) — Treated as a tuple of `[action]`
*   `tuple` (`Array.<symbol|number>`) — List with one or two values, the first
    an `action`, the second and `index`.
    Note that passing a tuple only makes sense if the `action` is `SKIP`.
    If the `action` is `EXIT`, that action can be returned.
    If the `action` is `CONTINUE`, `index` can be returned.

###### `action`

An action can have the following values:

*   `EXIT` (`symbol`) — Stop traversing immediately
*   `CONTINUE` (`symbol`) — Continue traversing as normal (same behaviour
    as not returning an action)
*   `SKIP` (`symbol`) — Do not traverse this node’s children.
    Has no effect in `leave`

## Related

## Contribute

See [`contributing.md` in `syntax-tree/.github`][contributing] for ways to get
started.
See [`support.md`][support] for ways to get help.

This project has a [code of conduct][coc].
By interacting with this repository, organization, or community you agree to
abide by its terms.

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definition -->

[build-badge]: https://github.com/syntax-tree/estree-util-visit/workflows/main/badge.svg

[build]: https://github.com/syntax-tree/estree-util-visit/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/syntax-tree/estree-util-visit.svg

[coverage]: https://codecov.io/github/syntax-tree/estree-util-visit

[downloads-badge]: https://img.shields.io/npm/dm/estree-util-visit.svg

[downloads]: https://www.npmjs.com/package/estree-util-visit

[size-badge]: https://img.shields.io/bundlephobia/minzip/estree-util-visit.svg

[size]: https://bundlephobia.com/result?p=estree-util-visit

[sponsors-badge]: https://opencollective.com/unified/sponsors/badge.svg

[backers-badge]: https://opencollective.com/unified/backers/badge.svg

[collective]: https://opencollective.com/unified

[chat-badge]: https://img.shields.io/badge/chat-discussions-success.svg

[chat]: https://github.com/syntax-tree/unist/discussions

[npm]: https://docs.npmjs.com/cli/install

[license]: license

[author]: https://wooorm.com

[contributing]: https://github.com/syntax-tree/.github/blob/HEAD/contributing.md

[support]: https://github.com/syntax-tree/.github/blob/HEAD/support.md

[coc]: https://github.com/syntax-tree/.github/blob/HEAD/code-of-conduct.md

[index]: https://github.com/syntax-tree/unist#index

[parent]: https://github.com/syntax-tree/unist#parent-1

[esast]: https://github.com/syntax-tree/esast

[estree]: https://github.com/estree/estree

[ancestor]: https://github.com/syntax-tree/unist#ancestor

[descendant]: https://github.com/syntax-tree/unist#descendant

[tree]: https://github.com/syntax-tree/unist#tree

[depth-first]: https://github.com/syntax-tree/unist#depth-first-traversal

[tree-traversal]: https://github.com/syntax-tree/unist#tree-traversal

[preorder]: https://github.com/syntax-tree/unist#preorder

[postorder]: https://github.com/syntax-tree/unist#postorder

[is]: https://github.com/syntax-tree/unist-util-is

[node]: https://github.com/syntax-tree/esast#node

[sibling]: https://github.com/syntax-tree/esast#sibling

[visitor]: #next--visitornode-key-index-ancestors

[unist-visit]: https://github.com/syntax-tree/unist-util-visit-parents
