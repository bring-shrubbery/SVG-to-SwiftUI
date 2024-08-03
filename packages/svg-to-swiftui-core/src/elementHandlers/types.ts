import type { TranspilerOptions } from "../types";

export type SwiftGenerator<DataType> = (
  data: DataType,
  options: TranspilerOptions,
) => string[];
