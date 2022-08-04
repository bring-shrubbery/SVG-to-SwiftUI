import toString from 'nlcst-to-string'
import modifyChildren from 'unist-util-modify-children'

// Merge a sentence into its previous sentence, when the sentence starts with a
// comma.
export var mergeAffixExceptions = modifyChildren(function (
  child,
  index,
  parent
) {
  var children = child.children
  var node
  var position
  var value
  var previousChild

  if (!children || children.length === 0 || index < 1) {
    return
  }

  position = -1

  while (children[++position]) {
    node = children[position]

    if (node.type === 'WordNode') {
      return
    }

    if (node.type === 'SymbolNode' || node.type === 'PunctuationNode') {
      value = toString(node)

      if (value !== ',' && value !== ';') {
        return
      }

      previousChild = parent.children[index - 1]

      previousChild.children = previousChild.children.concat(children)

      // Update position.
      if (previousChild.position && child.position) {
        previousChild.position.end = child.position.end
      }

      parent.children.splice(index, 1)

      // Next, iterate over the node *now* at the current position.
      return index
    }
  }
})
