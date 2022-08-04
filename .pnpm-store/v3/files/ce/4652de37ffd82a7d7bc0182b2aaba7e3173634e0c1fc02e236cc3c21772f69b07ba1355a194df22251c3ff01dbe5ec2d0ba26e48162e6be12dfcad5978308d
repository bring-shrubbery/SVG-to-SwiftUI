import { AstroDocument } from '../../core/documents';
import ts from 'typescript';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { GlobalSnapshotManager, SnapshotManager } from './snapshots/SnapshotManager';
import { DocumentSnapshot } from './snapshots/DocumentSnapshot';
export interface LanguageServiceContainer {
    readonly tsconfigPath: string;
    readonly compilerOptions: ts.CompilerOptions;
    /**
     * @internal Public for tests only
     */
    readonly snapshotManager: SnapshotManager;
    getService(): ts.LanguageService;
    updateSnapshot(documentOrFilePath: AstroDocument | string): DocumentSnapshot;
    deleteSnapshot(filePath: string): void;
    updateProjectFiles(): void;
    updateNonAstroFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): void;
    /**
     * Checks if a file is present in the project.
     * Unlike `fileBelongsToProject`, this doesn't run a file search on disk.
     */
    hasFile(filePath: string): boolean;
    /**
     * Careful, don't call often, or it will hurt performance.
     */
    fileBelongsToProject(filePath: string): boolean;
}
export interface LanguageServiceDocumentContext {
    createDocument: (fileName: string, content: string) => AstroDocument;
    globalSnapshotManager: GlobalSnapshotManager;
}
export declare function getLanguageService(path: string, workspaceUris: string[], docContext: LanguageServiceDocumentContext): Promise<LanguageServiceContainer>;
export declare function forAllLanguageServices(cb: (service: LanguageServiceContainer) => any): Promise<void>;
/**
 * @param tsconfigPath has to be absolute
 * @param docContext
 */
export declare function getLanguageServiceForTsconfig(tsconfigPath: string, docContext: LanguageServiceDocumentContext): Promise<LanguageServiceContainer>;
