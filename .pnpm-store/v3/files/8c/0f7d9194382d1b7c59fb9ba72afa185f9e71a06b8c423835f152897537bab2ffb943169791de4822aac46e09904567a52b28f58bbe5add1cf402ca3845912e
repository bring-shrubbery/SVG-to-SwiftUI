"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HoverProviderImpl = void 0;
const typescript_1 = __importDefault(require("typescript"));
const documents_1 = require("../../../core/documents");
const previewer_1 = require("../previewer");
const utils_1 = require("../utils");
const partsMap = new Map([['JSX attribute', 'HTML attribute']]);
class HoverProviderImpl {
    constructor(languageServiceManager) {
        this.languageServiceManager = languageServiceManager;
    }
    async doHover(document, position) {
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        const fragment = await tsDoc.createFragment();
        const offset = fragment.offsetAt(fragment.getGeneratedPosition(position));
        const filePath = (0, utils_1.toVirtualAstroFilePath)(tsDoc.filePath);
        let info = lang.getQuickInfoAtPosition(filePath, offset);
        if (!info) {
            return null;
        }
        const textSpan = info.textSpan;
        const displayParts = (info.displayParts || []).map((value) => ({
            text: partsMap.has(value.text) ? partsMap.get(value.text) : value.text,
            kind: value.kind,
        }));
        const declaration = typescript_1.default.displayPartsToString(displayParts);
        const documentation = (0, previewer_1.getMarkdownDocumentation)(info.documentation, info.tags);
        // https://microsoft.github.io/language-server-protocol/specification#textDocument_hover
        const contents = ['```typescript', declaration, '```']
            .concat(documentation ? ['---', documentation] : [])
            .join('\n');
        return (0, documents_1.mapObjWithRangeToOriginal)(fragment, {
            range: (0, utils_1.convertRange)(fragment, textSpan),
            contents,
        });
    }
}
exports.HoverProviderImpl = HoverProviderImpl;
