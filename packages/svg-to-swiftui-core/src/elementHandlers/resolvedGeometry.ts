import { parsePlainNumber } from "../lengths";

/** Code generation only receives lengths already resolved by the semantic render-tree stage. */
export function resolvedGeometryNumber(value: unknown, fallback?: number): number {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (fallback !== undefined) return fallback;
    throw new Error("Expected a resolved geometry number.");
  }
  return parsePlainNumber(value, "resolved geometry value");
}
