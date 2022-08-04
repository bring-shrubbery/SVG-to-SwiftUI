import type { MarkdownRenderingOptions } from '@astrojs/markdown-remark';
import type { Params, Props, SSRElement, SSRLoadedRenderer, SSRResult } from '../../@types/astro';
import { LogOptions } from '../logger/core.js';
export interface CreateResultArgs {
    ssr: boolean;
    streaming: boolean;
    logging: LogOptions;
    origin: string;
    markdown: MarkdownRenderingOptions;
    params: Params;
    pathname: string;
    props: Props;
    renderers: SSRLoadedRenderer[];
    resolve: (s: string) => Promise<string>;
    site: string | undefined;
    links?: Set<SSRElement>;
    scripts?: Set<SSRElement>;
    styles?: Set<SSRElement>;
    request: Request;
}
export declare function createResult(args: CreateResultArgs): SSRResult;
