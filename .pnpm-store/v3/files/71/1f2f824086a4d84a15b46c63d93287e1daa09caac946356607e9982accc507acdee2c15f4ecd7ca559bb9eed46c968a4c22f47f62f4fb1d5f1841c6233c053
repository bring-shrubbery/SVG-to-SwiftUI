"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var get_import_nodes_1 = require("../get-import-nodes");
var get_sorted_import_specifiers_1 = require("../get-sorted-import-specifiers");
var get_sorted_nodes_modules_names_1 = require("../get-sorted-nodes-modules-names");
test('should return correct sorted nodes', function () {
    var code = "import { filter, reduce, eventHandler } from '@server/z';";
    var importNode = get_import_nodes_1.getImportNodes(code)[0];
    var sortedImportSpecifiers = get_sorted_import_specifiers_1.getSortedImportSpecifiers(importNode);
    var specifiersList = get_sorted_nodes_modules_names_1.getSortedNodesModulesNames(sortedImportSpecifiers.specifiers);
    expect(specifiersList).toEqual(['eventHandler', 'filter', 'reduce']);
});
test('should return correct sorted nodes with default import', function () {
    var code = "import Component, { filter, reduce, eventHandler } from '@server/z';";
    var importNode = get_import_nodes_1.getImportNodes(code)[0];
    var sortedImportSpecifiers = get_sorted_import_specifiers_1.getSortedImportSpecifiers(importNode);
    var specifiersList = get_sorted_nodes_modules_names_1.getSortedNodesModulesNames(sortedImportSpecifiers.specifiers);
    expect(specifiersList).toEqual([
        'Component',
        'eventHandler',
        'filter',
        'reduce',
    ]);
});
