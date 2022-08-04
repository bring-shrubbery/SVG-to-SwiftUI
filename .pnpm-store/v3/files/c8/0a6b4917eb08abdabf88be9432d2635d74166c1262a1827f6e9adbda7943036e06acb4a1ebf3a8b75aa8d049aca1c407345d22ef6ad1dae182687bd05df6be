import toString from 'nlcst-to-string'

// Factory to create a tokenizer based on a given `expression`.
export function tokenizerFactory(childType, expression) {
  return tokenizer

  // A function that splits.
  function tokenizer(node) {
    var children = []
    var tokens = node.children
    var type = node.type
    var index = -1
    var lastIndex = tokens.length - 1
    var start = 0
    var first
    var last
    var parent

    while (++index < tokens.length) {
      if (
        index === lastIndex ||
        (tokens[index].type === childType &&
          expression.test(toString(tokens[index])))
      ) {
        first = tokens[start]
        last = tokens[index]

        parent = {type, children: tokens.slice(start, index + 1)}

        if (first.position && last.position) {
          parent.position = {
            start: first.position.start,
            end: last.position.end
          }
        }

        children.push(parent)

        start = index + 1
      }
    }

    return children
  }
}
