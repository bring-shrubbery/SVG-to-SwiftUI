"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const parseAstro_1 = require("../../core/documents/parseAstro");
function addProps(content) {
    let defaultExportType = 'Record<string, any>';
    if (/(interface|type) Props/.test(content)) {
        defaultExportType = 'Props';
    }
    return os_1.EOL + `export default function (_props: ${defaultExportType}) { return <div></div>; }`;
}
function escapeTemplateLiteralContent(content) {
    return content.replace(/`/g, '\\`');
}
function default_1(content) {
    var _a, _b;
    let result = {
        code: '',
    };
    const astroDocument = (0, parseAstro_1.parseAstro)(content);
    // Frontmatter replacements
    let frontMatterRaw = '';
    if (astroDocument.frontmatter.state === 'closed') {
        frontMatterRaw = content
            .substring((_a = astroDocument.frontmatter.startOffset) !== null && _a !== void 0 ? _a : 0, ((_b = astroDocument.frontmatter.endOffset) !== null && _b !== void 0 ? _b : 0) + 3)
            // Handle case where semicolons is not used in the frontmatter section
            .replace(/((?!^)(?<!;)\n)(---)/g, (_whole, start, _dashes) => {
            return start + ';' + '//';
        })
            // Replace frontmatter marks with comments
            .replace(/---/g, '///');
    }
    // Content replacement
    const htmlBegin = astroDocument.frontmatter.endOffset ? astroDocument.frontmatter.endOffset + 3 : 0;
    let htmlRaw = content
        .substring(htmlBegin)
        // Turn comments into JS comments
        .replace(/<\s*!--([^-->]*)(.*?)-->/gs, (whole) => {
        return `{/*${whole}*/}`;
    })
        // Turn styles into internal strings
        .replace(/<\s*style([^>]*)>(.*?)<\s*\/\s*style>/gs, (_whole, attrs, children) => {
        return `<style${attrs}>{\`${escapeTemplateLiteralContent(children)}\`}</style>`;
    })
        // Turn scripts into function calls
        .replace(/<\s*script([^\/>]*)>(.*?)<\s*\/\s*script>/gs, (_whole, attrs, children, offset) => {
        return `<script${attrs}>{()=>{${children}}}</script>`;
    })
        // Close void elements
        .replace(/<(\s*(meta|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)([^>]*))>/g, (whole, inner) => {
        if (whole.endsWith('/>'))
            return whole;
        return `<${inner} />`;
    })
        // Replace `@` prefixed attributes with `_` prefix
        .replace(/<([$A-Z_a-z][^\s\/>]*)([^\/>]*)>/g, (whole, tag, attrs) => {
        if (attrs.includes('@')) {
            return `<${tag}${attrs.replace(
            // the following regular expression captures:
            //   $1. any character that may appear before an attribute name (https://html.spec.whatwg.org/#before-attribute-name-state)
            // then, one `@` at sign, then:
            //   $2. any characters that may appear in an attribute name (https://html.spec.whatwg.org/#attribute-name-state)
            // then, looking ahead any one character that may not appear in an attribute name, or the end
            /([\f\n\r\t "'])@([^\f\n\r\t /=>"'<]+)(?=[\f\n\r\t /=>"'<]|$)/g, '$1_$2')}>`;
        }
        else {
            return whole;
        }
    })
        // Fix doctypes
        .replace(/<!(doctype html)>/gi, (_whole, main) => {
        return `<${main.toLowerCase()}/>`;
    });
    result.code =
        frontMatterRaw +
            htmlRaw +
            os_1.EOL +
            // Add TypeScript definitions
            addProps(frontMatterRaw);
    return result;
}
exports.default = default_1;
