'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = createCacheKey;

function _crypto() {
  const data = require('crypto');

  _crypto = function () {
    return data;
  };

  return data;
}

function _fs() {
  const data = require('fs');

  _fs = function () {
    return data;
  };

  return data;
}

function _path() {
  const data = require('path');

  _path = function () {
    return data;
  };

  return data;
}

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
// eslint-disable-next-line no-restricted-imports
function getGlobalCacheKey(files, values) {
  return [
    process.env.NODE_ENV,
    process.env.BABEL_ENV,
    ...values,
    ...files.map(file => (0, _fs().readFileSync)(file))
  ]
    .reduce(
      (hash, chunk) => hash.update('\0', 'utf8').update(chunk || ''),
      (0, _crypto().createHash)('md5')
    )
    .digest('hex');
}

function getCacheKeyFunction(globalCacheKey) {
  return (sourceText, sourcePath, configString, options) => {
    // Jest 27 passes a single options bag which contains `configString` rather than as a separate argument.
    // We can hide that API difference, though, so this module is usable for both jest@<27 and jest@>=27
    const inferredOptions = options || configString;
    const {config, instrument} = inferredOptions;
    return (0, _crypto().createHash)('md5')
      .update(globalCacheKey)
      .update('\0', 'utf8')
      .update(sourceText)
      .update('\0', 'utf8')
      .update(
        config.rootDir ? (0, _path().relative)(config.rootDir, sourcePath) : ''
      )
      .update('\0', 'utf8')
      .update(instrument ? 'instrument' : '')
      .digest('hex');
  };
}

function createCacheKey(files = [], values = []) {
  return getCacheKeyFunction(getGlobalCacheKey(files, values));
}
