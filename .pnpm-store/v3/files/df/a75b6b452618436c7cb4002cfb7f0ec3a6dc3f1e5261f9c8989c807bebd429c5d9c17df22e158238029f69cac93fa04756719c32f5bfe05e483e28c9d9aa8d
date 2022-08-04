"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticsProviderImpl = void 0;
const typescript_1 = __importDefault(require("typescript"));
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const documents_1 = require("../../../core/documents");
const utils_1 = require("../utils");
class DiagnosticsProviderImpl {
    constructor(languageServiceManager) {
        this.languageServiceManager = languageServiceManager;
    }
    async getDiagnostics(document, _cancellationToken) {
        var _a, _b, _c;
        // Don't return diagnostics for files inside node_modules. These are considered read-only
        // and they would pollute the output for astro check
        if (((_a = document.getFilePath()) === null || _a === void 0 ? void 0 : _a.includes('/node_modules/')) || ((_b = document.getFilePath()) === null || _b === void 0 ? void 0 : _b.includes('\\node_modules\\'))) {
            return [];
        }
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        const filePath = (0, utils_1.toVirtualAstroFilePath)(tsDoc.filePath);
        const { script: scriptBoundaries, markdown: markdownBoundaries } = this.getTagBoundaries(lang, filePath);
        const syntaxDiagnostics = lang.getSyntacticDiagnostics(filePath);
        const suggestionDiagnostics = lang.getSuggestionDiagnostics(filePath);
        const semanticDiagnostics = lang.getSemanticDiagnostics(filePath).filter((d) => {
            return isNoWithinScript(scriptBoundaries, d);
        });
        const diagnostics = [...syntaxDiagnostics, ...suggestionDiagnostics, ...semanticDiagnostics];
        const fragment = await tsDoc.createFragment();
        const sourceFile = (_c = lang.getProgram()) === null || _c === void 0 ? void 0 : _c.getSourceFile(filePath);
        const isNoFalsePositiveInst = isNoFalsePositive();
        return diagnostics
            .map((diagnostic) => ({
            range: (0, utils_1.convertRange)(tsDoc, diagnostic),
            severity: (0, utils_1.mapSeverity)(diagnostic.category),
            source: 'ts',
            message: typescript_1.default.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            code: diagnostic.code,
            tags: getDiagnosticTag(diagnostic),
        }))
            .map(mapRange(fragment, document))
            .filter((diag) => {
            return (hasNoNegativeLines(diag) &&
                isNoFalsePositiveInst(diag) &&
                isNoJSXImplicitRuntimeWarning(diag) &&
                isNoJSXMustHaveOneParent(diag) &&
                isNoCantUseJSX(diag) &&
                isNoCantEndWithTS(diag) &&
                isNoSpreadExpected(diag) &&
                isNoCantResolveJSONModule(diag) &&
                isNoMarkdownBlockQuoteWithinMarkdown(sourceFile, markdownBoundaries, diag));
        })
            .map(enhanceIfNecessary);
    }
    getTagBoundaries(lang, tsFilePath) {
        const program = lang.getProgram();
        const sourceFile = program === null || program === void 0 ? void 0 : program.getSourceFile(tsFilePath);
        const boundaries = {
            script: [],
            markdown: [],
        };
        if (!sourceFile) {
            return boundaries;
        }
        function findScript(parent) {
            typescript_1.default.forEachChild(parent, (node) => {
                if (typescript_1.default.isJsxElement(node)) {
                    let tagName = node.openingElement.tagName.getText();
                    switch (tagName) {
                        case 'script': {
                            typescript_1.default.getLineAndCharacterOfPosition(sourceFile, node.getStart());
                            boundaries.script.push([node.getStart(), node.getEnd()]);
                            break;
                        }
                        case 'Markdown': {
                            boundaries.markdown.push([node.getStart(), node.getEnd()]);
                            break;
                        }
                    }
                }
                findScript(node);
            });
        }
        findScript(sourceFile);
        return boundaries;
    }
}
exports.DiagnosticsProviderImpl = DiagnosticsProviderImpl;
function getDiagnosticTag(diagnostic) {
    const tags = [];
    if (diagnostic.reportsUnnecessary) {
        tags.push(vscode_languageserver_types_1.DiagnosticTag.Unnecessary);
    }
    if (diagnostic.reportsDeprecated) {
        tags.push(vscode_languageserver_types_1.DiagnosticTag.Deprecated);
    }
    return tags;
}
function mapRange(fragment, _document) {
    return (diagnostic) => {
        let range = (0, documents_1.mapRangeToOriginal)(fragment, diagnostic.range);
        if (range.start.line < 0) {
            // Could be a props error?
            // From svelte
        }
        return { ...diagnostic, range };
    };
}
/**
 * In some rare cases mapping of diagnostics does not work and produces negative lines.
 * We filter out these diagnostics with negative lines because else the LSP
 * apparently has a hickup and does not show any diagnostics at all.
 */
function hasNoNegativeLines(diagnostic) {
    return diagnostic.range.start.line >= 0 && diagnostic.range.end.line >= 0;
}
function isNoFalsePositive() {
    return (diagnostic) => {
        return isNoJsxCannotHaveMultipleAttrsError(diagnostic);
    };
}
/**
 * Jsx cannot have multiple attributes with same name,
 * but that's allowed for svelte
 */
function isNoJsxCannotHaveMultipleAttrsError(diagnostic) {
    return diagnostic.code !== 17001;
}
function isNoJSXImplicitRuntimeWarning(diagnostic) {
    return diagnostic.code !== 7016 && diagnostic.code !== 2792;
}
function isNoJSXMustHaveOneParent(diagnostic) {
    return diagnostic.code !== 2657;
}
function isNoCantUseJSX(diagnostic) {
    return diagnostic.code !== 17004 && diagnostic.code !== 6142;
}
function isNoCantEndWithTS(diagnostic) {
    return diagnostic.code !== 2691;
}
function isNoSpreadExpected(diagnostic) {
    return diagnostic.code !== 1005;
}
function isWithinBoundaries(boundaries, start) {
    for (let [bstart, bend] of boundaries) {
        if (start > bstart && start < bend) {
            return true;
        }
    }
    return false;
}
function diagnosticIsWithinBoundaries(sourceFile, boundaries, diagnostic) {
    if ('start' in diagnostic) {
        if (diagnostic.start == null)
            return false;
        return isWithinBoundaries(boundaries, diagnostic.start);
    }
    if (!sourceFile)
        return false;
    let startRange = diagnostic.range.start;
    let pos = typescript_1.default.getPositionOfLineAndCharacter(sourceFile, startRange.line, startRange.character);
    return isWithinBoundaries(boundaries, pos);
}
function isNoWithinScript(boundaries, diagnostic) {
    return !diagnosticIsWithinBoundaries(undefined, boundaries, diagnostic);
}
/**
 * This allows us to have JSON module imports.
 */
function isNoCantResolveJSONModule(diagnostic) {
    return diagnostic.code !== 2732;
}
/**
 * This is for using > within a markdown component like:
 * <Markdown>
 *   > Blockquote here.
 * </Markdown>
 */
function isNoMarkdownBlockQuoteWithinMarkdown(sourceFile, boundaries, diagnostic) {
    if (diagnostic.code !== 1382) {
        return true;
    }
    return !diagnosticIsWithinBoundaries(sourceFile, boundaries, diagnostic);
}
/**
 * Some diagnostics have JSX-specific nomenclature. Enhance them for more clarity.
 */
function enhanceIfNecessary(diagnostic) {
    if (diagnostic.code === 2322) {
        // For the rare case where an user might try to put a client directive on something that is not a component
        if (diagnostic.message.includes("Property 'client:") && diagnostic.message.includes("to type 'HTMLProps")) {
            return {
                ...diagnostic,
                message: 'Client directives are only available on framework components',
            };
        }
    }
    return diagnostic;
}
