"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptPlugin = void 0;
const typescript_1 = __importStar(require("typescript"));
const vscode_languageserver_1 = require("vscode-languageserver");
const path_1 = require("path");
const utils_1 = require("../../utils");
const CompletionsProvider_1 = require("./features/CompletionsProvider");
const DiagnosticsProvider_1 = require("./features/DiagnosticsProvider");
const HoverProvider_1 = require("./features/HoverProvider");
const SignatureHelpProvider_1 = require("./features/SignatureHelpProvider");
const utils_2 = require("./features/utils");
const LanguageServiceManager_1 = require("./LanguageServiceManager");
const utils_3 = require("./utils");
const DocumentSymbolsProvider_1 = require("./features/DocumentSymbolsProvider");
const SemanticTokenProvider_1 = require("./features/SemanticTokenProvider");
class TypeScriptPlugin {
    constructor(docManager, configManager, workspaceUris) {
        this.__name = 'typescript';
        this.configManager = configManager;
        this.languageServiceManager = new LanguageServiceManager_1.LanguageServiceManager(docManager, workspaceUris, configManager);
        this.completionProvider = new CompletionsProvider_1.CompletionsProviderImpl(this.languageServiceManager);
        this.hoverProvider = new HoverProvider_1.HoverProviderImpl(this.languageServiceManager);
        this.signatureHelpProvider = new SignatureHelpProvider_1.SignatureHelpProviderImpl(this.languageServiceManager);
        this.diagnosticsProvider = new DiagnosticsProvider_1.DiagnosticsProviderImpl(this.languageServiceManager);
        this.documentSymbolsProvider = new DocumentSymbolsProvider_1.DocumentSymbolsProviderImpl(this.languageServiceManager);
        this.semanticTokensProvider = new SemanticTokenProvider_1.SemanticTokensProviderImpl(this.languageServiceManager);
    }
    async doHover(document, position) {
        if (!this.featureEnabled('hover')) {
            return null;
        }
        return this.hoverProvider.doHover(document, position);
    }
    async rename(document, position, newName) {
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        const fragment = await tsDoc.createFragment();
        const offset = fragment.offsetAt(fragment.getGeneratedPosition(position));
        let renames = lang.findRenameLocations((0, utils_3.toVirtualAstroFilePath)(tsDoc.filePath), offset, false, false, true);
        if (!renames) {
            return null;
        }
        let edit = {
            changes: {},
        };
        renames.forEach((rename) => {
            const filePath = (0, utils_3.ensureRealFilePath)(rename.fileName);
            if (!(filePath in edit.changes)) {
                edit.changes[filePath] = [];
            }
            edit.changes[filePath].push({
                newText: newName,
                range: (0, utils_3.convertToLocationRange)(fragment, rename.textSpan),
            });
        });
        return edit;
    }
    async getSemanticTokens(textDocument, range, cancellationToken) {
        if (!this.featureEnabled('semanticTokens')) {
            return null;
        }
        return this.semanticTokensProvider.getSemanticTokens(textDocument, range, cancellationToken);
    }
    async getDocumentSymbols(document) {
        if (!this.featureEnabled('documentSymbols')) {
            return [];
        }
        const symbols = await this.documentSymbolsProvider.getDocumentSymbols(document);
        return symbols;
    }
    async getCompletions(document, position, completionContext) {
        if (!this.featureEnabled('completions')) {
            return null;
        }
        const completions = await this.completionProvider.getCompletions(document, position, completionContext);
        return completions;
    }
    async resolveCompletion(document, completionItem) {
        return this.completionProvider.resolveCompletion(document, completionItem);
    }
    async getDefinitions(document, position) {
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        const mainFragment = await tsDoc.createFragment();
        const filePath = tsDoc.filePath;
        const tsFilePath = (0, utils_3.toVirtualAstroFilePath)(filePath);
        const fragmentPosition = mainFragment.getGeneratedPosition(position);
        const fragmentOffset = mainFragment.offsetAt(fragmentPosition);
        let defs = lang.getDefinitionAndBoundSpan(tsFilePath, fragmentOffset);
        if (!defs || !defs.definitions) {
            return [];
        }
        // Resolve all imports if we can
        if (this.goToDefinitionFoundOnlyAlias(tsFilePath, defs.definitions)) {
            let importDef = this.getGoToDefinitionRefsForImportSpecifier(tsFilePath, fragmentOffset, lang);
            if (importDef) {
                defs = importDef;
            }
        }
        const docs = new utils_2.SnapshotFragmentMap(this.languageServiceManager);
        docs.set(tsDoc.filePath, { fragment: mainFragment, snapshot: tsDoc });
        const result = await Promise.all(defs.definitions.map(async (def) => {
            const { fragment, snapshot } = await docs.retrieve(def.fileName);
            const fileName = (0, utils_3.ensureRealFilePath)(def.fileName);
            // Since we converted our files to TSX and we don't have sourcemaps, we don't know where the function is, unfortunate
            const textSpan = (0, utils_3.isVirtualFilePath)(tsFilePath) ? { start: 0, length: 0 } : def.textSpan;
            return vscode_languageserver_1.LocationLink.create((0, utils_1.pathToUrl)(fileName), (0, utils_3.convertToLocationRange)(fragment, textSpan), (0, utils_3.convertToLocationRange)(fragment, textSpan), (0, utils_3.convertToLocationRange)(mainFragment, defs.textSpan));
        }));
        return result.filter(utils_1.isNotNullOrUndefined);
    }
    async getDiagnostics(document, cancellationToken) {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }
        return this.diagnosticsProvider.getDiagnostics(document, cancellationToken);
    }
    async onWatchFileChanges(onWatchFileChangesParas) {
        let doneUpdateProjectFiles = false;
        for (const { fileName, changeType } of onWatchFileChangesParas) {
            const scriptKind = (0, utils_3.getScriptKindFromFileName)(fileName);
            if (scriptKind === typescript_1.default.ScriptKind.Unknown) {
                continue;
            }
            if (changeType === vscode_languageserver_1.FileChangeType.Created && !doneUpdateProjectFiles) {
                doneUpdateProjectFiles = true;
                await this.languageServiceManager.updateProjectFiles();
            }
            else if (changeType === vscode_languageserver_1.FileChangeType.Deleted) {
                await this.languageServiceManager.deleteSnapshot(fileName);
            }
            else {
                await this.languageServiceManager.updateExistingNonAstroFile(fileName);
            }
        }
    }
    async updateNonAstroFile(fileName, changes) {
        await this.languageServiceManager.updateExistingNonAstroFile(fileName, changes);
    }
    async getSignatureHelp(document, position, context, cancellationToken) {
        return this.signatureHelpProvider.getSignatureHelp(document, position, context, cancellationToken);
    }
    goToDefinitionFoundOnlyAlias(tsFileName, defs) {
        return !!(defs.length === 1 && defs[0].kind === 'alias' && defs[0].fileName === tsFileName);
    }
    getGoToDefinitionRefsForImportSpecifier(tsFilePath, offset, lang) {
        const program = lang.getProgram();
        const sourceFile = program === null || program === void 0 ? void 0 : program.getSourceFile(tsFilePath);
        if (sourceFile) {
            let node = typescript_1.default.getTouchingPropertyName(sourceFile, offset);
            if (node && node.kind === typescript_1.SyntaxKind.Identifier) {
                if (node.parent.kind === typescript_1.SyntaxKind.ImportClause) {
                    let decl = node.parent.parent;
                    let spec = typescript_1.default.isStringLiteral(decl.moduleSpecifier) && decl.moduleSpecifier.text;
                    if (spec) {
                        let fileName = (0, path_1.join)((0, path_1.dirname)(tsFilePath), spec);
                        let start = node.pos + 1;
                        let def = {
                            definitions: [
                                {
                                    kind: 'alias',
                                    fileName,
                                    name: '',
                                    containerKind: '',
                                    containerName: '',
                                    textSpan: {
                                        start: 0,
                                        length: 0,
                                    },
                                },
                            ],
                            textSpan: {
                                start,
                                length: node.end - start,
                            },
                        };
                        return def;
                    }
                }
            }
        }
    }
    featureEnabled(feature) {
        return (this.configManager.enabled('typescript.enabled') && this.configManager.enabled(`typescript.${feature}.enabled`));
    }
}
exports.TypeScriptPlugin = TypeScriptPlugin;
