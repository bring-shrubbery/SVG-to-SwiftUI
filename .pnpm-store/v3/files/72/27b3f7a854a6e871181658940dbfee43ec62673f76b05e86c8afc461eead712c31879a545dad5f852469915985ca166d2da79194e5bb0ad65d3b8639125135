import type { ViteDevServer } from 'vite';
import type { AstroConfig, ComponentInstance, RouteData, RuntimeMode, SSRLoadedRenderer } from '../../../@types/astro';
import { LogOptions } from '../../logger/core.js';
import { RouteCache } from '../route-cache.js';
export interface SSROptions {
    /** an instance of the AstroConfig */
    astroConfig: AstroConfig;
    /** location of file on disk */
    filePath: URL;
    /** logging options */
    logging: LogOptions;
    /** "development" or "production" */
    mode: RuntimeMode;
    /** production website */
    origin: string;
    /** the web request (needed for dynamic routes) */
    pathname: string;
    /** optional, in case we need to render something outside of a dev server */
    route?: RouteData;
    /** pass in route cache because SSR can’t manage cache-busting */
    routeCache: RouteCache;
    /** Vite instance */
    viteServer: ViteDevServer;
    /** Request */
    request: Request;
}
export declare type ComponentPreload = [SSRLoadedRenderer[], ComponentInstance];
export declare function loadRenderers(viteServer: ViteDevServer, astroConfig: AstroConfig): Promise<SSRLoadedRenderer[]>;
export declare function preload({ astroConfig, filePath, viteServer, }: Pick<SSROptions, 'astroConfig' | 'filePath' | 'viteServer'>): Promise<ComponentPreload>;
/** use Vite to SSR */
export declare function render(renderers: SSRLoadedRenderer[], mod: ComponentInstance, ssrOpts: SSROptions): Promise<Response>;
export declare function ssr(preloadedComponent: ComponentPreload, ssrOpts: SSROptions): Promise<Response>;
