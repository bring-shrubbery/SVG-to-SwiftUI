import toString from 'nlcst-to-string'
import modifyChildren from 'unist-util-modify-children'

// Two or more new line characters.
import {newLineMulti} from '../expressions.js'

// Break a sentence if a white space with more than one new-line is found.
export var breakImplicitSentences = modifyChildren(function (
  child,
  index,
  parent
) {
  var children
  var position
  var tail
  var head
  var end
  var insertion
  var node

  if (child.type !== 'SentenceNode') {
    return
  }

  children = child.children

  // Ignore first and last child.
  position = 0

  while (++position < children.length - 1) {
    node = children[position]

    if (node.type !== 'WhiteSpaceNode' || !newLineMulti.test(toString(node))) {
      continue
    }

    child.children = children.slice(0, position)

    insertion = {
      type: 'SentenceNode',
      children: children.slice(position + 1)
    }

    tail = children[position - 1]
    head = children[position + 1]

    parent.children.splice(index + 1, 0, node, insertion)

    if (child.position && tail.position && head.position) {
      end = child.position.end

      child.position.end = tail.position.end

      insertion.position = {start: head.position.start, end}
    }

    return index + 1
  }
})
