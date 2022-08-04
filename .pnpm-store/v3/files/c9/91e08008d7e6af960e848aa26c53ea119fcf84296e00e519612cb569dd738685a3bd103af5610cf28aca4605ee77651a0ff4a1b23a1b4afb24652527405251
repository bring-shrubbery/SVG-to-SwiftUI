/// <reference types="node" />
import type { SSRManifest } from './types';
import { IncomingMessage } from 'http';
import { App } from './index.js';
export declare class NodeApp extends App {
    match(req: IncomingMessage | Request): import("../../@types/astro").RouteData | undefined;
    render(req: IncomingMessage | Request): Promise<Response>;
}
export declare function loadManifest(rootFolder: URL): Promise<SSRManifest>;
export declare function loadApp(rootFolder: URL): Promise<NodeApp>;
