"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustCommentsOnSortedNodes = void 0;
var types_1 = require("@babel/types");
var lodash_1 = require("lodash");
/**
 * Takes the original nodes before sorting and the final nodes after sorting.
 * Adjusts the comments on the final nodes so that they match the comments as
 * they were in the original nodes.
 * @param nodes A list of nodes in the order as they were originally.
 * @param finalNodes The same set of nodes, but in the final sorting order.
 */
var adjustCommentsOnSortedNodes = function (nodes, finalNodes) {
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
};
exports.adjustCommentsOnSortedNodes = adjustCommentsOnSortedNodes;
