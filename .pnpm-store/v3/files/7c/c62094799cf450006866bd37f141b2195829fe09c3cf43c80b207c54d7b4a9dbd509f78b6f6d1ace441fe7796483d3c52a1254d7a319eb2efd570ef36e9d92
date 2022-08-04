import type { Plugin } from 'vite';
import type { AstroConfig } from '../@types/astro';
import type { LogOptions } from '../core/logger/core.js';
interface AstroPluginJSXOptions {
    config: AstroConfig;
    logging: LogOptions;
}
/** Use Astro config to allow for alternate or multiple JSX renderers (by default Vite will assume React) */
export default function jsx({ config, logging }: AstroPluginJSXOptions): Plugin;
export {};
