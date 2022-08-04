/**
 * Base type that handlers extend from
 */
export type Handler = (...props: unknown[]) => unknown
/**
 * Handle values based on a property.
 *
 * @param key key
 * @param options options
 * @returns handler
 */
export declare function zwitch<
  KnownHandler extends Handler = (...parameters: unknown[]) => void,
  UnknownHandler extends Handler = (...parameters: unknown[]) => void,
  InvalidHandler extends Handler = (...parameters: unknown[]) => void
>(
  key: string,
  options?: {
    unknown?: UnknownHandler
    invalid?: InvalidHandler
    handlers?: Record<string, KnownHandler>
  }
): {
  unknown: UnknownHandler
  invalid: InvalidHandler
  handlers: Record<string, KnownHandler>
  (...parameters: Parameters<UnknownHandler>): ReturnType<UnknownHandler>
  (...parameters: Parameters<InvalidHandler>): ReturnType<InvalidHandler>
  (...parameters: Parameters<KnownHandler>): ReturnType<KnownHandler>
}
