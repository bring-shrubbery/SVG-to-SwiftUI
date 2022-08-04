export default function micromorph(from: Node, to: Node): Promise<void>;

export interface Patch {
    type: number;
    [key: string]: any;
}
export function diff(from: Node | undefined, to: Node | undefined): undefined | Patch;
export function patch(container: Node, patch: Patch): Promise<void>;
