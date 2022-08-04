"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
var prettier_1 = require("prettier");
var get_all_comments_from_nodes_1 = require("../get-all-comments-from-nodes");
var get_import_nodes_1 = require("../get-import-nodes");
var get_sorted_nodes_1 = require("../get-sorted-nodes");
var remove_nodes_from_original_code_1 = require("../remove-nodes-from-original-code");
var code = "// first comment\n// second comment\nimport z from 'z';\nimport c from 'c';\nimport g from 'g';\nimport t from 't';\nimport k from 'k';\n// import a from 'a';\n  // import a from 'a';\nimport a from 'a';\n";
test('it should remove nodes from the original code', function () {
    var importNodes = get_import_nodes_1.getImportNodes(code);
    var sortedNodes = get_sorted_nodes_1.getSortedNodes(importNodes, {
        importOrder: [],
        importOrderCaseInsensitive: false,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: false,
    });
    var allCommentsFromImports = get_all_comments_from_nodes_1.getAllCommentsFromNodes(sortedNodes);
    var commentAndImportsToRemoveFromCode = __spreadArray(__spreadArray([], sortedNodes), allCommentsFromImports);
    var codeWithoutImportDeclarations = remove_nodes_from_original_code_1.removeNodesFromOriginalCode(code, commentAndImportsToRemoveFromCode);
    var result = prettier_1.format(codeWithoutImportDeclarations, { parser: 'babel' });
    expect(result).toEqual('');
});
