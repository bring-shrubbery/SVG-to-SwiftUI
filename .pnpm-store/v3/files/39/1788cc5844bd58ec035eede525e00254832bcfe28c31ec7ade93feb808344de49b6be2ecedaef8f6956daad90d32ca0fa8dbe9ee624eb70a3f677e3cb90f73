import { Fragment } from '../runtime/server/index.js';
declare const AstroJSX = "astro:jsx";
interface AstroVNode {
    [AstroJSX]: boolean;
    type: string | ((...args: any) => any) | typeof Fragment;
    props: Record<string, any>;
}
export declare function isVNode(vnode: any): vnode is AstroVNode;
export declare function transformSlots(vnode: AstroVNode): AstroVNode | undefined;
declare function createVNode(type: any, props: Record<string, any>): AstroVNode;
export { AstroJSX, createVNode as jsx, createVNode as jsxs, createVNode as jsxDEV, Fragment };
