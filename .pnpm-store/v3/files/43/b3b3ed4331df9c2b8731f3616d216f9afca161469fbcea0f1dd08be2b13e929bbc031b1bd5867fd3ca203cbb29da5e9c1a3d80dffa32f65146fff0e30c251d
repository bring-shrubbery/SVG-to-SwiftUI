"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSortedNodesNames = void 0;
var getSortedNodesNames = function (imports) {
    return imports
        .filter(function (i) { return i.type === 'ImportDeclaration'; })
        .map(function (i) { return i.source.value; });
}; // TODO: get from specifier
exports.getSortedNodesNames = getSortedNodesNames;
