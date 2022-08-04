"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticTokensProviderImpl = void 0;
const typescript_1 = __importDefault(require("typescript"));
const vscode_languageserver_1 = require("vscode-languageserver");
const documents_1 = require("../../../core/documents");
const utils_1 = require("../utils");
class SemanticTokensProviderImpl {
    constructor(languageServiceManager) {
        this.languageServiceManager = languageServiceManager;
    }
    async getSemanticTokens(document, range, cancellationToken) {
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        const fragment = (await tsDoc.createFragment());
        if (cancellationToken === null || cancellationToken === void 0 ? void 0 : cancellationToken.isCancellationRequested) {
            return null;
        }
        const filePath = (0, utils_1.toVirtualAstroFilePath)(tsDoc.filePath);
        const start = range ? fragment.offsetAt(fragment.getGeneratedPosition(range.start)) : 0;
        const { spans } = lang.getEncodedSemanticClassifications(filePath, {
            start,
            length: range
                ? fragment.offsetAt(fragment.getGeneratedPosition(range.end)) - start
                : // We don't want tokens for things added by astro2tsx
                    fragment.text.lastIndexOf('export default function (_props:') || fragment.text.length,
        }, typescript_1.default.SemanticClassificationFormat.TwentyTwenty);
        const tokens = [];
        let i = 0;
        while (i < spans.length) {
            const offset = spans[i++];
            const generatedLength = spans[i++];
            const classification = spans[i++];
            const originalPosition = this.mapToOrigin(document, fragment, offset, generatedLength);
            if (!originalPosition) {
                continue;
            }
            const [line, character, length] = originalPosition;
            const classificationType = this.getTokenTypeFromClassification(classification);
            if (classificationType < 0) {
                continue;
            }
            const modifier = this.getTokenModifierFromClassification(classification);
            tokens.push([line, character, length, classificationType, modifier]);
        }
        const sorted = tokens.sort((a, b) => {
            const [lineA, charA] = a;
            const [lineB, charB] = b;
            return lineA - lineB || charA - charB;
        });
        const builder = new vscode_languageserver_1.SemanticTokensBuilder();
        sorted.forEach((tokenData) => builder.push(...tokenData));
        const build = builder.build();
        return build;
    }
    mapToOrigin(document, fragment, generatedOffset, generatedLength) {
        const range = {
            start: fragment.positionAt(generatedOffset),
            end: fragment.positionAt(generatedOffset + generatedLength),
        };
        const { start: startPosition, end: endPosition } = (0, documents_1.mapRangeToOriginal)(fragment, range);
        if (startPosition.line < 0 || endPosition.line < 0) {
            return;
        }
        const startOffset = document.offsetAt(startPosition);
        const endOffset = document.offsetAt(endPosition);
        return [startPosition.line, startPosition.character, endOffset - startOffset, startOffset];
    }
    /**
     *  TSClassification = (TokenType + 1) << TokenEncodingConsts.typeOffset + TokenModifier
     */
    getTokenTypeFromClassification(tsClassification) {
        return (tsClassification >> 8 /* typeOffset */) - 1;
    }
    getTokenModifierFromClassification(tsClassification) {
        return tsClassification & 255 /* modifierMask */;
    }
}
exports.SemanticTokensProviderImpl = SemanticTokensProviderImpl;
