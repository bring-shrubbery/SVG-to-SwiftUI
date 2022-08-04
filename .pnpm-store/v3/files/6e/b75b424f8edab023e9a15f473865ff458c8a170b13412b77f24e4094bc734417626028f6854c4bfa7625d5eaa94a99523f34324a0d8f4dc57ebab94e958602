import toString from 'nlcst-to-string'
import modifyChildren from 'unist-util-modify-children'

// Merge certain punctuation marks into their following words.
export var mergeInitialWordSymbol = modifyChildren(function (
  child,
  index,
  parent
) {
  var children
  var next

  if (
    (child.type !== 'SymbolNode' && child.type !== 'PunctuationNode') ||
    toString(child) !== '&'
  ) {
    return
  }

  children = parent.children

  next = children[index + 1]

  // If either a previous word, or no following word, exists, exit early.
  if (
    (index > 0 && children[index - 1].type === 'WordNode') ||
    !(next && next.type === 'WordNode')
  ) {
    return
  }

  // Remove `child` from parent.
  children.splice(index, 1)

  // Add the punctuation mark at the start of the next node.
  next.children.unshift(child)

  // Update position.
  if (next.position && child.position) {
    next.position.start = child.position.start
  }

  // Next, iterate over the node at the previous position, as it's now adjacent
  // to a following word.
  return index - 1
})
