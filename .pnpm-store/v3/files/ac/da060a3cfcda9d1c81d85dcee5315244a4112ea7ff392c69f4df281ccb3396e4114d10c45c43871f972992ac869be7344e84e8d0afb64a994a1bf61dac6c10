import type { AstroGlobalPartial, EndpointHandler, Params, SSRResult } from '../../@types/astro';
export { escapeHTML, HTMLString, markHTMLString, markHTMLString as unescapeHTML, } from './escape.js';
export type { Metadata } from './metadata';
export { createMetadata } from './metadata.js';
export declare const voidElementNames: RegExp;
export declare class AstroComponent {
    private htmlParts;
    private expressions;
    constructor(htmlParts: TemplateStringsArray, expressions: any[]);
    get [Symbol.toStringTag](): string;
    [Symbol.asyncIterator](): AsyncGenerator<any, void, undefined>;
}
export declare function render(htmlParts: TemplateStringsArray, ...expressions: any[]): Promise<AstroComponent>;
export interface AstroComponentFactory {
    (result: any, props: any, slots: any): ReturnType<typeof render> | Response;
    isAstroComponentFactory?: boolean;
}
export declare function createComponent(cb: AstroComponentFactory): AstroComponentFactory;
export declare function renderSlot(_result: any, slotted: string, fallback?: any): Promise<string>;
export declare function mergeSlots(...slotted: unknown[]): Record<string, () => any>;
export declare const Fragment: unique symbol;
export declare function renderComponent(result: SSRResult, displayName: string, Component: unknown, _props: Record<string | number, any>, slots?: any): Promise<string | AsyncIterable<string>>;
export declare function createAstro(filePathname: string, _site: string, projectRootStr: string): AstroGlobalPartial;
export declare function addAttribute(value: any, key: string, shouldEscape?: boolean): any;
export declare function spreadAttributes(values: Record<any, any>, name?: string, { class: scopedClassName }?: {
    class?: string;
}): any;
export declare function defineStyleVars(selector: string, vars: Record<any, any>): any;
export declare function defineScriptVars(vars: Record<any, any>): any;
/** Renders an endpoint request to completion, returning the body. */
export declare function renderEndpoint(mod: EndpointHandler, request: Request, params: Params): Promise<Response | import("../../@types/astro").EndpointOutput>;
export declare function renderToString(result: SSRResult, componentFactory: AstroComponentFactory, props: any, children: any): Promise<string>;
export declare function renderToIterable(result: SSRResult, componentFactory: AstroComponentFactory, props: any, children: any): Promise<AsyncIterable<string>>;
export declare function renderPage(result: SSRResult, componentFactory: AstroComponentFactory, props: any, children: any, streaming: boolean): Promise<Response>;
export declare function renderHead(result: SSRResult): Promise<string>;
export declare function maybeRenderHead(result: SSRResult): AsyncIterable<string>;
export declare function renderAstroComponent(component: InstanceType<typeof AstroComponent>): AsyncIterable<string>;
export declare function renderHTMLElement(result: SSRResult, constructor: typeof HTMLElement, props: any, slots: any): Promise<any>;
