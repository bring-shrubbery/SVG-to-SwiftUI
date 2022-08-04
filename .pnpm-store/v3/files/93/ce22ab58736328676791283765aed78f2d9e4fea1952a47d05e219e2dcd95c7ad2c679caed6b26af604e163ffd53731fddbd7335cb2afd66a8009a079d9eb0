'use strict';
var __spreadArray =
    (this && this.__spreadArray) ||
    function (to, from) {
        for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
            to[j] = from[i];
        return to;
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.getParserPlugins = void 0;
var constants_1 = require('../constants');
/**
 * Returns a list of babel parser plugin names
 * @param prettierParser name of the parser recognized by prettier
 * @returns list of parser plugins to be passed to babel parser
 */
var getParserPlugins = function (prettierParser) {
    var isFlow = prettierParser === constants_1.flow;
    var isTypescript = prettierParser === constants_1.typescript;
    // In case of typescript as prettier parser, we pass the following
    // decoratorsLegacy, classProperties are passed in case of angular
    // projects.
    var tsPlugins = [
        constants_1.typescript,
        constants_1.jsx,
        constants_1.decoratorsLegacy,
        constants_1.classProperties,
    ];
    return __spreadArray(
        __spreadArray([], isFlow ? [constants_1.flow] : []),
        isTypescript ? tsPlugins : [],
    );
};
exports.getParserPlugins = getParserPlugins;
