import type { PluginContext as RollupPluginContext } from 'rollup';
import type { HmrContext, ModuleNode, ViteDevServer } from 'vite';
import type { AstroConfig } from '../@types/astro';
import type { LogOptions } from '../core/logger/core.js';
interface TrackCSSDependenciesOptions {
    viteDevServer: ViteDevServer | null;
    filename: string;
    id: string;
    deps: Set<string>;
}
export declare function trackCSSDependencies(this: RollupPluginContext, opts: TrackCSSDependenciesOptions): Promise<void>;
export declare function handleHotUpdate(ctx: HmrContext, config: AstroConfig, logging: LogOptions): Promise<ModuleNode[]>;
export {};
