"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSortedNodes = void 0;
var types_1 = require("@babel/types");
var lodash_1 = require("lodash");
var constants_1 = require("../constants");
var natural_sort_1 = require("../natural-sort");
var get_import_nodes_matched_group_1 = require("./get-import-nodes-matched-group");
var get_sorted_import_specifiers_1 = require("./get-sorted-import-specifiers");
var get_sorted_nodes_group_1 = require("./get-sorted-nodes-group");
/**
 * This function returns all the nodes which are in the importOrder array.
 * The plugin considered these import nodes as local import declarations.
 * @param nodes all import nodes
 * @param options
 */
var getSortedNodes = function (nodes, options) {
    natural_sort_1.naturalSort.insensitive = options.importOrderCaseInsensitive;
    var importOrder = options.importOrder;
    var importOrderSeparation = options.importOrderSeparation, importOrderSortSpecifiers = options.importOrderSortSpecifiers, importOrderGroupNamespaceSpecifiers = options.importOrderGroupNamespaceSpecifiers;
    var originalNodes = nodes.map(lodash_1.clone);
    var finalNodes = [];
    if (!importOrder.includes(constants_1.THIRD_PARTY_MODULES_SPECIAL_WORD)) {
        importOrder = __spreadArray([constants_1.THIRD_PARTY_MODULES_SPECIAL_WORD], importOrder);
    }
    var importOrderGroups = importOrder.reduce(function (groups, regexp) {
        var _a;
        return (__assign(__assign({}, groups), (_a = {}, _a[regexp] = [], _a)));
    }, {});
    var importOrderWithOutThirdPartyPlaceholder = importOrder.filter(function (group) { return group !== constants_1.THIRD_PARTY_MODULES_SPECIAL_WORD; });
    for (var _i = 0, originalNodes_1 = originalNodes; _i < originalNodes_1.length; _i++) {
        var node = originalNodes_1[_i];
        var matchedGroup = get_import_nodes_matched_group_1.getImportNodesMatchedGroup(node, importOrderWithOutThirdPartyPlaceholder);
        importOrderGroups[matchedGroup].push(node);
    }
    for (var _a = 0, importOrder_1 = importOrder; _a < importOrder_1.length; _a++) {
        var group = importOrder_1[_a];
        var groupNodes = importOrderGroups[group];
        if (groupNodes.length === 0)
            continue;
        var sortedInsideGroup = get_sorted_nodes_group_1.getSortedNodesGroup(groupNodes, {
            importOrderGroupNamespaceSpecifiers: importOrderGroupNamespaceSpecifiers,
        });
        // Sort the import specifiers
        if (importOrderSortSpecifiers) {
            sortedInsideGroup.forEach(function (node) {
                return get_sorted_import_specifiers_1.getSortedImportSpecifiers(node);
            });
        }
        finalNodes.push.apply(finalNodes, sortedInsideGroup);
        if (importOrderSeparation) {
            finalNodes.push(constants_1.newLineNode);
        }
    }
    if (finalNodes.length > 0 && !importOrderSeparation) {
        // a newline after all imports
        finalNodes.push(constants_1.newLineNode);
    }
    // maintain a copy of the nodes to extract comments from
    var finalNodesClone = finalNodes.map(lodash_1.clone);
    var firstNodesComments = nodes[0].leadingComments;
    // Remove all comments from sorted nodes
    finalNodes.forEach(types_1.removeComments);
    // insert comments other than the first comments
    finalNodes.forEach(function (node, index) {
        if (lodash_1.isEqual(nodes[0].loc, node.loc))
            return;
        types_1.addComments(node, 'leading', finalNodesClone[index].leadingComments || []);
    });
    if (firstNodesComments) {
        types_1.addComments(finalNodes[0], 'leading', firstNodesComments);
    }
    return finalNodes;
};
exports.getSortedNodes = getSortedNodes;
