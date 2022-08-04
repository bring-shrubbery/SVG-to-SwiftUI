interface ModuleInfo {
    module: Record<string, any>;
    specifier: string;
}
interface CreateMetadataOptions {
    modules: ModuleInfo[];
    hydratedComponents: any[];
    clientOnlyComponents: any[];
    hydrationDirectives: Set<string>;
    hoisted: any[];
}
export declare class Metadata {
    mockURL: URL;
    modules: ModuleInfo[];
    hoisted: any[];
    hydratedComponents: any[];
    clientOnlyComponents: any[];
    hydrationDirectives: Set<string>;
    private metadataCache;
    constructor(filePathname: string, opts: CreateMetadataOptions);
    resolvePath(specifier: string): string;
    getPath(Component: any): string | null;
    getExport(Component: any): string | null;
    hoistedScriptPaths(): Generator<string, void, unknown>;
    private deepMetadata;
    private getComponentMetadata;
    private findComponentMetadata;
}
export declare function createMetadata(filePathname: string, options: CreateMetadataOptions): Metadata;
export {};
