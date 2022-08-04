"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var get_experimental_parser_plugins_1 = require("../get-experimental-parser-plugins");
test('it should return empty list', function () {
    expect(get_experimental_parser_plugins_1.getExperimentalParserPlugins([])).toEqual([]);
});
test('it should return flow and decorators', function () {
    expect(get_experimental_parser_plugins_1.getExperimentalParserPlugins(['flow', 'decorators'])).toEqual([
        'flow',
        'decorators',
    ]);
});
test('it should return decorators with parsed options', function () {
    expect(get_experimental_parser_plugins_1.getExperimentalParserPlugins([
        '["decorators", { "decoratorsBeforeExport": true }]',
    ])).toEqual([['decorators', { decoratorsBeforeExport: true }]]);
});
test('it should return decorators with parsed options', function () {
    expect(get_experimental_parser_plugins_1.getExperimentalParserPlugins([
        'flow',
        '["decorators", { "decoratorsBeforeExport": true }]',
    ])).toEqual(['flow', ['decorators', { decoratorsBeforeExport: true }]]);
});
test('it should throw an Error for invalid JSON', function () {
    expect(function () {
        return get_experimental_parser_plugins_1.getExperimentalParserPlugins([
            'flow',
            '["decorators", { decoratorsBeforeExport: true }]',
        ]);
    }).toThrowError('Invalid JSON in importOrderParserPlugins: ');
});
