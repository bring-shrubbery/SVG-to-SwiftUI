"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentSymbolsProviderImpl = void 0;
const typescript_1 = require("typescript");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const documents_1 = require("../../../core/documents");
const utils_1 = require("../utils");
const vscode_languageserver_types_2 = require("vscode-languageserver-types");
class DocumentSymbolsProviderImpl {
    constructor(languageServiceManager) {
        this.languageServiceManager = languageServiceManager;
    }
    async getDocumentSymbols(document) {
        var _a, _b, _c;
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        const fragment = await tsDoc.createFragment();
        const navTree = lang.getNavigationTree(tsDoc.filePath);
        if (!navTree) {
            return [];
        }
        const symbols = [];
        this.collectSymbols(navTree, fragment, undefined, (symbol) => symbols.push(symbol));
        const originalContainerName = symbols[0].name;
        const result = [];
        // Add a "Frontmatter" namespace for the frontmatter if we have a closed one
        if (document.astroMeta.frontmatter.state === 'closed') {
            result.push(vscode_languageserver_types_1.SymbolInformation.create('Frontmatter', vscode_languageserver_types_1.SymbolKind.Namespace, vscode_languageserver_types_1.Range.create(document.positionAt(document.astroMeta.frontmatter.startOffset), document.positionAt(document.astroMeta.frontmatter.endOffset)), document.getURL()));
        }
        // Add a "Template" namespace for everything under the frontmatter
        result.push(vscode_languageserver_types_1.SymbolInformation.create('Template', vscode_languageserver_types_1.SymbolKind.Namespace, vscode_languageserver_types_1.Range.create(document.positionAt((_a = document.astroMeta.frontmatter.endOffset) !== null && _a !== void 0 ? _a : 0), document.positionAt(document.getTextLength())), document.getURL()));
        for (let symbol of symbols.splice(1)) {
            symbol = (0, documents_1.mapSymbolInformationToOriginal)(fragment, symbol);
            if (document.offsetAt(symbol.location.range.end) >= ((_b = document.astroMeta.content.firstNonWhitespaceOffset) !== null && _b !== void 0 ? _b : 0)) {
                if (symbol.containerName === originalContainerName) {
                    symbol.containerName = 'Template';
                }
                // For some reason, it seems like TypeScript thinks that the "class" attribute is a real class, weird
                if (symbol.kind === vscode_languageserver_types_1.SymbolKind.Class && symbol.name === '<class>') {
                    const node = document.html.findNodeAt(document.offsetAt(symbol.location.range.start));
                    if ((_c = node.attributes) === null || _c === void 0 ? void 0 : _c.class) {
                        continue;
                    }
                }
            }
            // Remove the default function detected in our TSX output
            if (symbol.kind === vscode_languageserver_types_1.SymbolKind.Function && symbol.name == 'default') {
                continue;
            }
            result.push(symbol);
        }
        return result;
    }
    collectSymbols(item, fragment, container, cb) {
        for (const span of item.spans) {
            const symbol = vscode_languageserver_types_1.SymbolInformation.create(item.text, (0, utils_1.symbolKindFromString)(item.kind), vscode_languageserver_types_1.Range.create(fragment.positionAt(span.start), fragment.positionAt(span.start + span.length)), fragment.getURL(), container);
            // TypeScript gives us kind modifiers as a string instead of an array
            const kindModifiers = new Set(item.kindModifiers.split(/,|\s+/g));
            if (kindModifiers.has(typescript_1.ScriptElementKindModifier.deprecatedModifier)) {
                if (!symbol.tags)
                    symbol.tags = [];
                symbol.tags.push(vscode_languageserver_types_2.SymbolTag.Deprecated);
            }
            cb(symbol);
        }
        if (item.childItems) {
            for (const child of item.childItems) {
                this.collectSymbols(child, fragment, item.text, cb);
            }
        }
    }
}
exports.DocumentSymbolsProviderImpl = DocumentSymbolsProviderImpl;
