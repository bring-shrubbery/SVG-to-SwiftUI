import type { RehypePlugin, RemarkPlugin } from '@astrojs/markdown-remark';
import type { ILanguageRegistration, IThemeRegistration, Theme } from 'shiki';
import type { Arguments as Flags } from 'yargs-parser';
import type { AstroConfig, AstroUserConfig, CLIFlags, ViteUserConfig } from '../@types/astro';
import { z } from 'zod';
export declare const LEGACY_ASTRO_CONFIG_KEYS: Set<string>;
export declare const AstroConfigSchema: z.ZodObject<{
    adapter: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        hooks: z.ZodDefault<z.ZodObject<{}, "passthrough", z.ZodTypeAny, {}, {}>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        hooks: {};
    }, {
        hooks?: {} | undefined;
        name: string;
    }>>;
    root: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, URL, string | undefined>;
    srcDir: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, URL, string | undefined>;
    publicDir: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, URL, string | undefined>;
    outDir: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, URL, string | undefined>;
    site: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>, string | undefined, string | undefined>;
    base: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, string, string | undefined>;
    trailingSlash: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"always">, z.ZodLiteral<"never">, z.ZodLiteral<"ignore">]>>>;
    build: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        format: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"file">, z.ZodLiteral<"directory">]>>>;
    }, "strip", z.ZodTypeAny, {
        format: "file" | "directory";
    }, {
        format?: "file" | "directory" | undefined;
    }>>>;
    server: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodObject<{
        host: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodBoolean]>>>;
        port: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        host: string | boolean;
        port: number;
    }, {
        host?: string | boolean | undefined;
        port?: number | undefined;
    }>>>, {
        host: string | boolean;
        port: number;
    }, {
        host?: string | boolean | undefined;
        port?: number | undefined;
    } | undefined>;
    integrations: z.ZodEffects<z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        hooks: z.ZodDefault<z.ZodObject<{}, "passthrough", z.ZodTypeAny, {}, {}>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        hooks: {};
    }, {
        hooks?: {} | undefined;
        name: string;
    }>, "many">>, {
        name: string;
        hooks: {};
    }[], {
        hooks?: {} | undefined;
        name: string;
    }[] | undefined>;
    style: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        postcss: z.ZodDefault<z.ZodOptional<z.ZodObject<{
            options: z.ZodAny;
            plugins: z.ZodArray<z.ZodAny, "many">;
        }, "strip", z.ZodTypeAny, {
            options?: any;
            plugins: any[];
        }, {
            options?: any;
            plugins: any[];
        }>>>;
    }, "strip", z.ZodTypeAny, {
        postcss: {
            options?: any;
            plugins: any[];
        };
    }, {
        postcss?: {
            options?: any;
            plugins: any[];
        } | undefined;
    }>>>;
    markdown: z.ZodDefault<z.ZodObject<{
        mode: z.ZodDefault<z.ZodEnum<["md", "mdx"]>>;
        drafts: z.ZodDefault<z.ZodBoolean>;
        syntaxHighlight: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"shiki">, z.ZodLiteral<"prism">, z.ZodLiteral<false>]>>;
        shikiConfig: z.ZodDefault<z.ZodObject<{
            langs: z.ZodDefault<z.ZodArray<z.ZodType<ILanguageRegistration, z.ZodTypeDef, ILanguageRegistration>, "many">>;
            theme: z.ZodDefault<z.ZodUnion<[z.ZodEnum<[Theme, ...Theme[]]>, z.ZodType<IThemeRegistration, z.ZodTypeDef, IThemeRegistration>]>>;
            wrap: z.ZodDefault<z.ZodUnion<[z.ZodBoolean, z.ZodNull]>>;
        }, "strip", z.ZodTypeAny, {
            langs: ILanguageRegistration[];
            theme: "css-variables" | "dark-plus" | "dracula-soft" | "dracula" | "github-dark-dimmed" | "github-dark" | "github-light" | "light-plus" | "material-darker" | "material-default" | "material-lighter" | "material-ocean" | "material-palenight" | "min-dark" | "min-light" | "monokai" | "nord" | "one-dark-pro" | "poimandres" | "rose-pine-dawn" | "rose-pine-moon" | "rose-pine" | "slack-dark" | "slack-ochin" | "solarized-dark" | "solarized-light" | "vitesse-dark" | "vitesse-light" | import("shiki").IShikiTheme | (string & {});
            wrap: boolean | null;
        }, {
            langs?: ILanguageRegistration[] | undefined;
            theme?: "css-variables" | "dark-plus" | "dracula-soft" | "dracula" | "github-dark-dimmed" | "github-dark" | "github-light" | "light-plus" | "material-darker" | "material-default" | "material-lighter" | "material-ocean" | "material-palenight" | "min-dark" | "min-light" | "monokai" | "nord" | "one-dark-pro" | "poimandres" | "rose-pine-dawn" | "rose-pine-moon" | "rose-pine" | "slack-dark" | "slack-ochin" | "solarized-dark" | "solarized-light" | "vitesse-dark" | "vitesse-light" | import("shiki").IShikiTheme | (string & {}) | undefined;
            wrap?: boolean | null | undefined;
        }>>;
        remarkPlugins: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodTuple<[z.ZodString, z.ZodAny], null>, z.ZodType<RemarkPlugin<any[]>, z.ZodTypeDef, RemarkPlugin<any[]>>, z.ZodTuple<[z.ZodType<RemarkPlugin<any[]>, z.ZodTypeDef, RemarkPlugin<any[]>>, z.ZodAny], null>]>, "many">>;
        rehypePlugins: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodTuple<[z.ZodString, z.ZodAny], null>, z.ZodType<RehypePlugin<any[]>, z.ZodTypeDef, RehypePlugin<any[]>>, z.ZodTuple<[z.ZodType<RehypePlugin<any[]>, z.ZodTypeDef, RehypePlugin<any[]>>, z.ZodAny], null>]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        mode: "md" | "mdx";
        drafts: boolean;
        syntaxHighlight: false | "shiki" | "prism";
        shikiConfig: {
            langs: ILanguageRegistration[];
            theme: "css-variables" | "dark-plus" | "dracula-soft" | "dracula" | "github-dark-dimmed" | "github-dark" | "github-light" | "light-plus" | "material-darker" | "material-default" | "material-lighter" | "material-ocean" | "material-palenight" | "min-dark" | "min-light" | "monokai" | "nord" | "one-dark-pro" | "poimandres" | "rose-pine-dawn" | "rose-pine-moon" | "rose-pine" | "slack-dark" | "slack-ochin" | "solarized-dark" | "solarized-light" | "vitesse-dark" | "vitesse-light" | import("shiki").IShikiTheme | (string & {});
            wrap: boolean | null;
        };
        remarkPlugins: (string | [string, any] | RemarkPlugin<any[]> | [RemarkPlugin<any[]>, any])[];
        rehypePlugins: (string | [string, any] | RehypePlugin<any[]> | [RehypePlugin<any[]>, any])[];
    }, {
        mode?: "md" | "mdx" | undefined;
        drafts?: boolean | undefined;
        syntaxHighlight?: false | "shiki" | "prism" | undefined;
        shikiConfig?: {
            langs?: ILanguageRegistration[] | undefined;
            theme?: "css-variables" | "dark-plus" | "dracula-soft" | "dracula" | "github-dark-dimmed" | "github-dark" | "github-light" | "light-plus" | "material-darker" | "material-default" | "material-lighter" | "material-ocean" | "material-palenight" | "min-dark" | "min-light" | "monokai" | "nord" | "one-dark-pro" | "poimandres" | "rose-pine-dawn" | "rose-pine-moon" | "rose-pine" | "slack-dark" | "slack-ochin" | "solarized-dark" | "solarized-light" | "vitesse-dark" | "vitesse-light" | import("shiki").IShikiTheme | (string & {}) | undefined;
            wrap?: boolean | null | undefined;
        } | undefined;
        remarkPlugins?: (string | [string, any] | RemarkPlugin<any[]> | [RemarkPlugin<any[]>, any])[] | undefined;
        rehypePlugins?: (string | [string, any] | RehypePlugin<any[]> | [RehypePlugin<any[]>, any])[] | undefined;
    }>>;
    vite: z.ZodDefault<z.ZodType<ViteUserConfig, z.ZodTypeDef, ViteUserConfig>>;
    experimental: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        ssr: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        integrations: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        integrations: boolean;
        ssr: boolean;
    }, {
        integrations?: boolean | undefined;
        ssr?: boolean | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    site?: string | undefined;
    adapter?: {
        name: string;
        hooks: {};
    } | undefined;
    base: string;
    markdown: {
        mode: "md" | "mdx";
        drafts: boolean;
        syntaxHighlight: false | "shiki" | "prism";
        shikiConfig: {
            langs: ILanguageRegistration[];
            theme: "css-variables" | "dark-plus" | "dracula-soft" | "dracula" | "github-dark-dimmed" | "github-dark" | "github-light" | "light-plus" | "material-darker" | "material-default" | "material-lighter" | "material-ocean" | "material-palenight" | "min-dark" | "min-light" | "monokai" | "nord" | "one-dark-pro" | "poimandres" | "rose-pine-dawn" | "rose-pine-moon" | "rose-pine" | "slack-dark" | "slack-ochin" | "solarized-dark" | "solarized-light" | "vitesse-dark" | "vitesse-light" | import("shiki").IShikiTheme | (string & {});
            wrap: boolean | null;
        };
        remarkPlugins: (string | [string, any] | RemarkPlugin<any[]> | [RemarkPlugin<any[]>, any])[];
        rehypePlugins: (string | [string, any] | RehypePlugin<any[]> | [RehypePlugin<any[]>, any])[];
    };
    root: URL;
    srcDir: URL;
    publicDir: URL;
    outDir: URL;
    trailingSlash: "never" | "always" | "ignore";
    build: {
        format: "file" | "directory";
    };
    server: {
        host: string | boolean;
        port: number;
    };
    integrations: {
        name: string;
        hooks: {};
    }[];
    style: {
        postcss: {
            options?: any;
            plugins: any[];
        };
    };
    vite: ViteUserConfig;
    experimental: {
        integrations: boolean;
        ssr: boolean;
    };
}, {
    site?: string | undefined;
    base?: string | undefined;
    markdown?: {
        mode?: "md" | "mdx" | undefined;
        drafts?: boolean | undefined;
        syntaxHighlight?: false | "shiki" | "prism" | undefined;
        shikiConfig?: {
            langs?: ILanguageRegistration[] | undefined;
            theme?: "css-variables" | "dark-plus" | "dracula-soft" | "dracula" | "github-dark-dimmed" | "github-dark" | "github-light" | "light-plus" | "material-darker" | "material-default" | "material-lighter" | "material-ocean" | "material-palenight" | "min-dark" | "min-light" | "monokai" | "nord" | "one-dark-pro" | "poimandres" | "rose-pine-dawn" | "rose-pine-moon" | "rose-pine" | "slack-dark" | "slack-ochin" | "solarized-dark" | "solarized-light" | "vitesse-dark" | "vitesse-light" | import("shiki").IShikiTheme | (string & {}) | undefined;
            wrap?: boolean | null | undefined;
        } | undefined;
        remarkPlugins?: (string | [string, any] | RemarkPlugin<any[]> | [RemarkPlugin<any[]>, any])[] | undefined;
        rehypePlugins?: (string | [string, any] | RehypePlugin<any[]> | [RehypePlugin<any[]>, any])[] | undefined;
    } | undefined;
    adapter?: {
        hooks?: {} | undefined;
        name: string;
    } | undefined;
    root?: string | undefined;
    srcDir?: string | undefined;
    publicDir?: string | undefined;
    outDir?: string | undefined;
    trailingSlash?: "never" | "always" | "ignore" | undefined;
    build?: {
        format?: "file" | "directory" | undefined;
    } | undefined;
    server?: {
        host?: string | boolean | undefined;
        port?: number | undefined;
    } | undefined;
    integrations?: {
        hooks?: {} | undefined;
        name: string;
    }[] | undefined;
    style?: {
        postcss?: {
            options?: any;
            plugins: any[];
        } | undefined;
    } | undefined;
    vite?: ViteUserConfig | undefined;
    experimental?: {
        integrations?: boolean | undefined;
        ssr?: boolean | undefined;
    } | undefined;
}>;
/** Turn raw config values into normalized values */
export declare function validateConfig(userConfig: any, root: string, cmd: string): Promise<AstroConfig>;
interface LoadConfigOptions {
    cwd?: string;
    flags?: Flags;
    cmd: string;
    validate?: boolean;
}
/**
 * Resolve the file URL of the user's `astro.config.js|cjs|mjs|ts` file
 * Note: currently the same as loadConfig but only returns the `filePath`
 * instead of the resolved config
 */
export declare function resolveConfigURL(configOptions: Pick<LoadConfigOptions, 'cwd' | 'flags'>): Promise<URL | undefined>;
interface OpenConfigResult {
    userConfig: AstroUserConfig;
    astroConfig: AstroConfig;
    flags: CLIFlags;
    root: string;
}
/** Load a configuration file, returning both the userConfig and astroConfig */
export declare function openConfig(configOptions: LoadConfigOptions): Promise<OpenConfigResult>;
/**
 * Attempt to load an `astro.config.mjs` file
 * @deprecated
 */
export declare function loadConfig(configOptions: LoadConfigOptions): Promise<AstroConfig>;
/** Attempt to resolve an Astro configuration object. Normalize, validate, and return. */
export declare function resolveConfig(userConfig: AstroUserConfig, root: string, flags: CLIFlags | undefined, cmd: string): Promise<AstroConfig>;
export declare function mergeConfig(defaults: Record<string, any>, overrides: Record<string, any>, isRoot?: boolean): Record<string, any>;
export {};
