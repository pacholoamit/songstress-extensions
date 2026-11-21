// Protocol Buffers, as far as a track's metadata needs: Spotify's metadata
// endpoint answers its own protobuf, and the parts read here (an external
// id, a label, a genre) are length-delimited fields. The other wire types
// are stepped over. From the Mornye "spotify-web" extension 1.10.4
// (Copyright 2026 zarzet, LGPL-3.0-only; see NOTICE).

import { utf8Text } from '../../shared/url'

/** Each field number's length-delimited values, in order. */
export type Fields = Map<number, number[][]>

/** A reader of a message's bytes, one varint at a time. */
class Reader {
  at = 0
  constructor(readonly bytes: readonly number[]) {}

  varint(): number | null {
    let value = 0
    for (let shift = 1, i = 0; i < 10 && this.at < this.bytes.length; i++, shift *= 128) {
      const b = this.bytes[this.at++]!
      value += (b & 0x7f) * shift
      if ((b & 0x80) === 0) return value
    }
    return null
  }

  /** How many bytes a field of this wire type takes after its tag, or -1. */
  size(wire: number): number {
    switch (wire) {
      case 0:
        return this.varint() === null ? -1 : 0
      case 1:
        return 8
      case 2:
        return this.varint() ?? -1
      case 5:
        return 4
    }
    return -1
  }
}

/** The fields of one message; reading stops at the first malformed one. */
export function proto(bytes: readonly number[]): Fields {
  const fields: Fields = new Map()
  const r = new Reader(bytes)
  while (r.at < bytes.length) {
    const tag = r.varint()
    if (tag === null || tag <= 0) break
    const wire = tag % 8
    const size = r.size(wire)
    if (size < 0 || r.at + size > bytes.length) break
    if (wire === 2) {
      const number = Math.floor(tag / 8)
      fields.set(number, [...(fields.get(number) ?? []), bytes.slice(r.at, r.at + size)])
    }
    r.at += size
  }
  return fields
}

export function protoAll(fields: Fields, number: number): number[][] {
  return fields.get(number) ?? []
}

/** The first value of a field, as UTF-8 text. */
export function protoText(fields: Fields, number: number): string {
  const value = protoAll(fields, number)[0]
  return value ? utf8Text(value) : ''
}
