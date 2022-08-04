import { CompletionList, Position, FoldingRange, Hover, SymbolInformation } from 'vscode-languageserver';
import type { Plugin } from '../interfaces';
import { ConfigManager } from '../../core/config/ConfigManager';
import { AstroDocument } from '../../core/documents/AstroDocument';
export declare class HTMLPlugin implements Plugin {
    __name: string;
    private lang;
    private attributeOnlyLang;
    private componentLang;
    private styleScriptTemplate;
    private configManager;
    constructor(configManager: ConfigManager);
    doHover(document: AstroDocument, position: Position): Hover | null;
    /**
     * Get HTML completions
     */
    getCompletions(document: AstroDocument, position: Position): CompletionList | null;
    getFoldingRanges(document: AstroDocument): FoldingRange[] | null;
    doTagComplete(document: AstroDocument, position: Position): string | null;
    getDocumentSymbols(document: AstroDocument): SymbolInformation[];
    /**
     * Get lang completions for style tags (ex: `<style lang="scss">`)
     */
    private getLangCompletions;
    private featureEnabled;
}
