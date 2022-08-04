"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var prettier_1 = require("prettier");
var get_code_from_ast_1 = require("../get-code-from-ast");
var get_import_nodes_1 = require("../get-import-nodes");
var get_sorted_nodes_1 = require("../get-sorted-nodes");
test('it sorts imports correctly', function () {
    var code = "// first comment\n// second comment\nimport z from 'z';\nimport c from 'c';\nimport g from 'g';\nimport t from 't';\nimport k from 'k';\nimport a from 'a';\n";
    var importNodes = get_import_nodes_1.getImportNodes(code);
    var sortedNodes = get_sorted_nodes_1.getSortedNodes(importNodes, {
        importOrder: [],
        importOrderCaseInsensitive: false,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: false,
    });
    var formatted = get_code_from_ast_1.getCodeFromAst(sortedNodes, code, null);
    expect(prettier_1.format(formatted, { parser: 'babel' })).toEqual("// first comment\n// second comment\nimport a from \"a\";\nimport c from \"c\";\nimport g from \"g\";\nimport k from \"k\";\nimport t from \"t\";\nimport z from \"z\";\n");
});
