"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRealFilePath = exports.ensureRealAstroFilePath = exports.toRealAstroFilePath = exports.toVirtualFilePath = exports.toVirtualAstroFilePath = exports.isVirtualFilePath = exports.isVirtualSvelteFilePath = exports.isVirtualVueFilePath = exports.isVirtualAstroFilePath = exports.isFrameworkFilePath = exports.isAstroFilePath = exports.isVirtualFrameworkFilePath = exports.getFrameworkFromFilePath = exports.convertToLocationRange = exports.convertRange = exports.mapSeverity = exports.getScriptKindFromFileName = exports.isSubPath = exports.findTsConfigPath = exports.getExtensionFromScriptKind = exports.getCommitCharactersForScriptElement = exports.scriptElementKindToCompletionItemKind = exports.symbolKindFromString = exports.getSemanticTokenLegend = void 0;
const typescript_1 = __importDefault(require("typescript"));
const path_1 = require("path");
const utils_1 = require("../../utils");
const vscode_languageserver_1 = require("vscode-languageserver");
const documents_1 = require("../../core/documents");
function getSemanticTokenLegend() {
    const tokenModifiers = [];
    [
        [0 /* declaration */, vscode_languageserver_1.SemanticTokenModifiers.declaration],
        [1 /* static */, vscode_languageserver_1.SemanticTokenModifiers.static],
        [2 /* async */, vscode_languageserver_1.SemanticTokenModifiers.async],
        [3 /* readonly */, vscode_languageserver_1.SemanticTokenModifiers.readonly],
        [4 /* defaultLibrary */, vscode_languageserver_1.SemanticTokenModifiers.defaultLibrary],
        [5 /* local */, 'local'],
    ].forEach(([tsModifier, legend]) => (tokenModifiers[tsModifier] = legend));
    const tokenTypes = [];
    [
        [0 /* class */, vscode_languageserver_1.SemanticTokenTypes.class],
        [1 /* enum */, vscode_languageserver_1.SemanticTokenTypes.enum],
        [2 /* interface */, vscode_languageserver_1.SemanticTokenTypes.interface],
        [3 /* namespace */, vscode_languageserver_1.SemanticTokenTypes.namespace],
        [4 /* typeParameter */, vscode_languageserver_1.SemanticTokenTypes.typeParameter],
        [5 /* type */, vscode_languageserver_1.SemanticTokenTypes.type],
        [6 /* parameter */, vscode_languageserver_1.SemanticTokenTypes.parameter],
        [7 /* variable */, vscode_languageserver_1.SemanticTokenTypes.variable],
        [8 /* enumMember */, vscode_languageserver_1.SemanticTokenTypes.enumMember],
        [9 /* property */, vscode_languageserver_1.SemanticTokenTypes.property],
        [10 /* function */, vscode_languageserver_1.SemanticTokenTypes.function],
        [11 /* method */, vscode_languageserver_1.SemanticTokenTypes.method],
    ].forEach(([tokenType, legend]) => (tokenTypes[tokenType] = legend));
    return {
        tokenModifiers,
        tokenTypes,
    };
}
exports.getSemanticTokenLegend = getSemanticTokenLegend;
function symbolKindFromString(kind) {
    switch (kind) {
        case 'module':
            return vscode_languageserver_1.SymbolKind.Module;
        case 'class':
            return vscode_languageserver_1.SymbolKind.Class;
        case 'local class':
            return vscode_languageserver_1.SymbolKind.Class;
        case 'interface':
            return vscode_languageserver_1.SymbolKind.Interface;
        case 'enum':
            return vscode_languageserver_1.SymbolKind.Enum;
        case 'enum member':
            return vscode_languageserver_1.SymbolKind.Constant;
        case 'var':
            return vscode_languageserver_1.SymbolKind.Variable;
        case 'local var':
            return vscode_languageserver_1.SymbolKind.Variable;
        case 'function':
            return vscode_languageserver_1.SymbolKind.Function;
        case 'local function':
            return vscode_languageserver_1.SymbolKind.Function;
        case 'method':
            return vscode_languageserver_1.SymbolKind.Method;
        case 'getter':
            return vscode_languageserver_1.SymbolKind.Method;
        case 'setter':
            return vscode_languageserver_1.SymbolKind.Method;
        case 'property':
            return vscode_languageserver_1.SymbolKind.Property;
        case 'constructor':
            return vscode_languageserver_1.SymbolKind.Constructor;
        case 'parameter':
            return vscode_languageserver_1.SymbolKind.Variable;
        case 'type parameter':
            return vscode_languageserver_1.SymbolKind.Variable;
        case 'alias':
            return vscode_languageserver_1.SymbolKind.Variable;
        case 'let':
            return vscode_languageserver_1.SymbolKind.Variable;
        case 'const':
            return vscode_languageserver_1.SymbolKind.Constant;
        case 'JSX attribute':
            return vscode_languageserver_1.SymbolKind.Property;
        default:
            return vscode_languageserver_1.SymbolKind.Variable;
    }
}
exports.symbolKindFromString = symbolKindFromString;
function scriptElementKindToCompletionItemKind(kind) {
    switch (kind) {
        case typescript_1.default.ScriptElementKind.primitiveType:
        case typescript_1.default.ScriptElementKind.keyword:
            return vscode_languageserver_1.CompletionItemKind.Keyword;
        case typescript_1.default.ScriptElementKind.constElement:
            return vscode_languageserver_1.CompletionItemKind.Constant;
        case typescript_1.default.ScriptElementKind.letElement:
        case typescript_1.default.ScriptElementKind.variableElement:
        case typescript_1.default.ScriptElementKind.localVariableElement:
        case typescript_1.default.ScriptElementKind.alias:
            return vscode_languageserver_1.CompletionItemKind.Variable;
        case typescript_1.default.ScriptElementKind.memberVariableElement:
        case typescript_1.default.ScriptElementKind.memberGetAccessorElement:
        case typescript_1.default.ScriptElementKind.memberSetAccessorElement:
            return vscode_languageserver_1.CompletionItemKind.Field;
        case typescript_1.default.ScriptElementKind.functionElement:
            return vscode_languageserver_1.CompletionItemKind.Function;
        case typescript_1.default.ScriptElementKind.memberFunctionElement:
        case typescript_1.default.ScriptElementKind.constructSignatureElement:
        case typescript_1.default.ScriptElementKind.callSignatureElement:
        case typescript_1.default.ScriptElementKind.indexSignatureElement:
            return vscode_languageserver_1.CompletionItemKind.Method;
        case typescript_1.default.ScriptElementKind.enumElement:
            return vscode_languageserver_1.CompletionItemKind.Enum;
        case typescript_1.default.ScriptElementKind.moduleElement:
        case typescript_1.default.ScriptElementKind.externalModuleName:
            return vscode_languageserver_1.CompletionItemKind.Module;
        case typescript_1.default.ScriptElementKind.classElement:
        case typescript_1.default.ScriptElementKind.typeElement:
            return vscode_languageserver_1.CompletionItemKind.Class;
        case typescript_1.default.ScriptElementKind.interfaceElement:
            return vscode_languageserver_1.CompletionItemKind.Interface;
        case typescript_1.default.ScriptElementKind.warning:
        case typescript_1.default.ScriptElementKind.scriptElement:
            return vscode_languageserver_1.CompletionItemKind.File;
        case typescript_1.default.ScriptElementKind.directory:
            return vscode_languageserver_1.CompletionItemKind.Folder;
        case typescript_1.default.ScriptElementKind.string:
            return vscode_languageserver_1.CompletionItemKind.Constant;
    }
    return vscode_languageserver_1.CompletionItemKind.Property;
}
exports.scriptElementKindToCompletionItemKind = scriptElementKindToCompletionItemKind;
function getCommitCharactersForScriptElement(kind) {
    const commitCharacters = [];
    switch (kind) {
        case typescript_1.default.ScriptElementKind.memberGetAccessorElement:
        case typescript_1.default.ScriptElementKind.memberSetAccessorElement:
        case typescript_1.default.ScriptElementKind.constructSignatureElement:
        case typescript_1.default.ScriptElementKind.callSignatureElement:
        case typescript_1.default.ScriptElementKind.indexSignatureElement:
        case typescript_1.default.ScriptElementKind.enumElement:
        case typescript_1.default.ScriptElementKind.interfaceElement:
            commitCharacters.push('.');
            break;
        case typescript_1.default.ScriptElementKind.moduleElement:
        case typescript_1.default.ScriptElementKind.alias:
        case typescript_1.default.ScriptElementKind.constElement:
        case typescript_1.default.ScriptElementKind.letElement:
        case typescript_1.default.ScriptElementKind.variableElement:
        case typescript_1.default.ScriptElementKind.localVariableElement:
        case typescript_1.default.ScriptElementKind.memberVariableElement:
        case typescript_1.default.ScriptElementKind.classElement:
        case typescript_1.default.ScriptElementKind.functionElement:
        case typescript_1.default.ScriptElementKind.memberFunctionElement:
            commitCharacters.push('.', ',');
            commitCharacters.push('(');
            break;
    }
    return commitCharacters.length === 0 ? undefined : commitCharacters;
}
exports.getCommitCharactersForScriptElement = getCommitCharactersForScriptElement;
function getExtensionFromScriptKind(kind) {
    switch (kind) {
        case typescript_1.default.ScriptKind.JSX:
            return typescript_1.default.Extension.Jsx;
        case typescript_1.default.ScriptKind.TS:
            return typescript_1.default.Extension.Ts;
        case typescript_1.default.ScriptKind.TSX:
            return typescript_1.default.Extension.Tsx;
        case typescript_1.default.ScriptKind.JSON:
            return typescript_1.default.Extension.Json;
        case typescript_1.default.ScriptKind.JS:
        default:
            return typescript_1.default.Extension.Js;
    }
}
exports.getExtensionFromScriptKind = getExtensionFromScriptKind;
function findTsConfigPath(fileName, rootUris) {
    const searchDir = (0, path_1.dirname)(fileName);
    const path = typescript_1.default.findConfigFile(searchDir, typescript_1.default.sys.fileExists, 'tsconfig.json') ||
        typescript_1.default.findConfigFile(searchDir, typescript_1.default.sys.fileExists, 'jsconfig.json') ||
        '';
    // Don't return config files that exceed the current workspace context.
    return !!path && rootUris.some((rootUri) => isSubPath(rootUri, path)) ? path : '';
}
exports.findTsConfigPath = findTsConfigPath;
function isSubPath(uri, possibleSubPath) {
    return (0, utils_1.pathToUrl)(possibleSubPath).startsWith(uri);
}
exports.isSubPath = isSubPath;
function getScriptKindFromFileName(fileName) {
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    switch (ext.toLowerCase()) {
        case typescript_1.default.Extension.Js:
            return typescript_1.default.ScriptKind.JS;
        case typescript_1.default.Extension.Jsx:
            return typescript_1.default.ScriptKind.JSX;
        case typescript_1.default.Extension.Ts:
            return typescript_1.default.ScriptKind.TS;
        case typescript_1.default.Extension.Tsx:
            return typescript_1.default.ScriptKind.TSX;
        case typescript_1.default.Extension.Json:
            return typescript_1.default.ScriptKind.JSON;
        default:
            return typescript_1.default.ScriptKind.Unknown;
    }
}
exports.getScriptKindFromFileName = getScriptKindFromFileName;
function mapSeverity(category) {
    switch (category) {
        case typescript_1.default.DiagnosticCategory.Error:
            return vscode_languageserver_1.DiagnosticSeverity.Error;
        case typescript_1.default.DiagnosticCategory.Warning:
            return vscode_languageserver_1.DiagnosticSeverity.Warning;
        case typescript_1.default.DiagnosticCategory.Suggestion:
            return vscode_languageserver_1.DiagnosticSeverity.Hint;
        case typescript_1.default.DiagnosticCategory.Message:
            return vscode_languageserver_1.DiagnosticSeverity.Information;
    }
}
exports.mapSeverity = mapSeverity;
function convertRange(document, range) {
    return vscode_languageserver_1.Range.create(document.positionAt(range.start || 0), document.positionAt((range.start || 0) + (range.length || 0)));
}
exports.convertRange = convertRange;
function convertToLocationRange(defDoc, textSpan) {
    const range = (0, documents_1.mapRangeToOriginal)(defDoc, convertRange(defDoc, textSpan));
    // Some definition like the svelte component class definition don't exist in the original, so we map to 0,1
    if (range.start.line < 0) {
        range.start.line = 0;
        range.start.character = 1;
    }
    if (range.end.line < 0) {
        range.end = range.start;
    }
    return range;
}
exports.convertToLocationRange = convertToLocationRange;
const VirtualExtension = {
    ts: 'ts',
    tsx: 'tsx',
};
function getFrameworkFromFilePath(filePath) {
    filePath = ensureRealFilePath(filePath);
    return (0, path_1.extname)(filePath).substring(1);
}
exports.getFrameworkFromFilePath = getFrameworkFromFilePath;
function isVirtualFrameworkFilePath(ext, virtualExt, filePath) {
    return filePath.endsWith('.' + ext + '.' + virtualExt);
}
exports.isVirtualFrameworkFilePath = isVirtualFrameworkFilePath;
function isAstroFilePath(filePath) {
    return filePath.endsWith('.astro');
}
exports.isAstroFilePath = isAstroFilePath;
function isFrameworkFilePath(filePath) {
    return filePath.endsWith('.svelte') || filePath.endsWith('.vue');
}
exports.isFrameworkFilePath = isFrameworkFilePath;
function isVirtualAstroFilePath(filePath) {
    return isVirtualFrameworkFilePath('astro', VirtualExtension.tsx, filePath);
}
exports.isVirtualAstroFilePath = isVirtualAstroFilePath;
function isVirtualVueFilePath(filePath) {
    return isVirtualFrameworkFilePath('vue', VirtualExtension.tsx, filePath);
}
exports.isVirtualVueFilePath = isVirtualVueFilePath;
function isVirtualSvelteFilePath(filePath) {
    return isVirtualFrameworkFilePath('svelte', VirtualExtension.tsx, filePath);
}
exports.isVirtualSvelteFilePath = isVirtualSvelteFilePath;
function isVirtualFilePath(filePath) {
    return isVirtualAstroFilePath(filePath) || isVirtualVueFilePath(filePath) || isVirtualSvelteFilePath(filePath);
}
exports.isVirtualFilePath = isVirtualFilePath;
function toVirtualAstroFilePath(filePath) {
    if (isVirtualAstroFilePath(filePath)) {
        return filePath;
    }
    else if (isAstroFilePath(filePath)) {
        return `${filePath}.tsx`;
    }
    else {
        return filePath;
    }
}
exports.toVirtualAstroFilePath = toVirtualAstroFilePath;
function toVirtualFilePath(filePath) {
    if (isVirtualFilePath(filePath)) {
        return filePath;
    }
    else if (isFrameworkFilePath(filePath) || isAstroFilePath(filePath)) {
        return `${filePath}.tsx`;
    }
    else {
        return filePath;
    }
}
exports.toVirtualFilePath = toVirtualFilePath;
function toRealAstroFilePath(filePath) {
    return filePath.slice(0, -'.tsx'.length);
}
exports.toRealAstroFilePath = toRealAstroFilePath;
function ensureRealAstroFilePath(filePath) {
    return isVirtualAstroFilePath(filePath) ? toRealAstroFilePath(filePath) : filePath;
}
exports.ensureRealAstroFilePath = ensureRealAstroFilePath;
function ensureRealFilePath(filePath) {
    if (isVirtualFilePath(filePath)) {
        let extLen = filePath.endsWith('.tsx') ? 4 : 3;
        return filePath.slice(0, filePath.length - extLen);
    }
    else {
        return filePath;
    }
}
exports.ensureRealFilePath = ensureRealFilePath;
