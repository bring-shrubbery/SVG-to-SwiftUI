import {SwiftUIGeneratorConfig} from './types';

export const generateSwiftUIShape = (
  body: string[],
  config: SwiftUIGeneratorConfig
) => {
  const indStr = new Array(config.indentationSize).fill(' ').join('');

  const getInd = (indLevel: number) =>
    new Array(indLevel).fill(indStr).join('');

  const indentedBody = `${getInd(2)}${body.join(`\n${getInd(2)}`)}`;

  return [
    `struct ${config.structName!}: Shape {`,
    `${getInd(1)}func path(in rect: CGRect) -> Path {`,
    `${getInd(2)}var path = Path()`,
    `${getInd(2)}let width = rect.size.width`,
    `${getInd(2)}let height = rect.size.height`,
    indentedBody,
    `${getInd(2)}return path`,
    `${getInd(1)}}`,
    '}',
  ].join('\n');
};
