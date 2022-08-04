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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImportNodes = void 0;
var parser_1 = require("@babel/parser");
var traverse_1 = __importDefault(require("@babel/traverse"));
var types_1 = require("@babel/types");
var getImportNodes = function (code, options) {
    var importNodes = [];
    var ast = parser_1.parse(code, __assign(__assign({}, options), { sourceType: 'module' }));
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
    return importNodes;
};
exports.getImportNodes = getImportNodes;
