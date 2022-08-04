interface ErrorTemplateOptions {
    /** a short description of the error */
    message: string;
    /** information about where the error occurred */
    stack?: string;
    /** HTTP error code */
    statusCode?: number;
    /** HTML <title> */
    tabTitle: string;
    /** page title */
    title: string;
    /** show user a URL for more info or action to take */
    url?: string;
}
/** Display all errors */
export default function template({ title, url, message, stack, statusCode, tabTitle, }: ErrorTemplateOptions): string;
export {};
