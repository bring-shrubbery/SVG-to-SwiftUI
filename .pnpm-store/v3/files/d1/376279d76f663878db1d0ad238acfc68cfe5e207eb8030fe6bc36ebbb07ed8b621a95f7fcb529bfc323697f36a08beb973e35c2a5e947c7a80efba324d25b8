"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var get_import_nodes_1 = require("../get-import-nodes");
var get_sorted_nodes_1 = require("../get-sorted-nodes");
var get_sorted_nodes_modules_names_1 = require("../get-sorted-nodes-modules-names");
var get_sorted_nodes_names_1 = require("../get-sorted-nodes-names");
var code = "// first comment\n// second comment\nimport z from 'z';\nimport c, { cD } from 'c';\nimport g from 'g';\nimport { tC, tA, tB } from 't';\nimport k, { kE, kB } from 'k';\nimport * as a from 'a';\nimport * as x from 'x';\nimport BY from 'BY';\nimport Ba from 'Ba';\nimport XY from 'XY';\nimport Xa from 'Xa';\n";
test('it returns all sorted nodes', function () {
    var result = get_import_nodes_1.getImportNodes(code);
    var sorted = get_sorted_nodes_1.getSortedNodes(result, {
        importOrder: [],
        importOrderCaseInsensitive: false,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: false,
    });
    expect(get_sorted_nodes_names_1.getSortedNodesNames(sorted)).toEqual([
        'BY',
        'Ba',
        'XY',
        'Xa',
        'a',
        'c',
        'g',
        'k',
        't',
        'x',
        'z',
    ]);
    expect(sorted
        .filter(function (node) { return node.type === 'ImportDeclaration'; })
        .map(function (importDeclaration) {
        return get_sorted_nodes_modules_names_1.getSortedNodesModulesNames(importDeclaration.specifiers);
    })).toEqual([
        ['BY'],
        ['Ba'],
        ['XY'],
        ['Xa'],
        ['a'],
        ['c', 'cD'],
        ['g'],
        ['k', 'kE', 'kB'],
        ['tC', 'tA', 'tB'],
        ['x'],
        ['z'],
    ]);
});
test('it returns all sorted nodes case-insensitive', function () {
    var result = get_import_nodes_1.getImportNodes(code);
    var sorted = get_sorted_nodes_1.getSortedNodes(result, {
        importOrder: [],
        importOrderCaseInsensitive: true,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: false,
    });
    expect(get_sorted_nodes_names_1.getSortedNodesNames(sorted)).toEqual([
        'a',
        'Ba',
        'BY',
        'c',
        'g',
        'k',
        't',
        'x',
        'Xa',
        'XY',
        'z',
    ]);
    expect(sorted
        .filter(function (node) { return node.type === 'ImportDeclaration'; })
        .map(function (importDeclaration) {
        return get_sorted_nodes_modules_names_1.getSortedNodesModulesNames(importDeclaration.specifiers);
    })).toEqual([
        ['a'],
        ['Ba'],
        ['BY'],
        ['c', 'cD'],
        ['g'],
        ['k', 'kE', 'kB'],
        ['tC', 'tA', 'tB'],
        ['x'],
        ['Xa'],
        ['XY'],
        ['z'],
    ]);
});
test('it returns all sorted nodes with sort order', function () {
    var result = get_import_nodes_1.getImportNodes(code);
    var sorted = get_sorted_nodes_1.getSortedNodes(result, {
        importOrder: ['^a$', '^t$', '^k$', '^B'],
        importOrderCaseInsensitive: false,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: false,
    });
    expect(get_sorted_nodes_names_1.getSortedNodesNames(sorted)).toEqual([
        'XY',
        'Xa',
        'c',
        'g',
        'x',
        'z',
        'a',
        't',
        'k',
        'BY',
        'Ba',
    ]);
    expect(sorted
        .filter(function (node) { return node.type === 'ImportDeclaration'; })
        .map(function (importDeclaration) {
        return get_sorted_nodes_modules_names_1.getSortedNodesModulesNames(importDeclaration.specifiers);
    })).toEqual([
        ['XY'],
        ['Xa'],
        ['c', 'cD'],
        ['g'],
        ['x'],
        ['z'],
        ['a'],
        ['tC', 'tA', 'tB'],
        ['k', 'kE', 'kB'],
        ['BY'],
        ['Ba'],
    ]);
});
test('it returns all sorted nodes with sort order case-insensitive', function () {
    var result = get_import_nodes_1.getImportNodes(code);
    var sorted = get_sorted_nodes_1.getSortedNodes(result, {
        importOrder: ['^a$', '^t$', '^k$', '^B'],
        importOrderCaseInsensitive: true,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: false,
    });
    expect(get_sorted_nodes_names_1.getSortedNodesNames(sorted)).toEqual([
        'c',
        'g',
        'x',
        'Xa',
        'XY',
        'z',
        'a',
        't',
        'k',
        'Ba',
        'BY',
    ]);
    expect(sorted
        .filter(function (node) { return node.type === 'ImportDeclaration'; })
        .map(function (importDeclaration) {
        return get_sorted_nodes_modules_names_1.getSortedNodesModulesNames(importDeclaration.specifiers);
    })).toEqual([
        ['c', 'cD'],
        ['g'],
        ['x'],
        ['Xa'],
        ['XY'],
        ['z'],
        ['a'],
        ['tC', 'tA', 'tB'],
        ['k', 'kE', 'kB'],
        ['Ba'],
        ['BY'],
    ]);
});
test('it returns all sorted import nodes with sorted import specifiers', function () {
    var result = get_import_nodes_1.getImportNodes(code);
    var sorted = get_sorted_nodes_1.getSortedNodes(result, {
        importOrder: ['^a$', '^t$', '^k$', '^B'],
        importOrderCaseInsensitive: false,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: true,
    });
    expect(get_sorted_nodes_names_1.getSortedNodesNames(sorted)).toEqual([
        'XY',
        'Xa',
        'c',
        'g',
        'x',
        'z',
        'a',
        't',
        'k',
        'BY',
        'Ba',
    ]);
    expect(sorted
        .filter(function (node) { return node.type === 'ImportDeclaration'; })
        .map(function (importDeclaration) {
        return get_sorted_nodes_modules_names_1.getSortedNodesModulesNames(importDeclaration.specifiers);
    })).toEqual([
        ['XY'],
        ['Xa'],
        ['c', 'cD'],
        ['g'],
        ['x'],
        ['z'],
        ['a'],
        ['tA', 'tB', 'tC'],
        ['k', 'kB', 'kE'],
        ['BY'],
        ['Ba'],
    ]);
});
test('it returns all sorted import nodes with sorted import specifiers with case-insensitive ', function () {
    var result = get_import_nodes_1.getImportNodes(code);
    var sorted = get_sorted_nodes_1.getSortedNodes(result, {
        importOrder: ['^a$', '^t$', '^k$', '^B'],
        importOrderCaseInsensitive: true,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: true,
    });
    expect(get_sorted_nodes_names_1.getSortedNodesNames(sorted)).toEqual([
        'c',
        'g',
        'x',
        'Xa',
        'XY',
        'z',
        'a',
        't',
        'k',
        'Ba',
        'BY',
    ]);
    expect(sorted
        .filter(function (node) { return node.type === 'ImportDeclaration'; })
        .map(function (importDeclaration) {
        return get_sorted_nodes_modules_names_1.getSortedNodesModulesNames(importDeclaration.specifiers);
    })).toEqual([
        ['c', 'cD'],
        ['g'],
        ['x'],
        ['Xa'],
        ['XY'],
        ['z'],
        ['a'],
        ['tA', 'tB', 'tC'],
        ['k', 'kB', 'kE'],
        ['Ba'],
        ['BY'],
    ]);
});
test('it returns all sorted nodes with custom third party modules', function () {
    var result = get_import_nodes_1.getImportNodes(code);
    var sorted = get_sorted_nodes_1.getSortedNodes(result, {
        importOrder: ['^a$', '<THIRD_PARTY_MODULES>', '^t$', '^k$'],
        importOrderSeparation: false,
        importOrderCaseInsensitive: true,
        importOrderGroupNamespaceSpecifiers: false,
        importOrderSortSpecifiers: false,
    });
    expect(get_sorted_nodes_names_1.getSortedNodesNames(sorted)).toEqual([
        'a',
        'Ba',
        'BY',
        'c',
        'g',
        'x',
        'Xa',
        'XY',
        'z',
        't',
        'k',
    ]);
});
test('it returns all sorted nodes with namespace specifiers at the top', function () {
    var result = get_import_nodes_1.getImportNodes(code);
    var sorted = get_sorted_nodes_1.getSortedNodes(result, {
        importOrder: [],
        importOrderCaseInsensitive: false,
        importOrderSeparation: false,
        importOrderGroupNamespaceSpecifiers: true,
        importOrderSortSpecifiers: false,
    });
    expect(get_sorted_nodes_names_1.getSortedNodesNames(sorted)).toEqual([
        'a',
        'x',
        'BY',
        'Ba',
        'XY',
        'Xa',
        'c',
        'g',
        'k',
        't',
        'z',
    ]);
});
