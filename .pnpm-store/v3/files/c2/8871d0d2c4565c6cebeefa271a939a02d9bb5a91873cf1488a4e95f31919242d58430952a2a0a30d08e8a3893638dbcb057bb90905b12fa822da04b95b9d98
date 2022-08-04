"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompletionsProviderImpl = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const typescript_1 = __importDefault(require("typescript"));
const utils_1 = require("../../../core/documents/utils");
const utils_2 = require("../../../utils");
const utils_3 = require("../../typescript/utils");
const vscode_html_languageservice_1 = require("vscode-html-languageservice");
const astro_attributes_1 = require("../../html/features/astro-attributes");
const utils_4 = require("../../html/utils");
class CompletionsProviderImpl {
    constructor(docManager, languageServiceManager) {
        this.directivesHTMLLang = (0, vscode_html_languageservice_1.getLanguageService)({
            customDataProviders: [astro_attributes_1.astroDirectives],
            useDefaultDataProvider: false,
        });
        this.docManager = docManager;
        this.languageServiceManager = languageServiceManager;
    }
    async getCompletions(document, position, completionContext) {
        const doc = this.docManager.get(document.uri);
        if (!doc)
            return null;
        let items = [];
        if ((completionContext === null || completionContext === void 0 ? void 0 : completionContext.triggerCharacter) === '-') {
            const frontmatter = this.getComponentScriptCompletion(doc, position, completionContext);
            if (frontmatter)
                items.push(frontmatter);
        }
        const html = document.html;
        const offset = document.offsetAt(position);
        if ((0, utils_1.isInComponentStartTag)(html, offset)) {
            const props = await this.getPropCompletions(document, position, completionContext);
            if (props.length) {
                items.push(...props);
            }
            const node = html.findNodeAt(offset);
            const isAstro = await this.isAstroComponent(document, node);
            if (!isAstro) {
                const directives = (0, utils_4.removeDataAttrCompletion)(this.directivesHTMLLang.doComplete(document, position, html).items);
                items.push(...directives);
            }
        }
        return vscode_languageserver_1.CompletionList.create(items, true);
    }
    getComponentScriptCompletion(document, position, completionContext) {
        const base = {
            kind: vscode_languageserver_1.CompletionItemKind.Snippet,
            label: '---',
            sortText: '\0',
            preselect: true,
            detail: 'Component script',
            insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet,
            commitCharacters: ['-'],
        };
        const prefix = document.getLineUntilOffset(document.offsetAt(position));
        if (document.astroMeta.frontmatter.state === null) {
            return {
                ...base,
                insertText: '---\n$0\n---',
                textEdit: prefix.match(/^\s*\-+/)
                    ? vscode_languageserver_1.TextEdit.replace({ start: { ...position, character: 0 }, end: position }, '---\n$0\n---')
                    : undefined,
            };
        }
        if (document.astroMeta.frontmatter.state === 'open') {
            return {
                ...base,
                insertText: '---',
                textEdit: prefix.match(/^\s*\-+/)
                    ? vscode_languageserver_1.TextEdit.replace({ start: { ...position, character: 0 }, end: position }, '---')
                    : undefined,
            };
        }
        return null;
    }
    async getPropCompletions(document, position, completionContext) {
        const offset = document.offsetAt(position);
        const html = document.html;
        const node = html.findNodeAt(offset);
        if (!(0, utils_2.isPossibleComponent)(node)) {
            return [];
        }
        const inAttribute = node.start + node.tag.length < offset;
        if (!inAttribute) {
            return [];
        }
        if ((completionContext === null || completionContext === void 0 ? void 0 : completionContext.triggerCharacter) === '/' || (completionContext === null || completionContext === void 0 ? void 0 : completionContext.triggerCharacter) === '>') {
            return [];
        }
        // If inside of attribute value, skip.
        if (completionContext &&
            completionContext.triggerKind === vscode_languageserver_1.CompletionTriggerKind.TriggerCharacter &&
            completionContext.triggerCharacter === '"') {
            return [];
        }
        const componentName = node.tag;
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        // Get the source file
        const tsFilePath = (0, utils_3.toVirtualAstroFilePath)(tsDoc.filePath);
        const program = lang.getProgram();
        const sourceFile = program === null || program === void 0 ? void 0 : program.getSourceFile(tsFilePath);
        const typeChecker = program === null || program === void 0 ? void 0 : program.getTypeChecker();
        if (!sourceFile || !typeChecker) {
            return [];
        }
        // Get the import statement
        const imp = this.getImportedSymbol(sourceFile, componentName);
        const importType = imp && typeChecker.getTypeAtLocation(imp);
        if (!importType) {
            return [];
        }
        // Get the component's props type
        const componentType = this.getPropType(importType, typeChecker);
        if (!componentType) {
            return [];
        }
        let completionItems = [];
        // Add completions for this component's props type properties
        const properties = componentType.getProperties().filter((property) => property.name !== 'children') || [];
        properties.forEach((property) => {
            let completionItem = this.getCompletionItemForProperty(property, typeChecker);
            completionItems.push(completionItem);
        });
        // Ensure that props shows up first as a completion, despite this plugin being ran after the HTML one
        completionItems = completionItems.map((item) => {
            return { ...item, sortText: '_' };
        });
        return completionItems;
    }
    getImportedSymbol(sourceFile, identifier) {
        for (let list of sourceFile.getChildren()) {
            for (let node of list.getChildren()) {
                if (typescript_1.default.isImportDeclaration(node)) {
                    let clauses = node.importClause;
                    if (!clauses)
                        return null;
                    let namedImport = clauses.getChildAt(0);
                    if (typescript_1.default.isNamedImports(namedImport)) {
                        for (let imp of namedImport.elements) {
                            // Iterate the named imports
                            if (imp.name.getText() === identifier) {
                                return imp;
                            }
                        }
                    }
                    else if (typescript_1.default.isIdentifier(namedImport)) {
                        if (namedImport.getText() === identifier) {
                            return namedImport;
                        }
                    }
                }
            }
        }
        return null;
    }
    getPropType(type, typeChecker) {
        const sym = type === null || type === void 0 ? void 0 : type.getSymbol();
        if (!sym) {
            return null;
        }
        for (const decl of (sym === null || sym === void 0 ? void 0 : sym.getDeclarations()) || []) {
            const fileName = (0, utils_3.toVirtualFilePath)(decl.getSourceFile().fileName);
            if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
                if (!typescript_1.default.isFunctionDeclaration(decl)) {
                    console.error(`We only support function components for tsx/jsx at the moment.`);
                    continue;
                }
                const fn = decl;
                if (!fn.parameters.length)
                    continue;
                const param1 = fn.parameters[0];
                const type = typeChecker.getTypeAtLocation(param1);
                return type;
            }
        }
        return null;
    }
    getCompletionItemForProperty(mem, typeChecker) {
        let item = {
            label: mem.name,
            insertText: mem.name,
            commitCharacters: [],
        };
        mem.getDocumentationComment(typeChecker);
        let description = mem
            .getDocumentationComment(typeChecker)
            .map((val) => val.text)
            .join('\n');
        if (description) {
            let docs = {
                kind: vscode_languageserver_1.MarkupKind.Markdown,
                value: description,
            };
            item.documentation = docs;
        }
        return item;
    }
    async isAstroComponent(document, node) {
        var _a;
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        // Get the source file
        const tsFilePath = (0, utils_3.toVirtualAstroFilePath)(tsDoc.filePath);
        const program = lang.getProgram();
        const sourceFile = program === null || program === void 0 ? void 0 : program.getSourceFile(tsFilePath);
        const typeChecker = program === null || program === void 0 ? void 0 : program.getTypeChecker();
        if (!sourceFile || !typeChecker) {
            return false;
        }
        const componentName = node.tag;
        const imp = this.getImportedSymbol(sourceFile, componentName);
        const importType = imp && typeChecker.getTypeAtLocation(imp);
        if (!importType) {
            return false;
        }
        const symbolDeclaration = (_a = importType.getSymbol()) === null || _a === void 0 ? void 0 : _a.declarations;
        if (symbolDeclaration) {
            const fileName = symbolDeclaration[0].getSourceFile().fileName;
            return fileName.endsWith('.astro');
        }
        return false;
    }
}
exports.CompletionsProviderImpl = CompletionsProviderImpl;
