"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompletionsProviderImpl = void 0;
const utils_1 = require("../../../core/documents/utils");
const typescript_1 = __importDefault(require("typescript"));
const vscode_languageserver_1 = require("vscode-languageserver");
const utils_2 = require("../utils");
const completionOptions = Object.freeze({
    importModuleSpecifierPreference: 'relative',
    importModuleSpecifierEnding: 'auto',
    quotePreference: 'single',
});
class CompletionsProviderImpl {
    constructor(languageServiceManager) {
        this.languageServiceManager = languageServiceManager;
    }
    async getCompletions(document, position, _completionContext) {
        var _a;
        // TODO: handle inside expression and script tags
        if (!(0, utils_1.isInsideFrontmatter)(document.getText(), document.offsetAt(position))) {
            return null;
        }
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        const filePath = (0, utils_2.toVirtualAstroFilePath)(tsDoc.filePath);
        const fragment = await tsDoc.createFragment();
        const offset = document.offsetAt(position);
        const entries = ((_a = lang.getCompletionsAtPosition(filePath, offset, completionOptions)) === null || _a === void 0 ? void 0 : _a.entries) || [];
        const completionItems = entries
            .map((entry) => this.toCompletionItem(fragment, entry, document.uri, position, new Set()))
            .filter((i) => i);
        return vscode_languageserver_1.CompletionList.create(completionItems, true);
    }
    async resolveCompletion(document, completionItem) {
        const { data: comp } = completionItem;
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        let filePath = (0, utils_2.toVirtualAstroFilePath)(tsDoc.filePath);
        if (!comp || !filePath) {
            return completionItem;
        }
        const fragment = await tsDoc.createFragment();
        const detail = lang.getCompletionEntryDetails(filePath, // fileName
        fragment.offsetAt(comp.position), // position
        comp.name, // entryName
        {}, // formatOptions
        comp.source, // source
        {}, // preferences
        comp.data // data
        );
        if (detail) {
            const { detail: itemDetail, documentation: itemDocumentation } = this.getCompletionDocument(detail);
            completionItem.detail = itemDetail;
            completionItem.documentation = itemDocumentation;
        }
        return completionItem;
    }
    toCompletionItem(fragment, comp, uri, position, existingImports) {
        return {
            label: comp.name,
            insertText: comp.insertText,
            kind: (0, utils_2.scriptElementKindToCompletionItemKind)(comp.kind),
            commitCharacters: (0, utils_2.getCommitCharactersForScriptElement)(comp.kind),
            // Make sure svelte component takes precedence
            sortText: comp.sortText,
            preselect: comp.isRecommended,
            // pass essential data for resolving completion
            data: {
                ...comp,
                uri,
                position,
            },
        };
    }
    getCompletionDocument(compDetail) {
        const { source, documentation: tsDocumentation, displayParts, tags } = compDetail;
        let detail = typescript_1.default.displayPartsToString(displayParts);
        if (source) {
            const importPath = typescript_1.default.displayPartsToString(source);
            detail = `Auto import from ${importPath}\n${detail}`;
        }
        const documentation = tsDocumentation
            ? { value: tsDocumentation.join('\n'), kind: vscode_languageserver_1.MarkupKind.Markdown }
            : undefined;
        return {
            documentation,
            detail,
        };
    }
}
exports.CompletionsProviderImpl = CompletionsProviderImpl;
