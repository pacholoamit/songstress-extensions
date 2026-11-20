// The two things every reader of JSON here needs. Kept apart from the rest so
// the generator (generate.ts) depends on nothing it writes.

/** A JSON Schema object, as parsed. */
export type SchemaNode = { readonly [keyword: string]: unknown }

/** A JSON object: not a list, not null. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
