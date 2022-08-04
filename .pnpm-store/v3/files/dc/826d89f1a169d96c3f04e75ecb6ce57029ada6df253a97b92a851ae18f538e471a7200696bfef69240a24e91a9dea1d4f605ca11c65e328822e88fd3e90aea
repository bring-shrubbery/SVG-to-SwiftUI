"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeNodesFromOriginalCode = void 0;
/** Escapes a string literal to be passed to new RegExp. See: https://stackoverflow.com/a/6969486/480608.
 * @param s the string to escape
 */
var escapeRegExp = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
/**
 * Removes imports from original file
 * @param code the whole file as text
 * @param nodes to be removed
 */
var removeNodesFromOriginalCode = function (code, nodes) {
    var text = code;
    for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
        var node = nodes_1[_i];
        var start = Number(node.start);
        var end = Number(node.end);
        if (Number.isSafeInteger(start) && Number.isSafeInteger(end)) {
            text = text.replace(
            // only replace imports at the beginning of the line (ignoring whitespace)
            // otherwise matching commented imports will be replaced
            new RegExp('^\\s*' + escapeRegExp(code.substring(start, end)), 'm'), '');
        }
    }
    return text;
};
exports.removeNodesFromOriginalCode = removeNodesFromOriginalCode;
