import { AstroDocument } from '../../../core/documents';
import { FrameworkExt } from '../utils';
import { AstroSnapshot, TypeScriptDocumentSnapshot } from './DocumentSnapshot';
export declare function createFromDocument(document: AstroDocument): AstroSnapshot;
/**
 * Returns an Astro or Framework or a ts/js snapshot from a file path, depending on the file contents.
 * @param filePath path to the file
 * @param createDocument function that is used to create a document in case it's an Astro file
 */
export declare function createFromFilePath(filePath: string, createDocument: (filePath: string, text: string) => AstroDocument): AstroSnapshot | TypeScriptDocumentSnapshot;
/**
 * Return a Framework or a TS snapshot from a file path, depending on the file contents
 * Unlike createFromFilePath, this does not support creating an Astro snapshot
 */
export declare function createFromNonAstroFilePath(filePath: string): TypeScriptDocumentSnapshot;
/**
 * Returns a ts/js snapshot from a file path.
 * @param filePath path to the js/ts file
 * @param options options that apply in case it's a svelte file
 */
export declare function createFromTSFilePath(filePath: string): TypeScriptDocumentSnapshot;
/**
 * Returns an Astro snapshot from a file path.
 * @param filePath path to the Astro file
 * @param createDocument function that is used to create a document
 */
export declare function createFromAstroFilePath(filePath: string, createDocument: (filePath: string, text: string) => AstroDocument): AstroSnapshot;
export declare function createFromFrameworkFilePath(filePath: string, framework: FrameworkExt): TypeScriptDocumentSnapshot;
