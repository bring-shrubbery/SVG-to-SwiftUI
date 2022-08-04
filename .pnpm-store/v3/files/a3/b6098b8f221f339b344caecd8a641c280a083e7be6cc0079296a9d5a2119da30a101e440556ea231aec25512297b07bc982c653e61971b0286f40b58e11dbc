"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const lodash_1 = require("lodash");
const defaultLSConfig = {
    astro: {
        enabled: true,
        diagnostics: { enabled: true },
        rename: { enabled: true },
        format: { enabled: true },
        completions: { enabled: true },
        hover: { enabled: true },
        codeActions: { enabled: true },
        selectionRange: { enabled: true },
    },
    typescript: {
        enabled: true,
        diagnostics: { enabled: true },
        hover: { enabled: true },
        completions: { enabled: true },
        definitions: { enabled: true },
        findReferences: { enabled: true },
        documentSymbols: { enabled: true },
        codeActions: { enabled: true },
        rename: { enabled: true },
        selectionRange: { enabled: true },
        signatureHelp: { enabled: true },
        semanticTokens: { enabled: true },
        implementation: { enabled: true },
        typeDefinition: { enabled: true },
    },
    css: {
        enabled: true,
        diagnostics: { enabled: true },
        hover: { enabled: true },
        completions: { enabled: true, emmet: true },
        documentColors: { enabled: true },
        colorPresentations: { enabled: true },
        documentSymbols: { enabled: true },
        selectionRange: { enabled: true },
    },
    html: {
        enabled: true,
        hover: { enabled: true },
        completions: { enabled: true, emmet: true },
        tagComplete: { enabled: true },
        documentSymbols: { enabled: true },
        renameTags: { enabled: true },
        linkedEditing: { enabled: true },
    },
};
/**
 * Manager class to facilitate accessing and updating the user's config
 * Not to be confused with other kind of configurations (such as the Astro project configuration and the TypeScript/Javascript one)
 * For more info on this, see the [internal docs](../../../../../docs/internal/language-server/config.md)
 */
class ConfigManager {
    constructor() {
        this.config = defaultLSConfig;
        this.emmetConfig = {};
        this.isTrusted = true;
    }
    updateConfig(config) {
        // Ideally we shouldn't need the merge here because all updates should be valid and complete configs.
        // But since those configs come from the client they might be out of synch with the valid config:
        // We might at some point in the future forget to synch config settings in all packages after updating the config.
        this.config = (0, lodash_1.merge)({}, defaultLSConfig, this.config, config);
    }
    updateEmmetConfig(config) {
        this.emmetConfig = config || {};
    }
    getEmmetConfig() {
        return this.emmetConfig;
    }
    /**
     * Whether or not specified setting is enabled
     * @param key a string which is a path. Example: 'astro.diagnostics.enabled'.
     */
    enabled(key) {
        return !!this.get(key);
    }
    /**
     * Get a specific setting value
     * @param key a string which is a path. Example: 'astro.diagnostics.enable'.
     */
    get(key) {
        return (0, lodash_1.get)(this.config, key);
    }
    /**
     * Get the entire user configuration
     */
    getFullConfig() {
        return this.config;
    }
}
exports.ConfigManager = ConfigManager;
