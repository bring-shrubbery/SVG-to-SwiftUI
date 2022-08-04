import type { OutputChunk, RenderedChunk } from 'rollup';
import type { PageBuildData, ViteID } from './types';
export interface BuildInternals {
    pureCSSChunks: Set<RenderedChunk>;
    hoistedScriptIdToHoistedMap: Map<string, Set<string>>;
    hoistedScriptIdToPagesMap: Map<string, Set<string>>;
    entrySpecifierToBundleMap: Map<string, string>;
    /**
     * A map for page-specific information.
     */
    pagesByComponent: Map<string, PageBuildData>;
    /**
     * A map for page-specific information by Vite ID (a path-like string)
     */
    pagesByViteID: Map<ViteID, PageBuildData>;
    /**
     * A map for page-specific information by a client:only component
     */
    pagesByClientOnly: Map<string, Set<PageBuildData>>;
    /**
     * A list of hydrated components that are discovered during the SSR build
     * These will be used as the top-level entrypoints for the client build.
     */
    discoveredHydratedComponents: Set<string>;
    /**
     * A list of client:only components that are discovered during the SSR build
     * These will be used as the top-level entrypoints for the client build.
     */
    discoveredClientOnlyComponents: Set<string>;
    /**
     * A list of hoisted scripts that are discovered during the SSR build
     * These will be used as the top-level entrypoints for the client build.
     */
    discoveredScripts: Set<string>;
    staticFiles: Set<string>;
    ssrEntryChunk?: OutputChunk;
}
/**
 * Creates internal maps used to coordinate the CSS and HTML plugins.
 * @returns {BuildInternals}
 */
export declare function createBuildInternals(): BuildInternals;
export declare function trackPageData(internals: BuildInternals, component: string, pageData: PageBuildData, componentModuleId: string, componentURL: URL): void;
/**
 * Tracks client-only components to the pages they are associated with.
 */
export declare function trackClientOnlyPageDatas(internals: BuildInternals, pageData: PageBuildData, clientOnlys: string[]): void;
export declare function getPageDatasByChunk(internals: BuildInternals, chunk: RenderedChunk): Generator<PageBuildData, void, unknown>;
export declare function getPageDatasByClientOnlyID(internals: BuildInternals, viteid: ViteID): Generator<PageBuildData, void, unknown>;
export declare function getPageDataByComponent(internals: BuildInternals, component: string): PageBuildData | undefined;
export declare function getPageDataByViteID(internals: BuildInternals, viteid: ViteID): PageBuildData | undefined;
export declare function hasPageDataByViteID(internals: BuildInternals, viteid: ViteID): boolean;
export declare function eachPageData(internals: BuildInternals): Generator<PageBuildData, void, undefined>;
