import toString from 'nlcst-to-string'
import modifyChildren from 'unist-util-modify-children'

var slash = '/'

// Merge words joined by certain punctuation marks.
export var mergeInnerWordSlash = modifyChildren(function (
  child,
  index,
  parent
) {
  var siblings = parent.children
  var previous
  var next
  var previousValue
  var nextValue
  var queue
  var tail
  var count

  previous = siblings[index - 1]
  next = siblings[index + 1]

  if (
    previous &&
    previous.type === 'WordNode' &&
    (child.type === 'SymbolNode' || child.type === 'PunctuationNode') &&
    toString(child) === slash
  ) {
    previousValue = toString(previous)
    tail = child
    queue = [child]
    count = 1

    if (next && next.type === 'WordNode') {
      nextValue = toString(next)
      tail = next
      queue = queue.concat(next.children)
      count++
    }

    if (previousValue.length < 3 && (!nextValue || nextValue.length < 3)) {
      // Add all found tokens to `prev`s children.
      previous.children = previous.children.concat(queue)

      siblings.splice(index, count)

      // Update position.
      if (previous.position && tail.position) {
        previous.position.end = tail.position.end
      }

      // Next, iterate over the node *now* at the current position.
      return index
    }
  }
})
