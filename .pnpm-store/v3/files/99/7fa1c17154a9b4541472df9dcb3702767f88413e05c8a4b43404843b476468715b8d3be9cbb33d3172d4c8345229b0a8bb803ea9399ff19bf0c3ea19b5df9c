/**
 * @typedef {import('unist').Node} Node
 */
/**
 * Unist utility to create a new tree by mapping all nodes with the given function.
 *
 * @template {Node} Tree
 * @param {Tree} tree Tree to map
 * @param {import('./complex-types').MapFunction<Tree>} iteratee Function that returns a new node
 * @returns {Tree} New mapped tree.
 */
export function map<Tree extends import('unist').Node<import('unist').Data>>(
  tree: Tree,
  iteratee: import('./complex-types').MapFunction<Tree>
): Tree
export type Node = import('unist').Node
