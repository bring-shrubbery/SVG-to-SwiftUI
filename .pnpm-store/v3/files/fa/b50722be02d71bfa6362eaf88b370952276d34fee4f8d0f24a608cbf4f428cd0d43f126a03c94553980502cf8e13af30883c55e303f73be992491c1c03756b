"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTSX = exports.extension = exports.languageId = void 0;
const svelte2tsx_1 = require("svelte2tsx");
exports.languageId = 'svelte';
exports.extension = '.svelte';
function toTSX(code, className) {
    let result = `
		let ${className}__AstroComponent_: Error
		export default ${className}__AstroComponent_
	`;
    try {
        let tsx = (0, svelte2tsx_1.svelte2tsx)(code).code;
        tsx = 'let Props = render().props;\n' + tsx;
        // Replace Svelte's class export with a function export
        result = tsx.replace(/^export default[\S\s]*/gm, `export default function ${className}__AstroComponent_(_props: typeof Props): any {}`);
    }
    catch (e) {
        return result;
    }
    return result;
}
exports.toTSX = toTSX;
