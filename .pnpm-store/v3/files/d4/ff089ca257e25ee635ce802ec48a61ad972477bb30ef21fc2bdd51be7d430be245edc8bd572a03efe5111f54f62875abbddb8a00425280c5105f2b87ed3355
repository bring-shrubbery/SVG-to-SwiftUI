import type { MarkdownRenderingOptions } from '@astrojs/markdown-remark';
import type { ComponentInstance, Params, Props, RouteData, SSRElement, SSRLoadedRenderer } from '../../@types/astro';
import type { LogOptions } from '../logger/core.js';
import { RouteCache } from './route-cache.js';
interface GetParamsAndPropsOptions {
    mod: ComponentInstance;
    route?: RouteData | undefined;
    routeCache: RouteCache;
    pathname: string;
    logging: LogOptions;
    ssr: boolean;
}
export declare const enum GetParamsAndPropsError {
    NoMatchingStaticPath = 0
}
export declare function getParamsAndProps(opts: GetParamsAndPropsOptions): Promise<[Params, Props] | GetParamsAndPropsError>;
export interface RenderOptions {
    logging: LogOptions;
    links: Set<SSRElement>;
    styles?: Set<SSRElement>;
    markdown: MarkdownRenderingOptions;
    mod: ComponentInstance;
    origin: string;
    pathname: string;
    scripts: Set<SSRElement>;
    resolve: (s: string) => Promise<string>;
    renderers: SSRLoadedRenderer[];
    route?: RouteData;
    routeCache: RouteCache;
    site?: string;
    ssr: boolean;
    streaming: boolean;
    request: Request;
}
export declare function render(opts: RenderOptions): Promise<Response>;
export {};
