import type { ErrorPayload } from 'vite';
import type { AstroConfig } from '../@types/astro';
export declare const ASTRO_VERSION: string;
/** Returns true if argument is an object of any prototype/class (but not null). */
export declare function isObject(value: unknown): value is Record<string, any>;
/** Wraps an object in an array. If an array is passed, ignore it. */
export declare function arraify<T>(target: T | T[]): T[];
export declare function padMultilineString(source: string, n?: number): string;
/**
 * Get the correct output filename for a route, based on your config.
 * Handles both "/foo" and "foo" `name` formats.
 * Handles `/404` and `/` correctly.
 */
export declare function getOutputFilename(astroConfig: AstroConfig, name: string): string;
/** is a specifier an npm package? */
export declare function parseNpmName(spec: string): {
    scope?: string;
    name: string;
    subpath?: string;
} | undefined;
/** Coalesce any throw variable to an Error instance. */
export declare function createSafeError(err: any): Error;
/** generate code frame from esbuild error */
export declare function codeFrame(src: string, loc: ErrorPayload['err']['loc']): string;
export declare function resolveDependency(dep: string, astroConfig: AstroConfig): string;
/**
 * Convert file URL to ID for viteServer.moduleGraph.idToModuleMap.get(:viteID)
 * Format:
 *   Linux/Mac:  /Users/astro/code/my-project/src/pages/index.astro
 *   Windows:    C:/Users/astro/code/my-project/src/pages/index.astro
 */
export declare function viteID(filePath: URL): string;
export declare const VALID_ID_PREFIX = "/@id/";
export declare function unwrapId(id: string): string;
/** An fs utility, similar to `rimraf` or `rm -rf` */
export declare function removeDir(_dir: URL): void;
export declare function emptyDir(_dir: URL, skip?: Set<string>): void;
export declare function resolvePages(config: AstroConfig): URL;
export declare function isPage(file: URL, config: AstroConfig): boolean;
export declare function isBuildingToSSR(config: AstroConfig): boolean;
export declare function emoji(char: string, fallback: string): string;
export declare function getLocalAddress(serverAddress: string, host: string | boolean): string;
