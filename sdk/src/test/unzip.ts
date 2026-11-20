// A reader of the stored ZIP archives the command writes, for its tests: the
// end record, then each directory record and the local header it points at.
// The server reads every archive strictly (apps/pocketbase/internal/
// extensions/archive.go) and its tests read one this package packs
// (testdata/tunelog.songstress); this is only enough to look inside.

export interface Entry {
  readonly path: string
  readonly data: Uint8Array
  readonly crc: number
  readonly method: number
  readonly flags: number
  readonly madeBy: number
  readonly mode: number
}

export function unzip(archive: Uint8Array): Entry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  const end = archive.length - 22
  if (view.getUint32(end, true) !== 0x06054b50) throw new Error('no end record where it must be')
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  const entries: Entry[] = []
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error(`no directory record at ${at}`)
    const nameLength = view.getUint16(at + 28, true)
    const extra = view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
    const size = view.getUint32(at + 20, true)
    const local = view.getUint32(at + 42, true)
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    entries.push({
      path: decoder.decode(archive.subarray(at + 46, at + 46 + nameLength)),
      data: archive.subarray(start, start + size),
      crc: view.getUint32(at + 16, true),
      method: view.getUint16(at + 10, true),
      flags: view.getUint16(at + 8, true),
      madeBy: view.getUint16(at + 4, true),
      mode: Math.floor(view.getUint32(at + 38, true) / 0x10000),
    })
    at += 46 + nameLength + extra
  }
  return entries
}
