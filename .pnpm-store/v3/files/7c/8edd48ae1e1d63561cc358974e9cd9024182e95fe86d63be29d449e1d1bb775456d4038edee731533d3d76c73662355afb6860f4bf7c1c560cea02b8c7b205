import { CancellationToken, Range, SemanticTokens } from 'vscode-languageserver';
import { AstroDocument } from '../../../core/documents';
import { SemanticTokensProvider } from '../../interfaces';
import { LanguageServiceManager } from '../LanguageServiceManager';
export declare class SemanticTokensProviderImpl implements SemanticTokensProvider {
    private languageServiceManager;
    constructor(languageServiceManager: LanguageServiceManager);
    getSemanticTokens(document: AstroDocument, range?: Range, cancellationToken?: CancellationToken): Promise<SemanticTokens | null>;
    private mapToOrigin;
    /**
     *  TSClassification = (TokenType + 1) << TokenEncodingConsts.typeOffset + TokenModifier
     */
    private getTokenTypeFromClassification;
    private getTokenModifierFromClassification;
}
