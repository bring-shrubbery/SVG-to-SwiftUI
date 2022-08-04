"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var get_all_comments_from_nodes_1 = require("../get-all-comments-from-nodes");
var get_import_nodes_1 = require("../get-import-nodes");
var get_sorted_nodes_1 = require("../get-sorted-nodes");
var getSortedImportNodes = function (code, options) {
    var importNodes = get_import_nodes_1.getImportNodes(code, options);
    return get_sorted_nodes_1.getSortedNodes(importNodes, {
        importOrder: [],
        importOrderCaseInsensitive: false,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: false,
    });
};
var getComments = function (commentNodes) {
    return commentNodes.map(function (node) { return node.value; });
};
test('it returns empty array when there is no comment', function () {
    var result = getSortedImportNodes("import z from 'z';\n    ");
    var commentNodes = get_all_comments_from_nodes_1.getAllCommentsFromNodes(result);
    var comments = getComments(commentNodes);
    expect(comments).toEqual([]);
});
test('it returns single comment of a node', function () {
    var result = getSortedImportNodes("// first comment\nimport z from 'z';\n");
    var commentNodes = get_all_comments_from_nodes_1.getAllCommentsFromNodes(result);
    var comments = getComments(commentNodes);
    expect(comments).toEqual([' first comment']);
});
test('it returns all comments for a node', function () {
    var result = getSortedImportNodes("// first comment\n// second comment\nimport z from 'z';\n");
    var commentNodes = get_all_comments_from_nodes_1.getAllCommentsFromNodes(result);
    var comments = getComments(commentNodes);
    expect(comments).toEqual([' first comment', ' second comment']);
});
test('it returns comment block for a node', function () {
    var result = getSortedImportNodes("\n/**\n * some block\n */\nimport z from 'z';\n");
    var commentNodes = get_all_comments_from_nodes_1.getAllCommentsFromNodes(result);
    var comments = getComments(commentNodes);
    expect(comments).toEqual(['*\n * some block\n ']);
});
