import { CancellationToken, Color, ColorInformation, ColorPresentation, CompletionContext, CompletionItem, CompletionList, DefinitionLink, Diagnostic, FoldingRange, Hover, Position, Range, Location, SignatureHelp, SignatureHelpContext, TextDocumentContentChangeEvent, TextDocumentIdentifier, WorkspaceEdit, SymbolInformation, SemanticTokens } from 'vscode-languageserver';
import type { AppCompletionItem, Plugin } from './interfaces';
import { DocumentManager } from '../core/documents/DocumentManager';
interface PluginHostConfig {
    filterIncompleteCompletions: boolean;
    definitionLinkSupport: boolean;
}
export declare class PluginHost {
    private docManager;
    private plugins;
    private pluginHostConfig;
    constructor(docManager: DocumentManager);
    initialize(pluginHostConfig: PluginHostConfig): void;
    registerPlugin(plugin: Plugin): void;
    getCompletions(textDocument: TextDocumentIdentifier, position: Position, completionContext?: CompletionContext): Promise<CompletionList>;
    resolveCompletion(textDocument: TextDocumentIdentifier, completionItem: AppCompletionItem): Promise<CompletionItem>;
    getDiagnostics(textDocument: TextDocumentIdentifier): Promise<Diagnostic[]>;
    doHover(textDocument: TextDocumentIdentifier, position: Position): Promise<Hover | null>;
    doTagComplete(textDocument: TextDocumentIdentifier, position: Position): Promise<string | null>;
    getFoldingRanges(textDocument: TextDocumentIdentifier): Promise<FoldingRange[] | null>;
    getDocumentSymbols(textDocument: TextDocumentIdentifier, cancellationToken: CancellationToken): Promise<SymbolInformation[]>;
    getSemanticTokens(textDocument: TextDocumentIdentifier, range?: Range, cancellationToken?: CancellationToken): Promise<SemanticTokens | null>;
    getDefinitions(textDocument: TextDocumentIdentifier, position: Position): Promise<DefinitionLink[] | Location[]>;
    rename(textDocument: TextDocumentIdentifier, position: Position, newName: string): Promise<WorkspaceEdit | null>;
    getDocumentColors(textDocument: TextDocumentIdentifier): Promise<ColorInformation[]>;
    getColorPresentations(textDocument: TextDocumentIdentifier, range: Range, color: Color): Promise<ColorPresentation[]>;
    getSignatureHelp(textDocument: TextDocumentIdentifier, position: Position, context: SignatureHelpContext | undefined, cancellationToken: CancellationToken): Promise<SignatureHelp | null>;
    onWatchFileChanges(onWatchFileChangesParams: any[]): void;
    updateNonAstroFile(fileName: string, changes: TextDocumentContentChangeEvent[]): void;
    private getDocument;
    private execute;
    private tryExecutePlugin;
}
export {};
