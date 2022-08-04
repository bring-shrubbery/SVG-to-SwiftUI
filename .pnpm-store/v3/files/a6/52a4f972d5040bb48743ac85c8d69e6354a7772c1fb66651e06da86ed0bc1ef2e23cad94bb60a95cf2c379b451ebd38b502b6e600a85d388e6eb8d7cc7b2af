import type { LanguageServiceManager } from '../LanguageServiceManager';
import { Hover, Position } from 'vscode-languageserver';
import { AstroDocument } from '../../../core/documents';
import { HoverProvider } from '../../interfaces';
export declare class HoverProviderImpl implements HoverProvider {
    private readonly languageServiceManager;
    constructor(languageServiceManager: LanguageServiceManager);
    doHover(document: AstroDocument, position: Position): Promise<Hover | null>;
}
