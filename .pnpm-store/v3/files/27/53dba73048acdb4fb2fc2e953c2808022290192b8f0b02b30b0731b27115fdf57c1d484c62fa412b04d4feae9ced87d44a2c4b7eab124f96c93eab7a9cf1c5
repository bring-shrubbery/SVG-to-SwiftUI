import type { AstroComponentMetadata, SSRElement, SSRLoadedRenderer, SSRResult } from '../../@types/astro';
interface ExtractedProps {
    isPage: boolean;
    hydration: {
        directive: string;
        value: string;
        componentUrl: string;
        componentExport: {
            value: string;
        };
    } | null;
    props: Record<string | number, any>;
}
export declare function extractDirectives(inputProps: Record<string | number, any>): ExtractedProps;
interface HydrateScriptOptions {
    renderer: SSRLoadedRenderer;
    result: SSRResult;
    astroId: string;
    props: Record<string | number, any>;
}
/** For hydrated components, generate a <script type="module"> to load the component */
export declare function generateHydrateScript(scriptOptions: HydrateScriptOptions, metadata: Required<AstroComponentMetadata>): Promise<SSRElement>;
export {};
