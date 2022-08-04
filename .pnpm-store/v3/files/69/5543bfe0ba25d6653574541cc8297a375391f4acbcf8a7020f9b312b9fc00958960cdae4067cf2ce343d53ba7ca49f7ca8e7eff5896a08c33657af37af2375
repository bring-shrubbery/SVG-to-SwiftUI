import toString from 'nlcst-to-string'
import modifyChildren from 'unist-util-modify-children'

// Initial lowercase letter.
import {lowerInitial} from '../expressions.js'

// Merge a sentence into its previous sentence, when the sentence starts with a
// lower case letter.
export var mergeInitialLowerCaseLetterSentences = modifyChildren(function (
  child,
  index,
  parent
) {
  var children = child.children
  var position
  var node
  var siblings
  var previous

  if (children && children.length > 0 && index > 0) {
    position = -1

    while (children[++position]) {
      node = children[position]

      if (node.type === 'WordNode') {
        if (!lowerInitial.test(toString(node))) {
          return
        }

        siblings = parent.children

        previous = siblings[index - 1]

        previous.children = previous.children.concat(children)

        siblings.splice(index, 1)

        // Update position.
        if (previous.position && child.position) {
          previous.position.end = child.position.end
        }

        // Next, iterate over the node *now* at the current position.
        return index
      }

      if (node.type === 'SymbolNode' || node.type === 'PunctuationNode') {
        return
      }
    }
  }
})
