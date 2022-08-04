import type { ComponentInstance, GetStaticPathsItem, GetStaticPathsResultKeyed, Params, RouteData } from '../../@types/astro';
import { LogOptions } from '../logger/core.js';
interface CallGetStaticPathsOptions {
    mod: ComponentInstance;
    route: RouteData;
    isValidate: boolean;
    logging: LogOptions;
    ssr: boolean;
}
export declare function callGetStaticPaths({ isValidate, logging, mod, route, ssr, }: CallGetStaticPathsOptions): Promise<RouteCacheEntry>;
export interface RouteCacheEntry {
    staticPaths: GetStaticPathsResultKeyed;
}
/**
 * Manange the route cache, responsible for caching data related to each route,
 * including the result of calling getStaticPath() so that it can be reused across
 * responses during dev and only ever called once during build.
 */
export declare class RouteCache {
    private logging;
    private cache;
    constructor(logging: LogOptions);
    /** Clear the cache. */
    clearAll(): void;
    set(route: RouteData, entry: RouteCacheEntry): void;
    get(route: RouteData): RouteCacheEntry | undefined;
}
export declare function findPathItemByKey(staticPaths: GetStaticPathsResultKeyed, params: Params): GetStaticPathsItem | undefined;
export {};
