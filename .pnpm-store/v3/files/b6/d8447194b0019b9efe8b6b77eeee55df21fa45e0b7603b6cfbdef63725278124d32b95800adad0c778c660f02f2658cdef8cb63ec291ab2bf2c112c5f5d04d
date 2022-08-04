import type { ViteDevServer } from 'vite';
import type { AstroConfig, ManifestData } from '../../@types/astro';
import type { LogOptions } from '../logger/core';
import type { AllPagesData } from './types';
import { RouteCache } from '../render/route-cache.js';
export interface CollectPagesDataOptions {
    astroConfig: AstroConfig;
    logging: LogOptions;
    manifest: ManifestData;
    origin: string;
    routeCache: RouteCache;
    viteServer: ViteDevServer;
    ssr: boolean;
}
export interface CollectPagesDataResult {
    assets: Record<string, string>;
    allPages: AllPagesData;
}
export declare function collectPagesData(opts: CollectPagesDataOptions): Promise<CollectPagesDataResult>;
