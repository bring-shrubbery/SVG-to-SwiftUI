import { SymbolInformation } from 'vscode-languageserver-types';
import { AstroDocument } from '../../../core/documents';
import { DocumentSymbolsProvider } from '../../interfaces';
import { LanguageServiceManager } from '../LanguageServiceManager';
export declare class DocumentSymbolsProviderImpl implements DocumentSymbolsProvider {
    private languageServiceManager;
    constructor(languageServiceManager: LanguageServiceManager);
    getDocumentSymbols(document: AstroDocument): Promise<SymbolInformation[]>;
    private collectSymbols;
}
