import type { AstroConfig } from '../@types/astro';
import type { LogOptions } from './logger/core';
import * as vite from 'vite';
export declare type ViteConfigWithSSR = vite.InlineConfig & {
    ssr?: vite.SSROptions;
};
interface CreateViteOptions {
    astroConfig: AstroConfig;
    logging: LogOptions;
    mode: 'dev' | 'build';
}
/** Return a common starting point for all Vite actions */
export declare function createVite(commandConfig: ViteConfigWithSSR, { astroConfig, logging, mode }: CreateViteOptions): Promise<ViteConfigWithSSR>;
export {};
