"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var adjust_comments_on_sorted_nodes_1 = require("../adjust-comments-on-sorted-nodes");
var get_import_nodes_1 = require("../get-import-nodes");
function leadingComments(node) {
    var _a, _b;
    return (_b = (_a = node.leadingComments) === null || _a === void 0 ? void 0 : _a.map(function (c) { return c.value; })) !== null && _b !== void 0 ? _b : [];
}
function trailingComments(node) {
    var _a, _b;
    return (_b = (_a = node.trailingComments) === null || _a === void 0 ? void 0 : _a.map(function (c) { return c.value; })) !== null && _b !== void 0 ? _b : [];
}
test('it preserves the single leading comment for each import declaration', function () {
    var importNodes = get_import_nodes_1.getImportNodes("\n    import {x} from \"c\";\n    // comment b\n    import {y} from \"b\";\n    // comment a\n    import {z} from \"a\";\n    ");
    expect(importNodes).toHaveLength(3);
    var finalNodes = [importNodes[2], importNodes[1], importNodes[0]];
    adjust_comments_on_sorted_nodes_1.adjustCommentsOnSortedNodes(importNodes, finalNodes);
    expect(finalNodes).toHaveLength(3);
    expect(leadingComments(finalNodes[0])).toEqual([' comment a']);
    expect(trailingComments(finalNodes[0])).toEqual([]);
    expect(leadingComments(finalNodes[1])).toEqual([' comment b']);
    expect(trailingComments(finalNodes[1])).toEqual([]);
    expect(leadingComments(finalNodes[2])).toEqual([]);
    expect(trailingComments(finalNodes[2])).toEqual([]);
});
test('it preserves multiple leading comments for each import declaration', function () {
    var importNodes = get_import_nodes_1.getImportNodes("\n    import {x} from \"c\";\n    // comment b1\n    // comment b2\n    // comment b3\n    import {y} from \"b\";\n    // comment a1\n    // comment a2\n    // comment a3\n    import {z} from \"a\";\n    ");
    expect(importNodes).toHaveLength(3);
    var finalNodes = [importNodes[2], importNodes[1], importNodes[0]];
    adjust_comments_on_sorted_nodes_1.adjustCommentsOnSortedNodes(importNodes, finalNodes);
    expect(finalNodes).toHaveLength(3);
    expect(leadingComments(finalNodes[0])).toEqual([
        ' comment a1',
        ' comment a2',
        ' comment a3',
    ]);
    expect(trailingComments(finalNodes[0])).toEqual([]);
    expect(leadingComments(finalNodes[1])).toEqual([
        ' comment b1',
        ' comment b2',
        ' comment b3',
    ]);
    expect(trailingComments(finalNodes[1])).toEqual([]);
    expect(leadingComments(finalNodes[2])).toEqual([]);
    expect(trailingComments(finalNodes[2])).toEqual([]);
});
test('it does not move comments at before all import declarations', function () {
    var importNodes = get_import_nodes_1.getImportNodes("\n    // comment c1\n    // comment c2\n    import {x} from \"c\";\n    import {y} from \"b\";\n    import {z} from \"a\";\n    ");
    expect(importNodes).toHaveLength(3);
    var finalNodes = [importNodes[2], importNodes[1], importNodes[0]];
    adjust_comments_on_sorted_nodes_1.adjustCommentsOnSortedNodes(importNodes, finalNodes);
    expect(finalNodes).toHaveLength(3);
    expect(leadingComments(finalNodes[0])).toEqual([
        ' comment c1',
        ' comment c2',
    ]);
    expect(trailingComments(finalNodes[0])).toEqual([]);
    expect(leadingComments(finalNodes[1])).toEqual([]);
    expect(trailingComments(finalNodes[1])).toEqual([]);
    expect(leadingComments(finalNodes[2])).toEqual([]);
    expect(trailingComments(finalNodes[2])).toEqual([]);
});
test('it does not affect comments after all import declarations', function () {
    var importNodes = get_import_nodes_1.getImportNodes("\n    import {x} from \"c\";\n    import {y} from \"b\";\n    import {z} from \"a\";\n    // comment final 1\n    // comment final 2\n    ");
    expect(importNodes).toHaveLength(3);
    var finalNodes = [importNodes[2], importNodes[1], importNodes[0]];
    adjust_comments_on_sorted_nodes_1.adjustCommentsOnSortedNodes(importNodes, finalNodes);
    expect(finalNodes).toHaveLength(3);
    expect(leadingComments(finalNodes[0])).toEqual([]);
    expect(trailingComments(finalNodes[0])).toEqual([]);
    expect(leadingComments(finalNodes[1])).toEqual([]);
    expect(trailingComments(finalNodes[1])).toEqual([]);
    expect(leadingComments(finalNodes[2])).toEqual([]);
    expect(trailingComments(finalNodes[2])).toEqual([]);
});
