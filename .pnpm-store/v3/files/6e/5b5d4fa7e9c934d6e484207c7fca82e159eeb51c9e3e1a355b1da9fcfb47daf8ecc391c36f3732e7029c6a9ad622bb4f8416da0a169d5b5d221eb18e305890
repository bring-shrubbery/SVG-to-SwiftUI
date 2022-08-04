import ts from 'typescript';
import { Position, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { AstroDocument, DocumentMapper, IdentityMapper } from '../../../core/documents';
import { FrameworkExt } from '../utils';
export interface DocumentSnapshot extends ts.IScriptSnapshot {
    version: number;
    filePath: string;
    scriptKind: ts.ScriptKind;
    positionAt(offset: number): Position;
    /**
     * Instantiates a source mapper.
     * `destroyFragment` needs to be called when
     * it's no longer needed / the class should be cleaned up
     * in order to prevent memory leaks.
     */
    createFragment(): Promise<SnapshotFragment>;
    /**
     * Needs to be called when source mapper
     * is no longer needed / the class should be cleaned up
     * in order to prevent memory leaks.
     */
    destroyFragment(): void;
    /**
     * Convenience function for getText(0, getLength())
     */
    getFullText(): string;
}
/**
 * The mapper to get from original snapshot positions to generated and vice versa.
 */
export interface SnapshotFragment extends DocumentMapper {
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
}
/**
 * Snapshots used for Astro files
 */
export declare class AstroSnapshot implements DocumentSnapshot {
    private readonly parent;
    private readonly text;
    readonly scriptKind: ts.ScriptKind;
    private fragment?;
    version: number;
    constructor(parent: AstroDocument, text: string, scriptKind: ts.ScriptKind);
    createFragment(): Promise<AstroSnapshotFragment>;
    destroyFragment(): null;
    get filePath(): string;
    getText(start: number, end: number): string;
    getLength(): number;
    getFullText(): string;
    getChangeRange(): undefined;
    positionAt(offset: number): Position;
}
export declare class AstroSnapshotFragment implements SnapshotFragment {
    private readonly mapper;
    readonly parent: AstroDocument;
    readonly text: string;
    private readonly url;
    private lineOffsets;
    constructor(mapper: DocumentMapper, parent: AstroDocument, text: string, url: string);
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
    getOriginalPosition(pos: Position): Position;
    getGeneratedPosition(pos: Position): Position;
    isInGenerated(pos: Position): boolean;
    getURL(): string;
}
/**
 * Snapshot used for anything that is not an Astro file
 * It's both used for .js(x)/.ts(x) files and .svelte/.vue files
 */
export declare class TypeScriptDocumentSnapshot extends IdentityMapper implements DocumentSnapshot, SnapshotFragment {
    version: number;
    readonly filePath: string;
    private text;
    readonly framework?: FrameworkExt | undefined;
    scriptKind: ts.ScriptKind;
    private lineOffsets?;
    constructor(version: number, filePath: string, text: string, scriptKind?: ts.ScriptKind, framework?: FrameworkExt | undefined);
    getText(start: number, end: number): string;
    getLength(): number;
    getFullText(): string;
    getChangeRange(): undefined;
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
    createFragment(): Promise<this>;
    destroyFragment(): void;
    update(changes: TextDocumentContentChangeEvent[]): void;
    private getLineOffsets;
}
