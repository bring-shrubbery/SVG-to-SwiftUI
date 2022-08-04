"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginHost = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const lodash_1 = require("lodash");
var ExecuteMode;
(function (ExecuteMode) {
    ExecuteMode[ExecuteMode["None"] = 0] = "None";
    ExecuteMode[ExecuteMode["FirstNonNull"] = 1] = "FirstNonNull";
    ExecuteMode[ExecuteMode["Collect"] = 2] = "Collect";
})(ExecuteMode || (ExecuteMode = {}));
class PluginHost {
    constructor(docManager) {
        this.docManager = docManager;
        this.plugins = [];
        this.pluginHostConfig = {
            filterIncompleteCompletions: true,
            definitionLinkSupport: false,
        };
    }
    initialize(pluginHostConfig) {
        this.pluginHostConfig = pluginHostConfig;
    }
    registerPlugin(plugin) {
        this.plugins.push(plugin);
    }
    async getCompletions(textDocument, position, completionContext) {
        const document = this.getDocument(textDocument.uri);
        const completions = (await this.execute('getCompletions', [document, position, completionContext], ExecuteMode.Collect)).filter((completion) => completion != null);
        let flattenedCompletions = (0, lodash_1.flatten)(completions.map((completion) => completion.items));
        const isIncomplete = completions.reduce((incomplete, completion) => incomplete || completion.isIncomplete, false);
        return vscode_languageserver_1.CompletionList.create(flattenedCompletions, isIncomplete);
    }
    async resolveCompletion(textDocument, completionItem) {
        const document = this.getDocument(textDocument.uri);
        const result = await this.execute('resolveCompletion', [document, completionItem], ExecuteMode.FirstNonNull);
        return result !== null && result !== void 0 ? result : completionItem;
    }
    async getDiagnostics(textDocument) {
        const document = this.getDocument(textDocument.uri);
        return (0, lodash_1.flatten)(await this.execute('getDiagnostics', [document], ExecuteMode.Collect));
    }
    async doHover(textDocument, position) {
        const document = this.getDocument(textDocument.uri);
        return this.execute('doHover', [document, position], ExecuteMode.FirstNonNull);
    }
    async doTagComplete(textDocument, position) {
        const document = this.getDocument(textDocument.uri);
        return this.execute('doTagComplete', [document, position], ExecuteMode.FirstNonNull);
    }
    async getFoldingRanges(textDocument) {
        const document = this.getDocument(textDocument.uri);
        const foldingRanges = (0, lodash_1.flatten)(await this.execute('getFoldingRanges', [document], ExecuteMode.Collect)).filter((completion) => completion != null);
        return foldingRanges;
    }
    async getDocumentSymbols(textDocument, cancellationToken) {
        const document = this.getDocument(textDocument.uri);
        return (0, lodash_1.flatten)(await this.execute('getDocumentSymbols', [document, cancellationToken], ExecuteMode.Collect));
    }
    async getSemanticTokens(textDocument, range, cancellationToken) {
        const document = this.getDocument(textDocument.uri);
        return await this.execute('getSemanticTokens', [document, range, cancellationToken], ExecuteMode.FirstNonNull);
    }
    async getDefinitions(textDocument, position) {
        const document = this.getDocument(textDocument.uri);
        const definitions = (0, lodash_1.flatten)(await this.execute('getDefinitions', [document, position], ExecuteMode.Collect));
        if (this.pluginHostConfig.definitionLinkSupport) {
            return definitions;
        }
        else {
            return definitions.map((def) => ({ range: def.targetSelectionRange, uri: def.targetUri }));
        }
    }
    async rename(textDocument, position, newName) {
        const document = this.getDocument(textDocument.uri);
        return this.execute('rename', [document, position, newName], ExecuteMode.FirstNonNull);
    }
    async getDocumentColors(textDocument) {
        const document = this.getDocument(textDocument.uri);
        return (0, lodash_1.flatten)(await this.execute('getDocumentColors', [document], ExecuteMode.Collect));
    }
    async getColorPresentations(textDocument, range, color) {
        const document = this.getDocument(textDocument.uri);
        return (0, lodash_1.flatten)(await this.execute('getColorPresentations', [document, range, color], ExecuteMode.Collect));
    }
    async getSignatureHelp(textDocument, position, context, cancellationToken) {
        const document = this.getDocument(textDocument.uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }
        return await this.execute('getSignatureHelp', [document, position, context, cancellationToken], ExecuteMode.FirstNonNull);
    }
    onWatchFileChanges(onWatchFileChangesParams) {
        var _a;
        for (const support of this.plugins) {
            (_a = support.onWatchFileChanges) === null || _a === void 0 ? void 0 : _a.call(support, onWatchFileChangesParams);
        }
    }
    updateNonAstroFile(fileName, changes) {
        var _a;
        for (const support of this.plugins) {
            (_a = support.updateNonAstroFile) === null || _a === void 0 ? void 0 : _a.call(support, fileName, changes);
        }
    }
    getDocument(uri) {
        const document = this.docManager.get(uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }
        return document;
    }
    async execute(name, args, mode) {
        const plugins = this.plugins.filter((plugin) => typeof plugin[name] === 'function');
        switch (mode) {
            case ExecuteMode.FirstNonNull:
                for (const plugin of plugins) {
                    const res = await this.tryExecutePlugin(plugin, name, args, null);
                    if (res != null) {
                        return res;
                    }
                }
                return null;
            case ExecuteMode.Collect:
                return Promise.all(plugins.map((plugin) => {
                    let ret = this.tryExecutePlugin(plugin, name, args, []);
                    return ret;
                }));
            case ExecuteMode.None:
                await Promise.all(plugins.map((plugin) => this.tryExecutePlugin(plugin, name, args, null)));
                return;
        }
    }
    async tryExecutePlugin(plugin, fnName, args, failValue) {
        try {
            return await plugin[fnName](...args);
        }
        catch (e) {
            console.error(e);
            return failValue;
        }
    }
}
exports.PluginHost = PluginHost;
