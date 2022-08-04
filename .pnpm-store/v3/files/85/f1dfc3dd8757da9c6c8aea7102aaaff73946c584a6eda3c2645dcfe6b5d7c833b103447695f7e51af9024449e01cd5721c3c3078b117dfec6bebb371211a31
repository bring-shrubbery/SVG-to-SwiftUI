/// <reference types="node" />
import type { AstroTelemetry } from '@astrojs/telemetry';
import type { AstroConfig } from '../../@types/astro';
import type { LogOptions } from '../logger/core';
import http from 'http';
interface PreviewOptions {
    logging: LogOptions;
    telemetry: AstroTelemetry;
}
export interface PreviewServer {
    host?: string;
    port: number;
    server: http.Server;
    closed(): Promise<void>;
    stop(): Promise<void>;
}
/** The primary dev action */
export default function preview(config: AstroConfig, { logging }: PreviewOptions): Promise<PreviewServer>;
export {};
