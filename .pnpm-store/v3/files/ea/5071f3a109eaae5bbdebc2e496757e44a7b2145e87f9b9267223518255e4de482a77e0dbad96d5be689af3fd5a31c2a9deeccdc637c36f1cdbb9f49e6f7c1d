import type { ComponentInstance, GetStaticPathsResult } from '../../@types/astro';
import type { LogOptions } from '../logger/core';
interface ValidationOptions {
    ssr: boolean;
}
/** Throws error for invalid parameter in getStaticPaths() response */
export declare function validateGetStaticPathsParameter([key, value]: [string, any]): void;
/** Throw error for deprecated/malformed APIs */
export declare function validateGetStaticPathsModule(mod: ComponentInstance, { ssr }: ValidationOptions): void;
/** Throw error for malformed getStaticPaths() response */
export declare function validateGetStaticPathsResult(result: GetStaticPathsResult, logging: LogOptions): void;
export {};
