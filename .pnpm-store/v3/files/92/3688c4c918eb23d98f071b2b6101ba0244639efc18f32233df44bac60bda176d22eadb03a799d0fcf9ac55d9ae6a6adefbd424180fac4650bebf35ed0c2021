"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExperimentalParserPlugins = void 0;
/**
 * Returns a list of babel parser plugin names
 * @param importOrderParserPlugins array of experimental babel parser plugins
 * @returns list of parser plugins to be passed to babel parser
 */
var getExperimentalParserPlugins = function (importOrderParserPlugins) {
    return importOrderParserPlugins.map(function (pluginNameOrJson) {
        // ParserPlugin can be either a string or and array of [name: string, options: object]
        // in prettier options the array will be sent in a JSON string
        var isParserPluginWithOptions = pluginNameOrJson.startsWith('[');
        var plugin;
        if (isParserPluginWithOptions) {
            try {
                plugin = JSON.parse(pluginNameOrJson);
            }
            catch (e) {
                throw Error('Invalid JSON in importOrderParserPlugins: ' +
                    pluginNameOrJson);
            }
        }
        else {
            plugin = pluginNameOrJson;
        }
        return plugin;
    });
};
exports.getExperimentalParserPlugins = getExperimentalParserPlugins;
