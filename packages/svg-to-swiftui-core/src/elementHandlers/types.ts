import {TranspilerOptions} from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SwiftGenerator<DataType> = (
  data: DataType,
  options: TranspilerOptions
) => string[];
