import type * as vite from 'vite';
import { RuntimeMode } from '../../../@types/astro.js';
/** Given a filePath URL, crawl Vite’s module graph to find all style imports. */
export declare function getStylesForURL(filePath: URL, viteServer: vite.ViteDevServer, mode: RuntimeMode): Promise<{
    urls: Set<string>;
    stylesMap: Map<string, string>;
}>;
