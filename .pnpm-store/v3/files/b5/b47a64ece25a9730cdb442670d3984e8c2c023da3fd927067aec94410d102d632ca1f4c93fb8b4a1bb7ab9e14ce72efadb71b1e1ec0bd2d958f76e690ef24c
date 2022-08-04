"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImportNodesMatchedGroup = void 0;
var constants_1 = require("../constants");
/**
 * Get the regexp group to keep the import nodes.
 * @param node
 * @param importOrder
 */
var getImportNodesMatchedGroup = function (node, importOrder) {
    var groupWithRegExp = importOrder.map(function (group) { return ({
        group: group,
        regExp: new RegExp(group),
    }); });
    for (var _i = 0, groupWithRegExp_1 = groupWithRegExp; _i < groupWithRegExp_1.length; _i++) {
        var _a = groupWithRegExp_1[_i], group = _a.group, regExp = _a.regExp;
        var matched = node.source.value.match(regExp) !== null;
        if (matched)
            return group;
    }
    return constants_1.THIRD_PARTY_MODULES_SPECIAL_WORD;
};
exports.getImportNodesMatchedGroup = getImportNodesMatchedGroup;
