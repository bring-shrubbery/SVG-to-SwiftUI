import { Position, Range } from 'vscode-languageserver';
import { Node } from 'vscode-html-languageservice';
/** Normalizes a document URI */
export declare function normalizeUri(uri: string): string;
/**
 * Some paths (on windows) start with a upper case driver letter, some don't.
 * This is normalized here.
 */
export declare function normalizePath(path: string): string;
/** Turns a URL into a normalized FS Path */
export declare function urlToPath(stringUrl: string): string | null;
/** Converts a path to a URL */
export declare function pathToUrl(path: string): string;
/**
 * Given a path like foo/bar or foo/bar.astro , returns its last path
 * (bar or bar.astro in this example).
 */
export declare function getLastPartOfPath(path: string): string;
/**
 * Return true if a specific node could be a component.
 * This is not a 100% sure test as it'll return false for any component that does not match the standard format for a component
 */
export declare function isPossibleComponent(node: Node): boolean;
/** Flattens an array */
export declare function flatten<T>(arr: T[][]): T[];
/** Clamps a number between min and max */
export declare function clamp(num: number, min: number, max: number): number;
export declare function isNotNullOrUndefined<T>(val: T | undefined | null): val is T;
export declare function isInRange(range: Range, positionToTest: Position): boolean;
export declare function isBeforeOrEqualToPosition(position: Position, positionToTest: Position): boolean;
/**
 * Debounces a function but cancels previous invocation only if
 * a second function determines it should.
 *
 * @param fn The function with it's argument
 * @param determineIfSame The function which determines if the previous invocation should be canceld or not
 * @param milliseconds Number of miliseconds to debounce
 */
export declare function debounceSameArg<T>(fn: (arg: T) => void, shouldCancelPrevious: (newArg: T, prevArg?: T) => boolean, milliseconds: number): (arg: T) => void;
/**
 * Debounces a function but also waits at minimum the specified number of milliseconds until
 * the next invocation. This avoids needless calls when a synchronous call (like diagnostics)
 * took too long and the whole timeout of the next call was eaten up already.
 *
 * @param fn The function with it's argument
 * @param milliseconds Number of milliseconds to debounce/throttle
 */
export declare function debounceThrottle<T extends (...args: any) => void>(fn: T, milliseconds: number): T;
