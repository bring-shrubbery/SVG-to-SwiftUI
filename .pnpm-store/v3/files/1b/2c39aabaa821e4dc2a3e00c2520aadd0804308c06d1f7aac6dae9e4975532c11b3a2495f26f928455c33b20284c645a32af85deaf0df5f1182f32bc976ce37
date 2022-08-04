import type { EndpointHandler } from '../../@types/astro';
import type { RenderOptions } from '../render/core';
export declare type EndpointOptions = Pick<RenderOptions, 'logging' | 'origin' | 'request' | 'route' | 'routeCache' | 'pathname' | 'route' | 'site' | 'ssr'>;
declare type EndpointCallResult = {
    type: 'simple';
    body: string;
} | {
    type: 'response';
    response: Response;
};
export declare function call(mod: EndpointHandler, opts: EndpointOptions): Promise<EndpointCallResult>;
export {};
