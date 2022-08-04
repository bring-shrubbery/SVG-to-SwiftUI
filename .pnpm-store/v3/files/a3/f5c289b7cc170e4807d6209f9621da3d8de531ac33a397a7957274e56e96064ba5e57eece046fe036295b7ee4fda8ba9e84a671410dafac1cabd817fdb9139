"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstroPlugin = void 0;
const typescript_1 = __importDefault(require("typescript"));
const vscode_languageserver_1 = require("vscode-languageserver");
const documents_1 = require("../../core/documents");
const utils_1 = require("../../utils");
const LanguageServiceManager_1 = require("../typescript/LanguageServiceManager");
const utils_2 = require("../typescript/utils");
const CompletionsProvider_1 = require("./features/CompletionsProvider");
class AstroPlugin {
    constructor(docManager, configManager, workspaceUris) {
        this.__name = 'astro';
        this.configManager = configManager;
        this.languageServiceManager = new LanguageServiceManager_1.LanguageServiceManager(docManager, workspaceUris, configManager);
        this.completionProvider = new CompletionsProvider_1.CompletionsProviderImpl(docManager, this.languageServiceManager);
    }
    async getCompletions(document, position, completionContext) {
        const completions = this.completionProvider.getCompletions(document, position, completionContext);
        return completions;
    }
    getFoldingRanges(document) {
        const foldingRanges = [];
        const { frontmatter } = document.astroMeta;
        // Currently editing frontmatter, don't fold
        if (frontmatter.state !== 'closed')
            return foldingRanges;
        const start = document.positionAt(frontmatter.startOffset);
        const end = document.positionAt(frontmatter.endOffset - 3);
        return [
            {
                startLine: start.line,
                startCharacter: start.character,
                endLine: end.line,
                endCharacter: end.character,
                kind: vscode_languageserver_1.FoldingRangeKind.Imports,
            },
        ];
    }
    async getDefinitions(document, position) {
        if (this.isInsideFrontmatter(document, position)) {
            return [];
        }
        const offset = document.offsetAt(position);
        const html = document.html;
        const node = html.findNodeAt(offset);
        if (!this.isComponentTag(node)) {
            return [];
        }
        const [componentName] = node.tag.split(':');
        const { lang, tsDoc } = await this.languageServiceManager.getLSAndTSDoc(document);
        const defs = this.getDefinitionsForComponentName(document, lang, componentName);
        if (!defs || !defs.length) {
            return [];
        }
        const startRange = vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(0, 0), vscode_languageserver_1.Position.create(0, 0));
        const links = defs.map((def) => {
            const defFilePath = (0, utils_2.ensureRealFilePath)(def.fileName);
            return vscode_languageserver_1.LocationLink.create((0, utils_1.pathToUrl)(defFilePath), startRange, startRange);
        });
        return links;
    }
    isInsideFrontmatter(document, position) {
        return (0, documents_1.isInsideFrontmatter)(document.getText(), document.offsetAt(position));
    }
    isComponentTag(node) {
        if (!node.tag) {
            return false;
        }
        const firstChar = node.tag[0];
        return /[A-Z]/.test(firstChar);
    }
    getDefinitionsForComponentName(document, lang, componentName) {
        const filePath = (0, utils_1.urlToPath)(document.uri);
        const tsFilePath = (0, utils_2.toVirtualAstroFilePath)(filePath);
        const program = lang.getProgram();
        const sourceFile = program === null || program === void 0 ? void 0 : program.getSourceFile(tsFilePath);
        if (!sourceFile) {
            return undefined;
        }
        const specifier = this.getImportSpecifierForIdentifier(sourceFile, componentName);
        if (!specifier) {
            return [];
        }
        const defs = lang.getDefinitionAtPosition(tsFilePath, specifier.getStart());
        if (!defs) {
            return undefined;
        }
        return defs;
    }
    getImportSpecifierForIdentifier(sourceFile, identifier) {
        let importSpecifier = undefined;
        typescript_1.default.forEachChild(sourceFile, (tsNode) => {
            if (typescript_1.default.isImportDeclaration(tsNode)) {
                if (tsNode.importClause) {
                    const { name, namedBindings } = tsNode.importClause;
                    if (name && name.getText() === identifier) {
                        importSpecifier = tsNode.moduleSpecifier;
                        return true;
                    }
                    else if (namedBindings && namedBindings.kind === typescript_1.default.SyntaxKind.NamedImports) {
                        const elements = namedBindings.elements;
                        for (let elem of elements) {
                            if (elem.name.getText() === identifier) {
                                importSpecifier = tsNode.moduleSpecifier;
                                return true;
                            }
                        }
                    }
                }
            }
        });
        return importSpecifier;
    }
}
exports.AstroPlugin = AstroPlugin;
