"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSortedNodesModulesNames = void 0;
var getSortedNodesModulesNames = function (modules) {
    return modules
        .filter(function (m) {
        return [
            'ImportSpecifier',
            'ImportDefaultSpecifier',
            'ImportNamespaceSpecifier',
        ].includes(m.type);
    })
        .map(function (m) { return m.local.name; });
}; // TODO: get from specifier
exports.getSortedNodesModulesNames = getSortedNodesModulesNames;
