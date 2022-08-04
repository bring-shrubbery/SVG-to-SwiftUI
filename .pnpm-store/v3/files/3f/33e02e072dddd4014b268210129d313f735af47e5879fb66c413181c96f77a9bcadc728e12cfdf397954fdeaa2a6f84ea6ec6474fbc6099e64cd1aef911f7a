import type { Diagnostic } from 'vscode-languageserver';
export { DiagnosticSeverity } from 'vscode-languageserver-protocol';
interface GetDiagnosticsResult {
    filePath: string;
    text: string;
    diagnostics: Diagnostic[];
}
export declare class AstroCheck {
    private docManager;
    private configManager;
    private pluginHost;
    constructor(workspacePath: string);
    upsertDocument(doc: {
        text: string;
        uri: string;
    }): void;
    removeDocument(uri: string): void;
    getDiagnostics(): Promise<GetDiagnosticsResult[]>;
    private initialize;
    private getDiagnosticsForFile;
}
