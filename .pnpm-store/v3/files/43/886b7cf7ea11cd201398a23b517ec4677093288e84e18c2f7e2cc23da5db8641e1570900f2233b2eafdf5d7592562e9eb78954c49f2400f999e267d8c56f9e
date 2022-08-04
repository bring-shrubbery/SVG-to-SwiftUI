import type { AppCompletionList, CompletionsProvider } from '../../interfaces';
import type { AstroDocument, DocumentManager } from '../../../core/documents';
import { CompletionContext, Position } from 'vscode-languageserver';
import { LanguageServiceManager as TypeScriptLanguageServiceManager } from '../../typescript/LanguageServiceManager';
export declare class CompletionsProviderImpl implements CompletionsProvider {
    private readonly docManager;
    private readonly languageServiceManager;
    directivesHTMLLang: import("vscode-html-languageservice").LanguageService;
    constructor(docManager: DocumentManager, languageServiceManager: TypeScriptLanguageServiceManager);
    getCompletions(document: AstroDocument, position: Position, completionContext?: CompletionContext): Promise<AppCompletionList | null>;
    private getComponentScriptCompletion;
    private getPropCompletions;
    private getImportedSymbol;
    private getPropType;
    private getCompletionItemForProperty;
    private isAstroComponent;
}
