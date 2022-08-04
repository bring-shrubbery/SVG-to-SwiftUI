import { DocumentSnapshot, TypeScriptDocumentSnapshot } from './DocumentSnapshot';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
/**
 * Every snapshot corresponds to a unique file on disk.
 * A snapshot can be part of multiple projects, but for a given file path
 * there can be only one snapshot.
 */
export declare class GlobalSnapshotManager {
    private emitter;
    private documents;
    get(fileName: string): DocumentSnapshot | undefined;
    set(fileName: string, document: DocumentSnapshot): void;
    delete(fileName: string): void;
    updateNonAstroFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): TypeScriptDocumentSnapshot | undefined;
    onChange(listener: (fileName: string, newDocument: DocumentSnapshot | undefined) => void): void;
}
export interface TsFilesSpec {
    include?: readonly string[];
    exclude?: readonly string[];
}
/**
 * Should only be used by `language-service.ts`
 */
export declare class SnapshotManager {
    private globalSnapshotsManager;
    private projectFiles;
    private fileSpec;
    private workspaceRoot;
    private documents;
    private lastLogged;
    private readonly watchExtensions;
    constructor(globalSnapshotsManager: GlobalSnapshotManager, projectFiles: string[], fileSpec: TsFilesSpec, workspaceRoot: string);
    updateProjectFiles(): void;
    updateNonAstroFile(fileName: string, changes?: TextDocumentContentChangeEvent[]): void;
    has(fileName: string): boolean;
    set(fileName: string, snapshot: DocumentSnapshot): void;
    get(fileName: string): DocumentSnapshot | undefined;
    delete(fileName: string): void;
    getFileNames(): string[];
    getProjectFileNames(): string[];
    private logStatistics;
}
