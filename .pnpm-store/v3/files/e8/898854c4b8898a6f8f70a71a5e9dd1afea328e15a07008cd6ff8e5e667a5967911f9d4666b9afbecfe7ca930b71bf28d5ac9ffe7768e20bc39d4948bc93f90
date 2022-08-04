import ts from 'typescript';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { ConfigManager } from '../../core/config';
import { AstroDocument, DocumentManager } from '../../core/documents';
import { LanguageServiceContainer } from './language-service';
import { DocumentSnapshot } from './snapshots/DocumentSnapshot';
export declare class LanguageServiceManager {
    private readonly docManager;
    private readonly workspaceUris;
    private readonly configManager;
    private docContext;
    private globalSnapshotManager;
    constructor(docManager: DocumentManager, workspaceUris: string[], configManager: ConfigManager);
    /**
     * Create an AstroDocument (only for astro files)
     */
    private createDocument;
    getSnapshot(document: AstroDocument): Promise<DocumentSnapshot>;
    getSnapshot(pathOrDoc: string | AstroDocument): Promise<DocumentSnapshot>;
    /**
     * Updates snapshot path in all existing ts services and retrieves snapshot
     */
    updateSnapshotPath(oldPath: string, newPath: string): Promise<DocumentSnapshot>;
    /**
     * Deletes snapshot in all existing ts services
     */
    deleteSnapshot(filePath: string): Promise<void>;
    /**
     * Updates project files in all existing ts services
     */
    updateProjectFiles(): Promise<void>;
    /**
     * Updates file in all ts services where it exists
     */
    updateExistingNonAstroFile(path: string, changes?: TextDocumentContentChangeEvent[]): Promise<void>;
    getLSAndTSDoc(document: AstroDocument): Promise<{
        tsDoc: DocumentSnapshot;
        lang: ts.LanguageService;
    }>;
    getLSForPath(path: string): Promise<ts.LanguageService>;
    getTypeScriptLanguageService(filePath: string): Promise<LanguageServiceContainer>;
}
