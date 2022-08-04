"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotFragmentMap = void 0;
class SnapshotFragmentMap {
    constructor(languageServiceManager) {
        this.languageServiceManager = languageServiceManager;
        this.map = new Map();
    }
    set(fileName, content) {
        this.map.set(fileName, content);
    }
    get(fileName) {
        return this.map.get(fileName);
    }
    getFragment(fileName) {
        var _a;
        return (_a = this.map.get(fileName)) === null || _a === void 0 ? void 0 : _a.fragment;
    }
    async retrieve(fileName) {
        let snapshotFragment = this.get(fileName);
        if (!snapshotFragment) {
            const snapshot = await this.languageServiceManager.getSnapshot(fileName);
            const fragment = await snapshot.createFragment();
            snapshotFragment = { fragment, snapshot };
            this.set(fileName, snapshotFragment);
        }
        return snapshotFragment;
    }
    async retrieveFragment(fileName) {
        return (await this.retrieve(fileName)).fragment;
    }
}
exports.SnapshotFragmentMap = SnapshotFragmentMap;
