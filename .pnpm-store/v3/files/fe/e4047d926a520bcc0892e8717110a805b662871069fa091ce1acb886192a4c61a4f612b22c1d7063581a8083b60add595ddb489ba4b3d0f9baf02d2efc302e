import type { SnapshotFragment, DocumentSnapshot } from '../snapshots/DocumentSnapshot';
import type { LanguageServiceManager } from '../LanguageServiceManager';
export declare class SnapshotFragmentMap {
    private languageServiceManager;
    private map;
    constructor(languageServiceManager: LanguageServiceManager);
    set(fileName: string, content: {
        fragment: SnapshotFragment;
        snapshot: DocumentSnapshot;
    }): void;
    get(fileName: string): {
        fragment: SnapshotFragment;
        snapshot: DocumentSnapshot;
    } | undefined;
    getFragment(fileName: string): SnapshotFragment | undefined;
    retrieve(fileName: string): Promise<{
        fragment: SnapshotFragment;
        snapshot: DocumentSnapshot;
    }>;
    retrieveFragment(fileName: string): Promise<SnapshotFragment>;
}
