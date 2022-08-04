# longest-streak

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]

Get the count of the longest repeating streak of `character` in `value`.

## Contents

*   [Install](#install)
*   [Use](#use)
*   [API](#api)
    *   [`longestStreak(value, character)`](#longeststreakvalue-character)
*   [Types](#types)
*   [Compatibility](#compatibility)
*   [Security](#security)
*   [Related](#related)
*   [Contribute](#contribute)
*   [License](#license)

## Install

This package is [ESM only][esm].
In Node.js (version 12.20+, 14.14+, or 16.0+), install with [npm][]:

```sh
npm install longest-streak
```

In Deno with [Skypack][]:

```js
import {longestStreak} from 'https://cdn.skypack.dev/longest-streak@3?dts'
```

In browsers with [Skypack][]:

```html
<script type="module">
  import {longestStreak} from 'https://cdn.skypack.dev/longest-streak@3?min'
</script>
```

## Use

```js
import {longestStreak} from 'longest-streak'

longestStreak('` foo `` bar `', '`') // => 2
```

## API

This package exports the following identifiers: `longestStreak`.
There is no default export.

### `longestStreak(value, character)`

Get the count of the longest repeating streak of `character` in `value`.

###### Parameters

*   `value` (`string`) — content to search in
*   `character` (`string`) — single character to look for

###### Returns

`number` — count of most frequent adjacent `character`s in `value`.

###### Throws

*   `Error` — when `character` is not a single character string

## Types

This package is fully typed with [TypeScript][].

## Compatibility

This package is at least compatible with all maintained versions of Node.js.
As of now, that is Node.js 12.20+, 14.14+, and 16.0+.
It also works in Deno and modern browsers.

## Security

This package is safe.

## Related

*   [`wooorm/ccount`](https://github.com/wooorm/ccount)
    — count characters
*   [`wooorm/direction`](https://github.com/wooorm/direction)
    — detect directionality: left-to-right, right-to-left, or neutral

## Contribute

Yes please!
See [How to Contribute to Open Source][contribute].

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://github.com/wooorm/longest-streak/workflows/main/badge.svg

[build]: https://github.com/wooorm/longest-streak/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/wooorm/longest-streak.svg

[coverage]: https://codecov.io/github/wooorm/longest-streak

[downloads-badge]: https://img.shields.io/npm/dm/longest-streak.svg

[downloads]: https://www.npmjs.com/package/longest-streak

[size-badge]: https://img.shields.io/bundlephobia/minzip/longest-streak.svg

[size]: https://bundlephobia.com/result?p=longest-streak

[npm]: https://docs.npmjs.com/cli/install

[skypack]: https://www.skypack.dev

[license]: license

[author]: https://wooorm.com

[esm]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

[typescript]: https://www.typescriptlang.org

[contribute]: https://opensource.guide/how-to-contribute/
