// The package archive (SPEC.md, section 3): a ZIP whose root is the
// package's root, as a server reads it (apps/pocketbase/internal/extensions/
// archive.go: one reading only, nothing between the files, no comment).
//
// Every file is stored, not compressed. So the same package makes the same
// archive, byte for byte, on every machine: deflate's output differs between
// zlib builds, and the images in a package are compressed already. With one
// fixed time and the paths in order, a rebuild from the same source has the
// same SHA-256, which is what a release's digest pins.

import { crc32 } from 'node:zlib'

/** One file of a package: its path from the package root, and its bytes. */
export interface PackedFile {
  readonly path: string
  readonly data: Uint8Array
}

const LOCAL = 0x04034b50
const CENTRAL = 0x02014b50
const END = 0x06054b50
/** 2.0: what a stored file needs to be read. */
const VERSION = 20
/** Made on Unix, so the external attributes are read as a file's mode. */
const MADE_BY = (3 << 8) | VERSION
const UTF8 = 1 << 11
/** A regular file, rw-r--r--. */
const MODE = 0o100644
/** 1980-01-01, the first day a ZIP can name, at midnight: one time for every file. */
const DOS_DATE = (1 << 5) | 1
/** Past this a ZIP needs ZIP64, which no package does. */
const LIMIT = 0xffffffff
const MAX_ENTRIES = 0xffff

const isASCII = (text: string) => [...text].every((c) => c.charCodeAt(0) < 0x80)

/** The archive of files, in the order of their paths. */
export function zipArchive(files: readonly PackedFile[]): Uint8Array {
  if (files.length > MAX_ENTRIES) throw new RangeError(`A package of ${files.length} files is no package.`)
  const encoder = new TextEncoder()
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const body: Uint8Array[] = []
  const directory: Uint8Array[] = []
  let offset = 0
  for (const file of sorted) {
    const name = encoder.encode(file.path)
    const flags = isASCII(file.path) ? 0 : UTF8
    const crc = crc32(file.data)
    if (file.data.length >= LIMIT || offset >= LIMIT) throw new RangeError('A package this large is no package.')
    body.push(localHeader(name, flags, crc, file.data.length), name, file.data)
    directory.push(centralRecord(name, flags, crc, file.data.length, offset), name)
    offset += 30 + name.length + file.data.length
  }
  const size = directory.reduce((n, part) => n + part.length, 0)
  return concat([...body, ...directory, endRecord(sorted.length, size, offset)])
}

function localHeader(name: Uint8Array, flags: number, crc: number, size: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(30))
  view.setUint32(0, LOCAL, true)
  view.setUint16(4, VERSION, true)
  view.setUint16(6, flags, true)
  // 8 the method (0, stored) and 10 the time (midnight) stay 0.
  view.setUint16(12, DOS_DATE, true)
  view.setUint32(14, crc, true)
  view.setUint32(18, size, true)
  view.setUint32(22, size, true)
  view.setUint16(26, name.length, true)
  return new Uint8Array(view.buffer)
}

function centralRecord(name: Uint8Array, flags: number, crc: number, size: number, offset: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(46))
  view.setUint32(0, CENTRAL, true)
  view.setUint16(4, MADE_BY, true)
  view.setUint16(6, VERSION, true)
  view.setUint16(8, flags, true)
  view.setUint16(14, DOS_DATE, true)
  view.setUint32(16, crc, true)
  view.setUint32(20, size, true)
  view.setUint32(24, size, true)
  view.setUint16(28, name.length, true)
  view.setUint32(38, MODE * 0x10000, true)
  view.setUint32(42, offset, true)
  return new Uint8Array(view.buffer)
}

function endRecord(count: number, size: number, offset: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(22))
  view.setUint32(0, END, true)
  view.setUint16(8, count, true)
  view.setUint16(10, count, true)
  view.setUint32(12, size, true)
  view.setUint32(16, offset, true)
  return new Uint8Array(view.buffer)
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
