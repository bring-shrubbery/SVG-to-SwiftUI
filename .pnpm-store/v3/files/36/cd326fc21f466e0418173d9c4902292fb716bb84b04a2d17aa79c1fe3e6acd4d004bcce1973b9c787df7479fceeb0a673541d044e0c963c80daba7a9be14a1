"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var get_import_nodes_1 = require("../get-import-nodes");
var get_import_nodes_matched_group_1 = require("../get-import-nodes-matched-group");
var code = "// first comment\n// second comment\nimport z from '@server/z';\nimport c from '@server/c';\nimport g from '@ui/g';\nimport t from '@core/t';\nimport k from 'k';\nimport j from './j';\nimport l from './l';\nimport a from '@core/a';\n";
test('should return correct matched groups', function () {
    var importNodes = get_import_nodes_1.getImportNodes(code);
    var importOrder = [
        '^@server/(.*)$',
        '^@core/(.*)$',
        '^@ui/(.*)$',
        '^[./]',
    ];
    var matchedGroups = [];
    for (var _i = 0, importNodes_1 = importNodes; _i < importNodes_1.length; _i++) {
        var importNode = importNodes_1[_i];
        var matchedGroup = get_import_nodes_matched_group_1.getImportNodesMatchedGroup(importNode, importOrder);
        matchedGroups.push(matchedGroup);
    }
    expect(matchedGroups).toEqual([
        '^@server/(.*)$',
        '^@server/(.*)$',
        '^@ui/(.*)$',
        '^@core/(.*)$',
        '<THIRD_PARTY_MODULES>',
        '^[./]',
        '^[./]',
        '^@core/(.*)$',
    ]);
});
test('should return THIRD_PARTY_MODULES as matched group with empty order list', function () {
    var importNodes = get_import_nodes_1.getImportNodes(code);
    var importOrder = [];
    for (var _i = 0, importNodes_2 = importNodes; _i < importNodes_2.length; _i++) {
        var importNode = importNodes_2[_i];
        var matchedGroup = get_import_nodes_matched_group_1.getImportNodesMatchedGroup(importNode, importOrder);
        expect(matchedGroup).toEqual('<THIRD_PARTY_MODULES>');
    }
});
