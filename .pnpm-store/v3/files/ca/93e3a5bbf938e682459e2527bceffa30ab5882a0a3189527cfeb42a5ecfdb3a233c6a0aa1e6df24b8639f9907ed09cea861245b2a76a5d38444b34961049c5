import { RootNode } from './ast';
export * from './ast';
export interface PreprocessorResult {
    code: string;
    map?: string;
}
export interface ParseOptions {
    position?: boolean;
}
export interface TransformOptions {
    internalURL?: string;
    site?: string;
    sourcefile?: string;
    pathname?: string;
    sourcemap?: boolean | 'inline' | 'external' | 'both';
    /**
     * @deprecated "as" has been removed and no longer has any effect!
     */
    as?: 'document' | 'fragment';
    projectRoot?: string;
    preprocessStyle?: (content: string, attrs: Record<string, string>) => Promise<PreprocessorResult>;
    experimentalStaticExtraction?: boolean;
}
export declare type HoistedScript = {
    type: string;
} & ({
    type: 'external';
    src: string;
} | {
    type: 'inline';
    code: string;
});
export interface HydratedComponent {
    exportName: string;
    specifier: string;
    resolvedPath: string;
}
export interface TransformResult {
    css: string[];
    scripts: HoistedScript[];
    hydratedComponents: HydratedComponent[];
    clientOnlyComponents: HydratedComponent[];
    code: string;
    map: string;
}
export interface TSXResult {
    code: string;
    map: string;
}
export interface ParseResult {
    ast: RootNode;
}
export declare function transform(input: string, options?: TransformOptions): Promise<TransformResult>;
export declare function parse(input: string, options?: ParseOptions): Promise<ParseResult>;
export declare function convertToTSX(input: string, options?: {
    sourcefile?: string;
}): Promise<TSXResult>;
export declare function initialize(options: InitializeOptions): Promise<void>;
export interface InitializeOptions {
    wasmURL?: string;
}
