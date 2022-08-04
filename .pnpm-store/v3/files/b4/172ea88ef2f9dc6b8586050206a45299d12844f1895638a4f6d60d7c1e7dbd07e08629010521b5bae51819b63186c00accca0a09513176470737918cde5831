"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSortedImportSpecifiers = void 0;
var natural_sort_1 = require("../natural-sort");
/**
 * This function returns import nodes with alphabetically sorted module
 * specifiers
 * @param node Import declaration node
 */
var getSortedImportSpecifiers = function (node) {
    node.specifiers.sort(function (a, b) {
        if (a.type !== b.type) {
            return a.type === 'ImportDefaultSpecifier' ? -1 : 1;
        }
        return natural_sort_1.naturalSort(a.local.name, b.local.name);
    });
    return node;
};
exports.getSortedImportSpecifiers = getSortedImportSpecifiers;
