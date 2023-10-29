import {ElementNode, parse} from 'svg-parser';
import {SwiftUIGeneratorConfig, TranspilerOptions} from './types';

import {handleElement} from './elementHandlers';
import {extractSVGProperties, getSVGElement} from './utils';
import {DEFAULT_CONFIG} from './constants';
import {
  createFunctionTemplate,
  createStructTemplate,
  createUsageCommentTemplate,
} from './templates';

export * from './types';

/**
 * This function converts SVG string into SwiftUI
 * Shape structure which is returned as a string.
 * @param rawSVGString SVG code as a raw string.
 * @param config Optional configuration object.
 */
export function convert(
  rawSVGString: string,
  config?: SwiftUIGeneratorConfig
): string {
  const AST = parse(rawSVGString);
  const svgElement = getSVGElement(AST);
  if (svgElement) {
    return swiftUIGenerator(svgElement, config);
  } else {
    throw new Error(
      'Could not find SVG element, please provide full SVG source!'
    );
  }
}

/**
 * Generates SwiftUI Shape string from SVG HAST (Abstract Syntax Tree).
 * @param svgElement Parsed SVG Abstract Syntax Tree.
 * @param config Optional configuration object.
 */
function swiftUIGenerator(
  svgElement: ElementNode,
  config?: SwiftUIGeneratorConfig
): string {
  const svgProperties = extractSVGProperties(svgElement);

  // The initial options passed to the first element.
  const rootTranspilerOptions: TranspilerOptions = {
    ...svgProperties,
    precision: config?.precision || 10,
    lastPathId: 0,
    indentationSize: config?.indentationSize || 4,
    currentIndentationLevel: 0,
    parentStyle: {},
  };

  const configWithDefaults = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Generate SwiftUI Shape body.
  const generatedBody = handleElement(svgElement, rootTranspilerOptions);

  const fullSwiftUIShape = createStructTemplate({
    name: configWithDefaults.structName!,
    indent: configWithDefaults.indentationSize,
    returnType: 'Shape',
    body: createFunctionTemplate({
      name: 'path',
      parameters: [['in rect', 'CGRect']],
      returnType: 'Path',
      indent: configWithDefaults.indentationSize,
      body: [
        'var path = Path()',
        'let width = rect.size.width',
        'let height = rect.size.height',
        ...generatedBody,
        'return path',
      ],
    }),
  });

  if (config?.usageCommentPrefix) {
    const usageComment = createUsageCommentTemplate({
      config,
      viewBox: svgProperties.viewBox,
    });

    return [...usageComment, '', ...fullSwiftUIShape].join('\n');
  }

  return fullSwiftUIShape.join('\n');
}
