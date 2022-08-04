import modifyChildren from 'unist-util-modify-children'

// Move white space ending a paragraph up, so they are the siblings of
// paragraphs.
export var makeFinalWhiteSpaceSiblings = modifyChildren(function (
  child,
  index,
  parent
) {
  var children = child.children
  var previous

  if (
    children &&
    children.length > 0 &&
    children[children.length - 1].type === 'WhiteSpaceNode'
  ) {
    parent.children.splice(index + 1, 0, child.children.pop())
    previous = children[children.length - 1]

    if (previous && previous.position && child.position) {
      child.position.end = previous.position.end
    }

    // Next, iterate over the current node again.
    return index
  }
})
