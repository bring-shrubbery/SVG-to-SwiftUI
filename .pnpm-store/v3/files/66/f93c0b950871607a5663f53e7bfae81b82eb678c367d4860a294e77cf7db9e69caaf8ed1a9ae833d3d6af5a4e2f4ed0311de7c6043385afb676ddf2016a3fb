import type { TransformResult } from '@astrojs/compiler';
import type { PluginContext } from 'rollup';
import type { AstroConfig } from '../@types/astro';
import type { TransformHook } from './styles';
declare type CompileResult = TransformResult & {
    rawCSSDeps: Set<string>;
};
export interface CompileProps {
    config: AstroConfig;
    filename: string;
    moduleId: string;
    source: string;
    ssr: boolean;
    viteTransform: TransformHook;
    pluginContext: PluginContext;
}
export declare function isCached(config: AstroConfig, filename: string): boolean;
export declare function invalidateCompilation(config: AstroConfig, filename: string): void;
export declare function cachedCompilation(props: CompileProps): Promise<CompileResult>;
export {};
