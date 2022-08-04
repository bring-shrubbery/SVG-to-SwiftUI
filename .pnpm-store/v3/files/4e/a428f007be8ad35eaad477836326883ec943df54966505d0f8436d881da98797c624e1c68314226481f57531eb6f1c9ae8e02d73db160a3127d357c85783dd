/// <reference types="node" />
import type { AstroTelemetry } from '@astrojs/telemetry';
import type { AddressInfo } from 'net';
import * as vite from 'vite';
import type { AstroConfig } from '../../@types/astro';
import { LogOptions } from '../logger/core.js';
export interface DevOptions {
    logging: LogOptions;
    telemetry: AstroTelemetry;
}
export interface DevServer {
    address: AddressInfo;
    watcher: vite.FSWatcher;
    stop(): Promise<void>;
}
/** `astro dev` */
export default function dev(config: AstroConfig, options: DevOptions): Promise<DevServer>;
