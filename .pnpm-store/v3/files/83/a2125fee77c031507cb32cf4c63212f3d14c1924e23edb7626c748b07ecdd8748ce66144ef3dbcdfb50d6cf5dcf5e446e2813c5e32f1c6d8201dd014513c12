import type { CompletionContext, Position, TextDocumentIdentifier } from 'vscode-languageserver';
import type { LanguageServiceManager } from '../LanguageServiceManager';
import { AstroDocument } from '../../../core/documents';
import ts from 'typescript';
import { AppCompletionItem, AppCompletionList, CompletionsProvider } from '../../interfaces';
export interface CompletionEntryWithIdentifer extends ts.CompletionEntry, TextDocumentIdentifier {
    position: Position;
}
export declare class CompletionsProviderImpl implements CompletionsProvider<CompletionEntryWithIdentifer> {
    private languageServiceManager;
    constructor(languageServiceManager: LanguageServiceManager);
    getCompletions(document: AstroDocument, position: Position, _completionContext?: CompletionContext): Promise<AppCompletionList<CompletionEntryWithIdentifer> | null>;
    resolveCompletion(document: AstroDocument, completionItem: AppCompletionItem<CompletionEntryWithIdentifer>): Promise<AppCompletionItem<CompletionEntryWithIdentifer>>;
    private toCompletionItem;
    private getCompletionDocument;
}
