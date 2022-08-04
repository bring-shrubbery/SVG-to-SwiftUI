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
exports.startLanguageServer = void 0;
const vscode = __importStar(require("vscode-languageserver"));
const vscode_languageserver_1 = require("vscode-languageserver");
const ConfigManager_1 = require("./core/config/ConfigManager");
const DocumentManager_1 = require("./core/documents/DocumentManager");
const DiagnosticsManager_1 = require("./core/DiagnosticsManager");
const AstroPlugin_1 = require("./plugins/astro/AstroPlugin");
const CSSPlugin_1 = require("./plugins/css/CSSPlugin");
const HTMLPlugin_1 = require("./plugins/html/HTMLPlugin");
const PluginHost_1 = require("./plugins/PluginHost");
const plugins_1 = require("./plugins");
const utils_1 = require("./utils");
const utils_2 = require("./plugins/typescript/utils");
const TagCloseRequest = new vscode.RequestType('html/tag');
// Start the language server
function startLanguageServer(connection) {
    // Create our managers
    const configManager = new ConfigManager_1.ConfigManager();
    const documentManager = new DocumentManager_1.DocumentManager();
    const pluginHost = new PluginHost_1.PluginHost(documentManager);
    connection.onInitialize((params) => {
        var _a, _b, _c, _d, _e, _f;
        const workspaceUris = (_b = (_a = params.workspaceFolders) === null || _a === void 0 ? void 0 : _a.map((folder) => folder.uri.toString())) !== null && _b !== void 0 ? _b : [(_c = params.rootUri) !== null && _c !== void 0 ? _c : ''];
        pluginHost.initialize({
            filterIncompleteCompletions: !((_d = params.initializationOptions) === null || _d === void 0 ? void 0 : _d.dontFilterIncompleteCompletions),
            definitionLinkSupport: !!((_f = (_e = params.capabilities.textDocument) === null || _e === void 0 ? void 0 : _e.definition) === null || _f === void 0 ? void 0 : _f.linkSupport),
        });
        // Register plugins
        pluginHost.registerPlugin(new HTMLPlugin_1.HTMLPlugin(configManager));
        pluginHost.registerPlugin(new CSSPlugin_1.CSSPlugin(configManager));
        // We don't currently support running the TypeScript and Astro plugin in the browser
        if (params.initializationOptions.environment !== 'browser') {
            pluginHost.registerPlugin(new AstroPlugin_1.AstroPlugin(documentManager, configManager, workspaceUris));
            pluginHost.registerPlugin(new plugins_1.TypeScriptPlugin(documentManager, configManager, workspaceUris));
        }
        // Update language-server config with what the user supplied to us at launch
        configManager.updateConfig(params.initializationOptions.configuration.astro);
        configManager.updateEmmetConfig(params.initializationOptions.configuration.emmet);
        return {
            capabilities: {
                textDocumentSync: vscode.TextDocumentSyncKind.Incremental,
                foldingRangeProvider: true,
                definitionProvider: true,
                renameProvider: true,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: [
                        '.',
                        '"',
                        "'",
                        '`',
                        '/',
                        '@',
                        '<',
                        ' ',
                        // Emmet
                        '>',
                        '*',
                        '#',
                        '$',
                        '+',
                        '^',
                        '(',
                        '[',
                        '@',
                        '-',
                        // No whitespace because
                        // it makes for weird/too many completions
                        // of other completion providers
                        // Astro
                        ':',
                    ],
                },
                colorProvider: true,
                hoverProvider: true,
                documentSymbolProvider: true,
                semanticTokensProvider: {
                    legend: (0, utils_2.getSemanticTokenLegend)(),
                    range: true,
                    full: true,
                },
                signatureHelpProvider: {
                    triggerCharacters: ['(', ',', '<'],
                    retriggerCharacters: [')'],
                },
            },
        };
    });
    // On update of the user configuration of the language-server
    connection.onDidChangeConfiguration(({ settings }) => {
        configManager.updateConfig(settings.astro);
        configManager.updateEmmetConfig(settings.emmet);
    });
    // Documents
    connection.onDidOpenTextDocument((params) => {
        documentManager.openDocument(params.textDocument);
        documentManager.markAsOpenedInClient(params.textDocument.uri);
    });
    connection.onDidCloseTextDocument((params) => documentManager.closeDocument(params.textDocument.uri));
    connection.onDidChangeTextDocument((params) => {
        documentManager.updateDocument(params.textDocument, params.contentChanges);
    });
    const diagnosticsManager = new DiagnosticsManager_1.DiagnosticsManager(connection.sendDiagnostics, documentManager, pluginHost.getDiagnostics.bind(pluginHost));
    const updateAllDiagnostics = (0, utils_1.debounceThrottle)(() => diagnosticsManager.updateAll(), 1000);
    connection.onDidChangeWatchedFiles((evt) => {
        const params = evt.changes
            .map((change) => ({
            fileName: (0, utils_1.urlToPath)(change.uri),
            changeType: change.type,
        }))
            .filter((change) => !!change.fileName);
        pluginHost.onWatchFileChanges(params);
        updateAllDiagnostics();
    });
    // Features
    connection.onHover((params) => pluginHost.doHover(params.textDocument, params.position));
    connection.onDefinition((evt) => pluginHost.getDefinitions(evt.textDocument, evt.position));
    connection.onFoldingRanges((evt) => pluginHost.getFoldingRanges(evt.textDocument));
    connection.onCompletion(async (evt) => {
        const promise = pluginHost.getCompletions(evt.textDocument, evt.position, evt.context);
        return promise;
    });
    connection.onCompletionResolve((completionItem) => {
        const data = completionItem.data;
        if (!data) {
            return completionItem;
        }
        return pluginHost.resolveCompletion(data, completionItem);
    });
    connection.onDocumentSymbol((params, cancellationToken) => pluginHost.getDocumentSymbols(params.textDocument, cancellationToken));
    connection.onRequest(vscode_languageserver_1.SemanticTokensRequest.type, (evt, cancellationToken) => pluginHost.getSemanticTokens(evt.textDocument, undefined, cancellationToken));
    connection.onRequest(vscode_languageserver_1.SemanticTokensRangeRequest.type, (evt, cancellationToken) => pluginHost.getSemanticTokens(evt.textDocument, evt.range, cancellationToken));
    connection.onDocumentColor((params) => pluginHost.getDocumentColors(params.textDocument));
    connection.onColorPresentation((params) => pluginHost.getColorPresentations(params.textDocument, params.range, params.color));
    connection.onRequest(TagCloseRequest, (evt) => pluginHost.doTagComplete(evt.textDocument, evt.position));
    connection.onSignatureHelp((evt, cancellationToken) => pluginHost.getSignatureHelp(evt.textDocument, evt.position, evt.context, cancellationToken));
    connection.onRenameRequest((evt) => pluginHost.rename(evt.textDocument, evt.position, evt.newName));
    connection.onDidSaveTextDocument(updateAllDiagnostics);
    connection.onNotification('$/onDidChangeNonAstroFile', async (e) => {
        const path = (0, utils_1.urlToPath)(e.uri);
        if (path) {
            pluginHost.updateNonAstroFile(path, e.changes);
        }
        updateAllDiagnostics();
    });
    documentManager.on('documentChange', (0, utils_1.debounceThrottle)(async (document) => diagnosticsManager.update(document), 1000));
    documentManager.on('documentClose', (document) => diagnosticsManager.removeDiagnostics(document));
    // Taking off 🚀
    connection.onInitialized(() => {
        connection.console.log('Successfully initialized! 🚀');
    });
    connection.listen();
}
exports.startLanguageServer = startLanguageServer;
