import type { AstroTelemetry } from '@astrojs/telemetry';
import type { AstroConfig } from '../../@types/astro';
import type { LogOptions } from '../logger/core';
export interface BuildOptions {
    mode?: string;
    logging: LogOptions;
    telemetry: AstroTelemetry;
}
/** `astro build` */
export default function build(config: AstroConfig, options: BuildOptions): Promise<void>;
