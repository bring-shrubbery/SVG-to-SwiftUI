import ts from 'typescript';
import { DocumentSnapshot } from './snapshots/DocumentSnapshot';
/**
 * This should only be accessed by TS Astro module resolution.
 */
export declare function createAstroSys(getSnapshot: (fileName: string) => DocumentSnapshot): ts.System & {
    deleteFromCache: (path: string) => void;
};
