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
export function map(tree, iteratee) {
  // @ts-expect-error Looks like a children.
  return preorder(tree, null, null)

  /** @type {import('./complex-types').MapFunction<Tree>} */
  function preorder(node, index, parent) {
    var newNode = Object.assign({}, iteratee(node, index, parent))

    if ('children' in node) {
      // @ts-expect-error Looks like a parent.
      newNode.children = node.children.map(function (
        /** @type {import('./complex-types').InclusiveDescendant<Tree>} */ child,
        /** @type {number} */ index
      ) {
        return preorder(child, index, node)
      })
    }

    return newNode
  }
}
