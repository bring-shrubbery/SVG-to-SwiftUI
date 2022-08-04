import type { OutputAsset, OutputChunk, RollupOutput } from 'rollup';
import type { AstroConfig } from '../../@types/astro';
import type { BuildInternals } from '../../core/build/internal.js';
import type { PageBuildData, StaticBuildOptions } from './types';
export declare function rootRelativeFacadeId(facadeId: string, astroConfig: AstroConfig): string;
export declare function chunkIsPage(astroConfig: AstroConfig, output: OutputAsset | OutputChunk, internals: BuildInternals): boolean;
export declare function generatePages(result: RollupOutput, opts: StaticBuildOptions, internals: BuildInternals, facadeIdToPageDataMap: Map<string, PageBuildData>): Promise<void>;
