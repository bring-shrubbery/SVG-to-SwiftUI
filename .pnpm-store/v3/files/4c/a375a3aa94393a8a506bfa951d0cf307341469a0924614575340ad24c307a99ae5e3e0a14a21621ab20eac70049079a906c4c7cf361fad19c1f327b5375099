"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLanguageServiceForTsconfig = exports.forAllLanguageServices = exports.getLanguageService = void 0;
const path_1 = require("path");
const typescript_1 = __importDefault(require("typescript"));
const utils_1 = require("../../utils");
const module_loader_1 = require("./module-loader");
const SnapshotManager_1 = require("./snapshots/SnapshotManager");
const utils_2 = require("./utils");
const DocumentSnapshotUtils = __importStar(require("./snapshots/utils"));
const services = new Map();
async function getLanguageService(path, workspaceUris, docContext) {
    const tsconfigPath = (0, utils_2.findTsConfigPath)(path, workspaceUris);
    return getLanguageServiceForTsconfig(tsconfigPath, docContext);
}
exports.getLanguageService = getLanguageService;
async function forAllLanguageServices(cb) {
    for (const service of services.values()) {
        cb(await service);
    }
}
exports.forAllLanguageServices = forAllLanguageServices;
/**
 * @param tsconfigPath has to be absolute
 * @param docContext
 */
async function getLanguageServiceForTsconfig(tsconfigPath, docContext) {
    let service;
    if (services.has(tsconfigPath)) {
        service = await services.get(tsconfigPath);
    }
    else {
        const newService = createLanguageService(tsconfigPath, docContext);
        services.set(tsconfigPath, newService);
        service = await newService;
    }
    return service;
}
exports.getLanguageServiceForTsconfig = getLanguageServiceForTsconfig;
async function createLanguageService(tsconfigPath, docContext) {
    const workspaceRoot = tsconfigPath ? (0, path_1.dirname)(tsconfigPath) : '';
    // `raw` here represent the tsconfig merged with any extended config
    const { compilerOptions, fileNames: files, raw: fullConfig } = getParsedTSConfig();
    let projectVersion = 0;
    const snapshotManager = new SnapshotManager_1.SnapshotManager(docContext.globalSnapshotManager, files, fullConfig, workspaceRoot || process.cwd());
    const astroModuleLoader = (0, module_loader_1.createAstroModuleLoader)(getScriptSnapshot, compilerOptions);
    let languageServerDirectory;
    try {
        languageServerDirectory = (0, path_1.dirname)(require.resolve('@astrojs/language-server'));
    }
    catch (e) {
        languageServerDirectory = __dirname;
    }
    const astroTSXFile = typescript_1.default.sys.resolvePath((0, path_1.resolve)(languageServerDirectory, '../types/astro-jsx.d.ts'));
    const host = {
        getNewLine: () => typescript_1.default.sys.newLine,
        useCaseSensitiveFileNames: () => typescript_1.default.sys.useCaseSensitiveFileNames,
        getDirectories: typescript_1.default.sys.getDirectories,
        resolveModuleNames: astroModuleLoader.resolveModuleNames,
        readFile: astroModuleLoader.readFile,
        fileExists: astroModuleLoader.fileExists,
        readDirectory: astroModuleLoader.readDirectory,
        getCompilationSettings: () => compilerOptions,
        getCurrentDirectory: () => workspaceRoot,
        getDefaultLibFileName: typescript_1.default.getDefaultLibFilePath,
        getProjectVersion: () => projectVersion.toString(),
        getScriptFileNames: () => Array.from(new Set([...snapshotManager.getProjectFileNames(), ...snapshotManager.getFileNames(), astroTSXFile])),
        getScriptSnapshot,
        getScriptVersion: (fileName) => getScriptSnapshot(fileName).version.toString(),
    };
    let languageService = typescript_1.default.createLanguageService(host);
    docContext.globalSnapshotManager.onChange(() => {
        projectVersion++;
    });
    return {
        tsconfigPath,
        compilerOptions,
        getService: () => languageService,
        updateSnapshot,
        deleteSnapshot,
        updateProjectFiles,
        updateNonAstroFile,
        hasFile,
        fileBelongsToProject,
        snapshotManager,
    };
    function deleteSnapshot(filePath) {
        astroModuleLoader.deleteFromModuleCache(filePath);
        snapshotManager.delete(filePath);
    }
    function updateSnapshot(documentOrFilePath) {
        return typeof documentOrFilePath === 'string'
            ? updateSnapshotFromFilePath(documentOrFilePath)
            : updateSnapshotFromDocument(documentOrFilePath);
    }
    function updateSnapshotFromDocument(document) {
        const filePath = document.getFilePath() || '';
        const prevSnapshot = snapshotManager.get(filePath);
        if ((prevSnapshot === null || prevSnapshot === void 0 ? void 0 : prevSnapshot.version) === document.version) {
            return prevSnapshot;
        }
        if (!prevSnapshot) {
            astroModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);
        }
        const newSnapshot = DocumentSnapshotUtils.createFromDocument(document);
        snapshotManager.set(filePath, newSnapshot);
        if (prevSnapshot && prevSnapshot.scriptKind !== newSnapshot.scriptKind) {
            // Restart language service as it doesn't handle script kind changes.
            languageService.dispose();
            languageService = typescript_1.default.createLanguageService(host);
        }
        return newSnapshot;
    }
    function updateSnapshotFromFilePath(filePath) {
        const prevSnapshot = snapshotManager.get(filePath);
        if (prevSnapshot) {
            return prevSnapshot;
        }
        astroModuleLoader.deleteUnresolvedResolutionsFromCache(filePath);
        const newSnapshot = DocumentSnapshotUtils.createFromFilePath(filePath, docContext.createDocument);
        snapshotManager.set(filePath, newSnapshot);
        return newSnapshot;
    }
    function getScriptSnapshot(fileName) {
        fileName = (0, utils_2.ensureRealFilePath)(fileName);
        let doc = snapshotManager.get(fileName);
        if (doc) {
            return doc;
        }
        astroModuleLoader.deleteUnresolvedResolutionsFromCache(fileName);
        doc = DocumentSnapshotUtils.createFromFilePath(fileName, docContext.createDocument);
        snapshotManager.set(fileName, doc);
        return doc;
    }
    function updateProjectFiles() {
        projectVersion++;
        snapshotManager.updateProjectFiles();
    }
    function hasFile(filePath) {
        return snapshotManager.has(filePath);
    }
    function fileBelongsToProject(filePath) {
        filePath = (0, utils_1.normalizePath)(filePath);
        return hasFile(filePath) || getParsedTSConfig().fileNames.includes(filePath);
    }
    function updateNonAstroFile(fileName, changes) {
        if (!snapshotManager.has(fileName)) {
            astroModuleLoader.deleteUnresolvedResolutionsFromCache(fileName);
        }
        snapshotManager.updateNonAstroFile(fileName, changes);
    }
    function getParsedTSConfig() {
        var _a, _b, _c;
        let configJson = (tsconfigPath && typescript_1.default.readConfigFile(tsconfigPath, typescript_1.default.sys.readFile).config) || {};
        // If our user has types in their config but it doesn't include the types needed for Astro, add them to the config
        if (((_a = configJson.compilerOptions) === null || _a === void 0 ? void 0 : _a.types) && !((_b = configJson.compilerOptions) === null || _b === void 0 ? void 0 : _b.types.includes('astro/env'))) {
            configJson.compilerOptions.types.push('astro/env');
        }
        configJson.compilerOptions = Object.assign(getDefaultCompilerOptions(), configJson.compilerOptions);
        // Delete include so that .astro files don't get mistakenly excluded by the user
        delete configJson.include;
        // If the user supplied exclude, let's use theirs otherwise, use ours
        (_c = configJson.exclude) !== null && _c !== void 0 ? _c : (configJson.exclude = getDefaultExclude());
        // Everything here will always, unconditionally, be in the resulting config
        const forcedCompilerOptions = {
            noEmit: true,
            declaration: false,
            allowNonTsExtensions: true,
            allowJs: true,
            jsx: typescript_1.default.JsxEmit.Preserve,
            jsxImportSource: undefined,
            jsxFactory: 'astroHTML',
            module: typescript_1.default.ModuleKind.ESNext,
            target: typescript_1.default.ScriptTarget.ESNext,
            moduleResolution: typescript_1.default.ModuleResolutionKind.NodeJs,
        };
        const project = typescript_1.default.parseJsonConfigFileContent(configJson, typescript_1.default.sys, workspaceRoot, forcedCompilerOptions, tsconfigPath, undefined, [
            { extension: '.vue', isMixedContent: true, scriptKind: typescript_1.default.ScriptKind.Deferred },
            { extension: '.svelte', isMixedContent: true, scriptKind: typescript_1.default.ScriptKind.Deferred },
            { extension: '.astro', isMixedContent: true, scriptKind: typescript_1.default.ScriptKind.Deferred },
        ]);
        return {
            ...project,
            fileNames: project.fileNames.map(utils_1.normalizePath),
            compilerOptions: {
                ...project.options,
                ...forcedCompilerOptions,
            },
        };
    }
}
/**
 * Default configuration used as a base and when the user doesn't have any
 */
function getDefaultCompilerOptions() {
    return {
        maxNodeModuleJsDepth: 2,
        allowSyntheticDefaultImports: true,
        types: ['astro/env'],
    };
}
function getDefaultExclude() {
    return ['dist', 'node_modules'];
}
