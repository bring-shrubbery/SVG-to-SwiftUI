import type { PluginContext } from 'rollup';
import type * as vite from 'vite';
export declare type TransformHook = (code: string, id: string, ssr?: boolean) => Promise<vite.TransformResult>;
/** Load vite:css’ transform() hook */
export declare function getViteTransform(viteConfig: vite.ResolvedConfig): TransformHook;
interface TransformWithViteOptions {
    value: string;
    lang: string;
    id: string;
    transformHook: TransformHook;
    pluginContext: PluginContext;
    ssr?: boolean;
}
/** Transform style using Vite hook */
export declare function transformWithVite({ value, lang, transformHook, id, ssr, pluginContext, }: TransformWithViteOptions): Promise<vite.TransformResult | null>;
export {};
