import { VSCodeEmmetConfig } from '@vscode/emmet-helper';
import { LSConfig } from './interfaces';
declare type DeepPartial<T> = T extends Record<string, unknown> ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;
/**
 * Manager class to facilitate accessing and updating the user's config
 * Not to be confused with other kind of configurations (such as the Astro project configuration and the TypeScript/Javascript one)
 * For more info on this, see the [internal docs](../../../../../docs/internal/language-server/config.md)
 */
export declare class ConfigManager {
    private config;
    private emmetConfig;
    private isTrusted;
    updateConfig(config: DeepPartial<LSConfig>): void;
    updateEmmetConfig(config: VSCodeEmmetConfig): void;
    getEmmetConfig(): VSCodeEmmetConfig;
    /**
     * Whether or not specified setting is enabled
     * @param key a string which is a path. Example: 'astro.diagnostics.enabled'.
     */
    enabled(key: string): boolean;
    /**
     * Get a specific setting value
     * @param key a string which is a path. Example: 'astro.diagnostics.enable'.
     */
    get<T>(key: string): T;
    /**
     * Get the entire user configuration
     */
    getFullConfig(): Readonly<LSConfig>;
}
export {};
