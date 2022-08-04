/// <reference types="node" />
import type { AddressInfo } from 'net';
import type { ViteDevServer } from 'vite';
import { AstroConfig, BuildConfig, RouteData } from '../@types/astro.js';
import type { SerializedSSRManifest } from '../core/app/types';
import type { PageBuildData } from '../core/build/types';
import type { ViteConfigWithSSR } from '../core/create-vite.js';
export declare function runHookConfigSetup({ config: _config, command, }: {
    config: AstroConfig;
    command: 'dev' | 'build';
}): Promise<AstroConfig>;
export declare function runHookConfigDone({ config }: {
    config: AstroConfig;
}): Promise<void>;
export declare function runHookServerSetup({ config, server, }: {
    config: AstroConfig;
    server: ViteDevServer;
}): Promise<void>;
export declare function runHookServerStart({ config, address, }: {
    config: AstroConfig;
    address: AddressInfo;
}): Promise<void>;
export declare function runHookServerDone({ config }: {
    config: AstroConfig;
}): Promise<void>;
export declare function runHookBuildStart({ config, buildConfig, }: {
    config: AstroConfig;
    buildConfig: BuildConfig;
}): Promise<void>;
export declare function runHookBuildSetup({ config, vite, pages, target, }: {
    config: AstroConfig;
    vite: ViteConfigWithSSR;
    pages: Map<string, PageBuildData>;
    target: 'server' | 'client';
}): Promise<void>;
export declare function runHookBuildSsr({ config, manifest, }: {
    config: AstroConfig;
    manifest: SerializedSSRManifest;
}): Promise<void>;
export declare function runHookBuildDone({ config, buildConfig, pages, routes, }: {
    config: AstroConfig;
    buildConfig: BuildConfig;
    pages: string[];
    routes: RouteData[];
}): Promise<void>;
