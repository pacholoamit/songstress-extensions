// TEXT_UNSAFE: no text of a manifest may hold a character that cannot be
// seen or that changes the direction text reads in (the table is in
// ../unsafe.ts). Every text value is looked at, each at its own pointer; the
// keys are the schema's own once the schema has passed.

import { isRecord } from '../json'
import { child } from '../pointer'
import { firstUnsafe } from '../unsafe'
import type { Rule } from './rule'

/** Every text under `value`, with its pointer. */
function* texts(value: unknown, at: string): Generator<[pointer: string, text: string]> {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [index, item] of value.entries()) yield* texts(item, child(at, index))
  else if (isRecord(value)) for (const [key, item] of Object.entries(value)) yield* texts(item, child(at, key))
}

export const unsafeText: Rule = (manifest, report) => {
  for (const [pointer, text] of texts(manifest, '')) {
    const found = firstUnsafe(text)
    if (found) report('TEXT_UNSAFE', pointer, `This text holds ${found}, a character that is hidden or changes how text reads.`)
  }
}
