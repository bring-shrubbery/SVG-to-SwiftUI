# unherit

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]

Create a custom constructor which can be modified without affecting the original
class.

## Install

This package is ESM only: Node 12+ is needed to use it and it must be `import`ed
instead of `require`d.

[npm][]:

```sh
npm install unherit
```

## Use

```js
import {EventEmitter} from 'events'
import {unherit} from 'unherit'

// Create a private class which acts just like `EventEmitter`.
var Emitter = unherit(EventEmitter)

Emitter.prototype.defaultMaxListeners = 0
// Now, all instances of `Emitter` have no maximum listeners, without affecting
// other `EventEmitter`s.

new Emitter().defaultMaxListeners === 0 // => true
new EventEmitter().defaultMaxListeners === undefined // => true
new Emitter() instanceof EventEmitter // => true
```

## API

This package exports the following identifiers: `unherit`.
There is no default export.

### `unherit(Super)`

Create a custom constructor (`Function`) from `Super` (`Function`) which can be
modified without affecting the original class.

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://github.com/wooorm/unherit/workflows/main/badge.svg

[build]: https://github.com/wooorm/unherit/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/wooorm/unherit.svg

[coverage]: https://codecov.io/github/wooorm/unherit

[downloads-badge]: https://img.shields.io/npm/dm/unherit.svg

[downloads]: https://www.npmjs.com/package/unherit

[size-badge]: https://img.shields.io/bundlephobia/minzip/unherit.svg

[size]: https://bundlephobia.com/result?p=unherit

[npm]: https://docs.npmjs.com/cli/install

[license]: license

[author]: https://wooorm.com
