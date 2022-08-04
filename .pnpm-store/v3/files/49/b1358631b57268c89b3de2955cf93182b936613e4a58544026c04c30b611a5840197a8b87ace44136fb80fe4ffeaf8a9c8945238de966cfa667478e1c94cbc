import { escape } from 'html-escaper';
export declare const escapeHTML: typeof escape;
/**
 * A "blessed" extension of String that tells Astro that the string
 * has already been escaped. This helps prevent double-escaping of HTML.
 */
export declare class HTMLString extends String {
}
/**
 * markHTMLString marks a string as raw or "already escaped" by returning
 * a `HTMLString` instance. This is meant for internal use, and should not
 * be returned through any public JS API.
 */
export declare const markHTMLString: (value: any) => any;
