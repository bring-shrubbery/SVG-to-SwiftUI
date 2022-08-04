'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var get_parser_plugins_1 = require('../get-parser-plugins');
test('it should return empty list', function () {
    expect(get_parser_plugins_1.getParserPlugins('babel')).toEqual([]);
});
test('it should return empty list when invalid parser is entered in prettier', function () {
    // @ts-ignore
    expect(get_parser_plugins_1.getParserPlugins('xxxxx')).toEqual([]);
});
test('it should return flow', function () {
    expect(get_parser_plugins_1.getParserPlugins('flow')).toEqual(['flow']);
});
test('it should return ts related plugins', function () {
    expect(get_parser_plugins_1.getParserPlugins('typescript')).toEqual([
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
    ]);
});
