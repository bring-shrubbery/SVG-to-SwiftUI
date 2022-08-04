import { CancellationToken } from 'vscode-languageserver';
import { Diagnostic } from 'vscode-languageserver-types';
import { AstroDocument } from '../../../core/documents';
import { DiagnosticsProvider } from '../../interfaces';
import { LanguageServiceManager } from '../LanguageServiceManager';
export declare class DiagnosticsProviderImpl implements DiagnosticsProvider {
    private readonly languageServiceManager;
    constructor(languageServiceManager: LanguageServiceManager);
    getDiagnostics(document: AstroDocument, _cancellationToken?: CancellationToken): Promise<Diagnostic[]>;
    private getTagBoundaries;
}
