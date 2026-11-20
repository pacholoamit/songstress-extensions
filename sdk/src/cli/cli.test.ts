import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32 } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { unzip } from '../test/unzip'
import { build } from './build.ts'
import { main } from './main.ts'
import { packageFiles, PackError } from './pack.ts'
import { zipArchive } from './zip.ts'

const MANIFEST = {
  manifestVersion: 1,
  id: 'acme.recorder',
  name: 'Recorder',
  version: '1.0.0',
  description: 'Keeps what it hears.',
  engines: { songstress: '^0.1.0' },
  icon: { path: 'assets/icon.png', width: 512, height: 512 },
  entry: { server: 'dist/server.js' },
  hooks: { server: ['onPlay'] },
  permissions: { 'listening.read': { reason: 'To hear what you play.' } },
}

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

/** An extension's folder with these files (a value of null: left out). */
function folderOf(files: Record<string, string | null>): string {
  const folder = mkdtempSync(join(tmpdir(), 'songstress-cli-'))
  folders.push(folder)
  const all: Record<string, string | null> = { 'songstress.json': JSON.stringify(MANIFEST), 'dist/server.js': 'void 0;', 'assets/icon.png': 'png', ...files }
  for (const [path, text] of Object.entries(all)) {
    if (text === null) continue
    mkdirSync(dirname(join(folder, path)), { recursive: true })
    writeFileSync(join(folder, path), text)
  }
  return folder
}

const bytes = (text: string) => new TextEncoder().encode(text)

describe('the archive', () => {
  it('stores each file, in the order of its path, the same bytes every time', () => {
    const files = [
      { path: 'songstress.json', data: bytes('{}') },
      { path: 'dist/server.js', data: bytes('void 0;') },
      { path: 'README.md', data: bytes('# hi') },
    ]
    const archive = zipArchive(files)
    expect(zipArchive([...files].reverse())).toEqual(archive)
    expect([...archive.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const entries = unzip(archive)
    expect(entries.map((e) => e.path)).toEqual(['README.md', 'dist/server.js', 'songstress.json'])
    for (const entry of entries) {
      expect(entry.method).toBe(0)
      expect(entry.crc).toBe(crc32(entry.data))
      expect(entry.madeBy >> 8).toBe(3)
      expect(entry.mode).toBe(0o100644)
      expect(entry.flags).toBe(0)
    }
    expect(new TextDecoder().decode(entries[1]!.data)).toBe('void 0;')
  })

  it('marks a name that is not ASCII as UTF-8', () => {
    const [entry] = unzip(zipArchive([{ path: 'café.md', data: bytes('x') }]))
    expect(entry!.path).toBe('café.md')
    expect(entry!.flags).toBe(1 << 11)
  })
})

describe('what a package holds', () => {
  it('is the manifest, every file it names and the documents at its root, nothing else', async () => {
    const folder = folderOf({
      'README.md': '# Recorder',
      LICENSE: 'MIT',
      'src/server.ts': 'export {}',
      'node_modules/left-pad/index.js': 'x',
      'package.json': '{}',
    })
    const files = await packageFiles(folder)
    expect(files.map((f) => f.path).sort()).toEqual(['LICENSE', 'README.md', 'assets/icon.png', 'dist/server.js', 'songstress.json'])
  })

  it('refuses a file the manifest names that is not there, outside the package, or a link', async () => {
    await expect(packageFiles(folderOf({ 'dist/server.js': null }))).rejects.toThrow(/Build it first/)
    const outside = folderOf({ 'songstress.json': JSON.stringify({ ...MANIFEST, entry: { server: '../server.js' } }) })
    await expect(packageFiles(outside)).rejects.toThrow(/not inside the package/)
    const linked = folderOf({ 'dist/server.js': null })
    mkdirSync(join(linked, 'dist'))
    symlinkSync('/etc/hosts', join(linked, 'dist/server.js'))
    await expect(packageFiles(linked)).rejects.toThrow(PackError)
  })
})

describe('the build', () => {
  it('bundles an entry from its source as one classic script, nothing left to import', async () => {
    const folder = folderOf({
      'src/server.ts': "import { said } from './said.ts'\nconsole.log(said)\n",
      'src/said.ts': "export const said: string = 'built from source'\n",
    })
    expect(await build(folder)).toEqual(['dist/server.js'])
    const code = readFileSync(join(folder, 'dist/server.js'), 'utf8')
    expect(code).toContain('built from source')
    expect(code).not.toMatch(/^\s*(import|export)\b/m)
  })

  it('leaves an entry with no source as the extension built it', async () => {
    const folder = folderOf({})
    expect(await build(folder)).toEqual([])
    expect(readFileSync(join(folder, 'dist/server.js'), 'utf8')).toBe('void 0;')
  })
})

/** A stand-in Songstress server: PocketBase's sign-in, the development push, the log. */
function standIn(answer: (pushed: number) => { status: number; body: unknown }) {
  const pushes: { type: string; auth: string; archive: Buffer }[] = []
  let logged = false
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const reply = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      if (req.url === '/api/collections/users/auth-with-password') return reply(200, { token: 'session', record: { id: 'admin' } })
      if (req.url === '/api/songstress/extensions/v1/dev') {
        pushes.push({ type: String(req.headers['content-type']), auth: String(req.headers.authorization), archive: Buffer.concat(chunks) })
        const { status, body } = answer(pushes.length)
        return reply(status, body)
      }
      if (req.url?.startsWith('/api/songstress/extensions/v1/installs/acme.recorder/logs')) {
        const first = !logged
        logged = true
        return setTimeout(() => reply(200, { lines: first ? [{ seq: 1, level: 'info', text: 'hello from the host' }] : [] }), first ? 0 : 50)
      }
      reply(404, { message: 'Not Found' })
    })
  })
  return new Promise<{ url: string; pushes: typeof pushes; close: () => void }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${port}`, pushes, close: () => server.close() })
    })
  })
}

const until = async (what: string, ok: () => boolean) => {
  for (let i = 0; i < 400; i++) {
    if (ok()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`never: ${what}`)
}

describe('songstress dev', () => {
  it('pushes the package as a development install, again when a file changes, and prints the log', { timeout: 30_000 }, async () => {
    const remote = await standIn(() => ({ status: 200, body: { id: 'acme.recorder', version: '1.0.0', status: '' } }))
    const folder = folderOf({})
    const lines: string[] = []
    const stop = new AbortController()
    const done = main(['dev', folder, '--server', remote.url, '--email', 'admin@example.com'], { SONGSTRESS_PASSWORD: 'pw' }, (line) => lines.push(line), stop.signal)
    try {
      await until('the first push', () => remote.pushes.length === 1)
      expect(remote.pushes[0]).toMatchObject({ type: 'application/zip', auth: 'session' })
      expect(unzip(new Uint8Array(remote.pushes[0]!.archive)).map((e) => e.path)).toEqual(['assets/icon.png', 'dist/server.js', 'songstress.json'])
      await until('the log printed', () => lines.some((line) => line.includes('hello from the host')))
      writeFileSync(join(folder, 'dist/server.js'), 'void 1;')
      await until('the push after a change', () => remote.pushes.length === 2)
      // The stand-in counts a push when it arrives; the command says so once it has read the answer, which on a
      // busy machine is after the count: stopping before then would cut that line off.
      await until('the push after a change said', () => lines.filter((line) => line.startsWith('pushed acme.recorder 1.0.0')).length === 2)
    } finally {
      stop.abort()
      remote.close()
    }
    expect(await done).toBe(0)
    expect(lines.filter((line) => line.startsWith('pushed acme.recorder 1.0.0'))).toHaveLength(2)
  })

  it('says what the server refused, with the manifest’s issues, and keeps going', { timeout: 30_000 }, async () => {
    const issue = { code: 'ID_RESERVED', pointer: '/id', message: 'The publisher is Songstress’s own.' }
    const remote = await standIn(() => ({ status: 422, body: { error: 'manifest-invalid', message: 'songstress.json does not pass', issues: [issue] } }))
    const lines: string[] = []
    const stop = new AbortController()
    const done = main(['dev', folderOf({}), '--server', remote.url], { SONGSTRESS_TOKEN: 'session' }, (line) => lines.push(line), stop.signal)
    try {
      await until('the refusal said', () => lines.some((line) => line.startsWith('refused (manifest-invalid):')))
    } finally {
      stop.abort()
      remote.close()
    }
    expect(await done).toBe(0)
    expect(lines.join('\n')).toContain('ID_RESERVED at /id: The publisher is Songstress’s own.')
  })
})

describe('the command', () => {
  it('packs to the file named, and answers 2 to what it does not know', async () => {
    const folder = folderOf({})
    const out = join(folder, 'out.songstress')
    const lines: string[] = []
    const never = new AbortController().signal
    expect(await main(['pack', folder, '--out', out], {}, (line) => lines.push(line), never)).toBe(0)
    expect(unzip(new Uint8Array(readFileSync(out))).map((e) => e.path)).toContain('songstress.json')
    expect(await main(['frobnicate'], {}, (line) => lines.push(line), never)).toBe(2)
    expect(await main(['dev', folder], {}, (line) => lines.push(line), never)).toBe(1)
    expect(lines.at(-1)).toMatch(/--server/)
  })

  it('answers an option it does not know with the sentence, its help, and 2', async () => {
    const lines: string[] = []
    expect(await main(['pack', '--bogus'], {}, (line) => lines.push(line), new AbortController().signal)).toBe(2)
    expect(lines.join('\n')).toMatch(/Unknown option '--bogus'[\s\S]*songstress <command> \[folder\]/)
  })

  it('runs through a link to it, as a package\'s bin is reached', () => {
    const folder = mkdtempSync(join(tmpdir(), 'songstress-bin-'))
    folders.push(folder)
    const link = join(folder, 'songstress')
    symlinkSync(fileURLToPath(new URL('./main.ts', import.meta.url)), link)
    const run = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8' })
    expect(run.status).toBe(0)
    expect(run.stdout).toContain('songstress <command> [folder]')
  })
})
