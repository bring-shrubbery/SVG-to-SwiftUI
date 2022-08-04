/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "vscode-uri"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.joinPath = exports.dirname = void 0;
    var vscode_uri_1 = require("vscode-uri");
    function dirname(uriString) {
        return vscode_uri_1.Utils.dirname(vscode_uri_1.URI.parse(uriString)).toString();
    }
    exports.dirname = dirname;
    function joinPath(uriString) {
        var paths = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            paths[_i - 1] = arguments[_i];
        }
        return vscode_uri_1.Utils.joinPath.apply(vscode_uri_1.Utils, __spreadArray([vscode_uri_1.URI.parse(uriString)], paths, false)).toString();
    }
    exports.joinPath = joinPath;
});
