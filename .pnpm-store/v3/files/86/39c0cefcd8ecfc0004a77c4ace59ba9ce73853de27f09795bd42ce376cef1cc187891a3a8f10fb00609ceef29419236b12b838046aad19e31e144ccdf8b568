"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstroCheck = exports.DiagnosticSeverity = void 0;
const documents_1 = require("./core/documents");
const config_1 = require("./core/config");
const plugins_1 = require("./plugins");
var vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
Object.defineProperty(exports, "DiagnosticSeverity", { enumerable: true, get: function () { return vscode_languageserver_protocol_1.DiagnosticSeverity; } });
class AstroCheck {
    constructor(workspacePath) {
        this.docManager = documents_1.DocumentManager.newInstance();
        this.configManager = new config_1.ConfigManager();
        this.pluginHost = new plugins_1.PluginHost(this.docManager);
        this.initialize(workspacePath);
    }
    upsertDocument(doc) {
        this.docManager.openDocument({
            text: doc.text,
            uri: doc.uri,
        });
        this.docManager.markAsOpenedInClient(doc.uri);
    }
    removeDocument(uri) {
        if (!this.docManager.get(uri)) {
            return;
        }
        this.docManager.closeDocument(uri);
        this.docManager.releaseDocument(uri);
    }
    async getDiagnostics() {
        return await Promise.all(this.docManager.getAllOpenedByClient().map(async (doc) => {
            const uri = doc[1].uri;
            return await this.getDiagnosticsForFile(uri);
        }));
    }
    initialize(workspacePath) {
        this.pluginHost.registerPlugin(new plugins_1.TypeScriptPlugin(this.docManager, this.configManager, [workspacePath]));
    }
    async getDiagnosticsForFile(uri) {
        var _a;
        const diagnostics = await this.pluginHost.getDiagnostics({ uri });
        return {
            filePath: new URL(uri).pathname || '',
            text: ((_a = this.docManager.get(uri)) === null || _a === void 0 ? void 0 : _a.getText()) || '',
            diagnostics,
        };
    }
}
exports.AstroCheck = AstroCheck;
