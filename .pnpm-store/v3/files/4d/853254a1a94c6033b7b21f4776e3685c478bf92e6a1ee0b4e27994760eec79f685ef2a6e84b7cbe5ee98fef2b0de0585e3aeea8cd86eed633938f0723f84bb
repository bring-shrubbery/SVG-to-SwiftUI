"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preprocessor = void 0;
var parser_1 = require("@babel/parser");
var traverse_1 = __importDefault(require("@babel/traverse"));
var types_1 = require("@babel/types");
var get_code_from_ast_1 = require("./utils/get-code-from-ast");
var get_experimental_parser_plugins_1 = require("./utils/get-experimental-parser-plugins");
var get_sorted_nodes_1 = require("./utils/get-sorted-nodes");
function preprocessor(code, options) {
    var importOrderParserPlugins = options.importOrderParserPlugins, importOrder = options.importOrder, importOrderCaseInsensitive = options.importOrderCaseInsensitive, importOrderSeparation = options.importOrderSeparation, importOrderGroupNamespaceSpecifiers = options.importOrderGroupNamespaceSpecifiers, importOrderSortSpecifiers = options.importOrderSortSpecifiers;
    var importNodes = [];
    var parserOptions = {
        sourceType: 'module',
        plugins: get_experimental_parser_plugins_1.getExperimentalParserPlugins(importOrderParserPlugins),
    };
    var ast = parser_1.parse(code, parserOptions);
    var interpreter = ast.program.interpreter;
    traverse_1.default(ast, {
        ImportDeclaration: function (path) {
            var tsModuleParent = path.findParent(function (p) {
                return types_1.isTSModuleDeclaration(p);
            });
            if (!tsModuleParent) {
                importNodes.push(path.node);
            }
        },
    });
    // short-circuit if there are no import declaration
    if (importNodes.length === 0)
        return code;
    var allImports = get_sorted_nodes_1.getSortedNodes(importNodes, {
        importOrder: importOrder,
        importOrderCaseInsensitive: importOrderCaseInsensitive,
        importOrderSeparation: importOrderSeparation,
        importOrderGroupNamespaceSpecifiers: importOrderGroupNamespaceSpecifiers,
        importOrderSortSpecifiers: importOrderSortSpecifiers,
    });
    return get_code_from_ast_1.getCodeFromAst(allImports, code, interpreter);
}
exports.preprocessor = preprocessor;
