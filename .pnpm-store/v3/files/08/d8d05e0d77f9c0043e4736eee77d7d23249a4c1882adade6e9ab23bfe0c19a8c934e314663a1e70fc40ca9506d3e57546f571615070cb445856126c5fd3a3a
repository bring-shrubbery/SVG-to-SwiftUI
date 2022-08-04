"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSortedNodesGroup = void 0;
var natural_sort_1 = require("../natural-sort");
var getSortedNodesGroup = function (imports, options) {
    return imports.sort(function (a, b) {
        if (options.importOrderGroupNamespaceSpecifiers) {
            var diff = namespaceSpecifierSort(a, b);
            if (diff !== 0)
                return diff;
        }
        return natural_sort_1.naturalSort(a.source.value, b.source.value);
    });
};
exports.getSortedNodesGroup = getSortedNodesGroup;
function namespaceSpecifierSort(a, b) {
    var aFirstSpecifier = a.specifiers.find(function (s) { return s.type === 'ImportNamespaceSpecifier'; })
        ? 1
        : 0;
    var bFirstSpecifier = b.specifiers.find(function (s) { return s.type === 'ImportNamespaceSpecifier'; })
        ? 1
        : 0;
    return bFirstSpecifier - aFirstSpecifier;
}
