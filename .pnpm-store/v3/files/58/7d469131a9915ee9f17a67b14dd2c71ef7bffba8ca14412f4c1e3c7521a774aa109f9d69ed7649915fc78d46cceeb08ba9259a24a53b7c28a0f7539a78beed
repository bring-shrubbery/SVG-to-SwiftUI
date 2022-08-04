"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCommentsFromNodes = void 0;
var getAllCommentsFromNodes = function (nodes) {
    return nodes.reduce(function (acc, node) {
        if (Array.isArray(node.leadingComments) &&
            node.leadingComments.length > 0) {
            acc = __spreadArray(__spreadArray([], acc), node.leadingComments);
        }
        return acc;
    }, []);
};
exports.getAllCommentsFromNodes = getAllCommentsFromNodes;
