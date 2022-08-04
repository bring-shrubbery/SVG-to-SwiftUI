"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFromFrameworkFilePath = exports.createFromAstroFilePath = exports.createFromTSFilePath = exports.createFromNonAstroFilePath = exports.createFromFilePath = exports.createFromDocument = void 0;
const typescript_1 = __importDefault(require("typescript"));
const astro2tsx_1 = __importDefault(require("../astro2tsx"));
const utils_1 = require("../utils");
const DocumentSnapshot_1 = require("./DocumentSnapshot");
const svelte_language_integration_1 = require("@astrojs/svelte-language-integration");
// Utilities to create Snapshots from different contexts
function createFromDocument(document) {
    const { code } = (0, astro2tsx_1.default)(document.getText());
    return new DocumentSnapshot_1.AstroSnapshot(document, code, typescript_1.default.ScriptKind.TSX);
}
exports.createFromDocument = createFromDocument;
/**
 * Returns an Astro or Framework or a ts/js snapshot from a file path, depending on the file contents.
 * @param filePath path to the file
 * @param createDocument function that is used to create a document in case it's an Astro file
 */
function createFromFilePath(filePath, createDocument) {
    if ((0, utils_1.isAstroFilePath)(filePath)) {
        return createFromAstroFilePath(filePath, createDocument);
    }
    else if ((0, utils_1.isFrameworkFilePath)(filePath)) {
        const framework = (0, utils_1.getFrameworkFromFilePath)(filePath);
        return createFromFrameworkFilePath(filePath, framework);
    }
    else {
        return createFromTSFilePath(filePath);
    }
}
exports.createFromFilePath = createFromFilePath;
/**
 * Return a Framework or a TS snapshot from a file path, depending on the file contents
 * Unlike createFromFilePath, this does not support creating an Astro snapshot
 */
function createFromNonAstroFilePath(filePath) {
    if ((0, utils_1.isFrameworkFilePath)(filePath)) {
        const framework = (0, utils_1.getFrameworkFromFilePath)(filePath);
        return createFromFrameworkFilePath(filePath, framework);
    }
    else {
        return createFromTSFilePath(filePath);
    }
}
exports.createFromNonAstroFilePath = createFromNonAstroFilePath;
/**
 * Returns a ts/js snapshot from a file path.
 * @param filePath path to the js/ts file
 * @param options options that apply in case it's a svelte file
 */
function createFromTSFilePath(filePath) {
    var _a;
    const originalText = (_a = typescript_1.default.sys.readFile(filePath)) !== null && _a !== void 0 ? _a : '';
    return new DocumentSnapshot_1.TypeScriptDocumentSnapshot(0, filePath, originalText);
}
exports.createFromTSFilePath = createFromTSFilePath;
/**
 * Returns an Astro snapshot from a file path.
 * @param filePath path to the Astro file
 * @param createDocument function that is used to create a document
 */
function createFromAstroFilePath(filePath, createDocument) {
    var _a;
    const originalText = (_a = typescript_1.default.sys.readFile(filePath)) !== null && _a !== void 0 ? _a : '';
    return createFromDocument(createDocument(filePath, originalText));
}
exports.createFromAstroFilePath = createFromAstroFilePath;
function createFromFrameworkFilePath(filePath, framework) {
    var _a;
    const originalText = (_a = typescript_1.default.sys.readFile(filePath)) !== null && _a !== void 0 ? _a : '';
    let code = '';
    if (framework === 'svelte') {
        code = (0, svelte_language_integration_1.toTSX)(originalText);
    }
    else {
        code = 'export default function(props: Record<string, any>): any {<div></div>}';
    }
    return new DocumentSnapshot_1.TypeScriptDocumentSnapshot(0, filePath, code, typescript_1.default.ScriptKind.TSX);
}
exports.createFromFrameworkFilePath = createFromFrameworkFilePath;
