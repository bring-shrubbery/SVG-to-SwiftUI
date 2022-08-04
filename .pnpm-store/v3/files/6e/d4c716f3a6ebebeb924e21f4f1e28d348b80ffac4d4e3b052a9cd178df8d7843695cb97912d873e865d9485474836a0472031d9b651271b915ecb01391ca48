import type { RouteData } from '../../@types/astro';
import type { SSRManifest as Manifest } from './types';
export { deserializeManifest } from './common.js';
export declare const pagesVirtualModuleId = "@astrojs-pages-virtual-entry";
export declare const resolvedPagesVirtualModuleId: string;
export declare class App {
    #private;
    constructor(manifest: Manifest, streaming?: boolean);
    match(request: Request): RouteData | undefined;
    render(request: Request, routeData?: RouteData): Promise<Response>;
}
