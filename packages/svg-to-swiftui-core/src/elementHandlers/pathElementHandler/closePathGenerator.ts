/* eslint-disable @typescript-eslint/no-unused-vars */
import {SwiftGenerator} from '../types';

export const generateClosePathSwift: SwiftGenerator<unknown> = (
  _data,
  _options
) => {
  return ['path.closeSubpath()'];
};
