import { Position } from 'vscode-languageserver';
import { HTMLDocument, Node } from 'vscode-html-languageservice';
export interface TagInformation {
    content: string;
    attributes: Record<string, string>;
    start: number;
    end: number;
    startPos: Position;
    endPos: Position;
    container: {
        start: number;
        end: number;
    };
    closed: boolean;
}
export declare function walk(node: Node): Generator<Node, void, unknown>;
export declare function extractStyleTags(source: string, html?: HTMLDocument): TagInformation[];
/**
 * Return if a Node is a Component
 */
export declare function isComponentTag(node: Node): boolean;
/**
 * Return if a given offset is inside the start tag of a component
 */
export declare function isInComponentStartTag(html: HTMLDocument, offset: number): boolean;
/**
 * Return if the current position is in a specific tag
 */
export declare function isInTag(position: Position, tagInfo: TagInformation | null): tagInfo is TagInformation;
/**
 * Return if a given position is inside a JSX expression
 */
export declare function isInsideExpression(html: string, tagStart: number, position: number): boolean;
/**
 * Returns if a given offset is inside of the document frontmatter
 */
export declare function isInsideFrontmatter(text: string, offset: number): boolean;
/**
 * Get the line and character based on the offset
 * @param offset The index of the position
 * @param text The text for which the position should be retrived
 * @param lineOffsets number Array with offsets for each line. Computed if not given
 */
export declare function positionAt(offset: number, text: string, lineOffsets?: number[]): Position;
/**
 * Get the offset of the line and character position
 * @param position Line and character position
 * @param text The text for which the offset should be retrived
 * @param lineOffsets number Array with offsets for each line. Computed if not given
 */
export declare function offsetAt(position: Position, text: string, lineOffsets?: number[]): number;
export declare function getLineOffsets(text: string): number[];
/**
 * Gets index of first-non-whitespace character.
 */
export declare function getFirstNonWhitespaceIndex(str: string): number;
