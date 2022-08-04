import {tokenizerFactory} from './tokenizer.js'

// Construct a parser based on `options`.
export function parserFactory(options) {
  var type = options.type
  var tokenizerProperty = options.tokenizer
  var delimiter = options.delimiter
  var tokenize = delimiter && tokenizerFactory(options.delimiterType, delimiter)

  return parser

  function parser(value) {
    var children = this[tokenizerProperty](value)

    return {type, children: tokenize ? tokenize(children) : children}
  }
}
