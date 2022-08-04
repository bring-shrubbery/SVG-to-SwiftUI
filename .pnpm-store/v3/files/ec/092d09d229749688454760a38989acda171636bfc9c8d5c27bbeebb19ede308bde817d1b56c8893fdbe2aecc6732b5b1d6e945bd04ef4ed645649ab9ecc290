"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debounceThrottle = exports.debounceSameArg = exports.isBeforeOrEqualToPosition = exports.isInRange = exports.isNotNullOrUndefined = exports.clamp = exports.flatten = exports.isPossibleComponent = exports.getLastPartOfPath = exports.pathToUrl = exports.urlToPath = exports.normalizePath = exports.normalizeUri = void 0;
const vscode_uri_1 = require("vscode-uri");
/** Normalizes a document URI */
function normalizeUri(uri) {
    return vscode_uri_1.URI.parse(uri).toString();
}
exports.normalizeUri = normalizeUri;
/**
 * Some paths (on windows) start with a upper case driver letter, some don't.
 * This is normalized here.
 */
function normalizePath(path) {
    return vscode_uri_1.URI.file(path).fsPath.replace(/\\/g, '/');
}
exports.normalizePath = normalizePath;
/** Turns a URL into a normalized FS Path */
function urlToPath(stringUrl) {
    const url = vscode_uri_1.URI.parse(stringUrl);
    if (url.scheme !== 'file') {
        return null;
    }
    return url.fsPath.replace(/\\/g, '/');
}
exports.urlToPath = urlToPath;
/** Converts a path to a URL */
function pathToUrl(path) {
    return vscode_uri_1.URI.file(path).toString();
}
exports.pathToUrl = pathToUrl;
/**
 * Given a path like foo/bar or foo/bar.astro , returns its last path
 * (bar or bar.astro in this example).
 */
function getLastPartOfPath(path) {
    return path.replace(/\\/g, '/').split('/').pop() || '';
}
exports.getLastPartOfPath = getLastPartOfPath;
/**
 * Return true if a specific node could be a component.
 * This is not a 100% sure test as it'll return false for any component that does not match the standard format for a component
 */
function isPossibleComponent(node) {
    var _a, _b;
    return !!((_a = node.tag) === null || _a === void 0 ? void 0 : _a[0].match(/[A-Z]/)) || !!((_b = node.tag) === null || _b === void 0 ? void 0 : _b.match(/.+[.][A-Z]/));
}
exports.isPossibleComponent = isPossibleComponent;
/** Flattens an array */
function flatten(arr) {
    return arr.reduce((all, item) => [...all, ...item], []);
}
exports.flatten = flatten;
/** Clamps a number between min and max */
function clamp(num, min, max) {
    return Math.max(min, Math.min(max, num));
}
exports.clamp = clamp;
function isNotNullOrUndefined(val) {
    return val !== undefined && val !== null;
}
exports.isNotNullOrUndefined = isNotNullOrUndefined;
function isInRange(range, positionToTest) {
    return isBeforeOrEqualToPosition(range.end, positionToTest) && isBeforeOrEqualToPosition(positionToTest, range.start);
}
exports.isInRange = isInRange;
function isBeforeOrEqualToPosition(position, positionToTest) {
    return (positionToTest.line < position.line ||
        (positionToTest.line === position.line && positionToTest.character <= position.character));
}
exports.isBeforeOrEqualToPosition = isBeforeOrEqualToPosition;
/**
 * Debounces a function but cancels previous invocation only if
 * a second function determines it should.
 *
 * @param fn The function with it's argument
 * @param determineIfSame The function which determines if the previous invocation should be canceld or not
 * @param milliseconds Number of miliseconds to debounce
 */
function debounceSameArg(fn, shouldCancelPrevious, milliseconds) {
    let timeout;
    let prevArg;
    return (arg) => {
        if (shouldCancelPrevious(arg, prevArg)) {
            clearTimeout(timeout);
        }
        prevArg = arg;
        timeout = setTimeout(() => {
            fn(arg);
            prevArg = undefined;
        }, milliseconds);
    };
}
exports.debounceSameArg = debounceSameArg;
/**
 * Debounces a function but also waits at minimum the specified number of milliseconds until
 * the next invocation. This avoids needless calls when a synchronous call (like diagnostics)
 * took too long and the whole timeout of the next call was eaten up already.
 *
 * @param fn The function with it's argument
 * @param milliseconds Number of milliseconds to debounce/throttle
 */
function debounceThrottle(fn, milliseconds) {
    let timeout;
    let lastInvocation = Date.now() - milliseconds;
    function maybeCall(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if (Date.now() - lastInvocation < milliseconds) {
                maybeCall(...args);
                return;
            }
            fn(...args);
            lastInvocation = Date.now();
        }, milliseconds);
    }
    return maybeCall;
}
exports.debounceThrottle = debounceThrottle;
