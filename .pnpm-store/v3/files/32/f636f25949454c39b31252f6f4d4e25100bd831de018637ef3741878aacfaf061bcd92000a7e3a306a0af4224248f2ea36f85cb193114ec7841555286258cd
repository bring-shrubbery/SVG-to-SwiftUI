import { CompletionContext, DefinitionLink, FoldingRange, Position } from 'vscode-languageserver';
import { ConfigManager } from '../../core/config';
import { AstroDocument, DocumentManager } from '../../core/documents';
import { AppCompletionList, Plugin } from '../interfaces';
export declare class AstroPlugin implements Plugin {
    __name: string;
    private configManager;
    private readonly languageServiceManager;
    private readonly completionProvider;
    constructor(docManager: DocumentManager, configManager: ConfigManager, workspaceUris: string[]);
    getCompletions(document: AstroDocument, position: Position, completionContext?: CompletionContext): Promise<AppCompletionList | null>;
    getFoldingRanges(document: AstroDocument): FoldingRange[];
    getDefinitions(document: AstroDocument, position: Position): Promise<DefinitionLink[]>;
    private isInsideFrontmatter;
    private isComponentTag;
    private getDefinitionsForComponentName;
    private getImportSpecifierForIdentifier;
}
