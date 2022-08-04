"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCodeFromAst = void 0;
var generator_1 = __importDefault(require("@babel/generator"));
var types_1 = require("@babel/types");
var constants_1 = require("../constants");
var get_all_comments_from_nodes_1 = require("./get-all-comments-from-nodes");
var remove_nodes_from_original_code_1 = require("./remove-nodes-from-original-code");
/**
 * This function generate a code string from the passed nodes.
 * @param nodes all imports
 * @param originalCode
 */
var getCodeFromAst = function (nodes, originalCode, interpreter) {
    var allCommentsFromImports = get_all_comments_from_nodes_1.getAllCommentsFromNodes(nodes);
    var nodesToRemoveFromCode = __spreadArray(__spreadArray(__spreadArray([], nodes), allCommentsFromImports), (interpreter ? [interpreter] : []));
    var codeWithoutImportsAndInterpreter = remove_nodes_from_original_code_1.removeNodesFromOriginalCode(originalCode, nodesToRemoveFromCode);
    var newAST = types_1.file({
        type: 'Program',
        body: nodes,
        directives: [],
        sourceType: 'module',
        interpreter: interpreter,
        sourceFile: '',
        leadingComments: [],
        innerComments: [],
        trailingComments: [],
        start: 0,
        end: 0,
        loc: {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 },
        },
    });
    var code = generator_1.default(newAST).code;
    return (code.replace(/"PRETTIER_PLUGIN_SORT_IMPORTS_NEW_LINE";/gi, constants_1.newLineCharacters) + codeWithoutImportsAndInterpreter.trim());
};
exports.getCodeFromAst = getCodeFromAst;
