// The package as npm gets it: dist/. Inside the repository the package's
// exports name its TypeScript sources; what is published is what this writes,
// which package.json's publishConfig points at instead:
//
//   dist/index.js, server.js, client.js, prose.js, manifest.js, testing.js, theme.js
//                    the entries as ES modules, bundled by rolldown, with
//                    what they share in dist/chunks/ and the schema inside
//   dist/cli.js      the songstress command, for Node, with its two
//                    dependencies (pocketbase, rolldown) left to be installed
//                    and check's validator built in (validator.built.ts)
//   dist/types/      the declarations, as TypeScript emits them, with the
//                    file names relative imports need outside a bundler
//
//   node scripts/build.ts      (pnpm --dir packages/extensions build)

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const TYPES = join(DIST, 'types')

/** The entries, as package.json exports them. */
const ENTRIES = {
  index: 'src/index.ts',
  server: 'src/server.ts',
  client: 'src/client.ts',
  prose: 'src/prose.ts',
  manifest: 'src/manifest.ts',
  testing: 'src/testing.ts',
  theme: 'src/theme.ts',
}

/** The entries: no DOM, no Node, nothing left to install. */
async function library(): Promise<void> {
  const bundle = await rolldown({ input: ENTRIES, cwd: ROOT, platform: 'neutral', logLevel: 'warn' })
  try {
    await bundle.write({ dir: DIST, format: 'esm', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' })
  } finally {
    await bundle.close()
  }
}

const CLI = join(ROOT, 'src/cli')
const BUILT_VALIDATOR = '\0songstress:built-validator'

/** `songstress check`'s validator, built in. In the repository src/cli/validator.ts bundles the manifest's
 * sources when check first runs (they import each other without the .ts names Node needs); the package does not
 * carry those sources, so in the published command the module check imports is src/cli/validator.built.ts's
 * loadBuiltValidator under check's name: the same validator, inside the bundle (validator.test.ts holds the two
 * to the same answers). */
const builtValidator = {
  name: 'songstress:built-validator',
  resolveId(source: string, importer: string | undefined) {
    return source === './validator.ts' && importer !== undefined && dirname(importer) === CLI ? BUILT_VALIDATOR : null
  },
  load(id: string) {
    return id === BUILT_VALIDATOR ? `export { loadBuiltValidator as loadValidator } from ${JSON.stringify(join(CLI, 'validator.built.ts'))}` : null
  },
}

/** The run-time loader's own mark (an ES module imported from its text) in dist/cli.js: the swap above did not
 * happen, and check would fail for every author. A path alone would not tell: rolldown names each module it
 * bundles in a comment. */
async function carriesItsValidator(): Promise<void> {
  const cli = await readFile(join(DIST, 'cli.js'), 'utf8')
  if (cli.includes('data:text/javascript;base64')) throw new Error('dist/cli.js would bundle the validator from sources the package does not carry.')
}

/** The command: one file Node runs, its dependencies resolved where it is installed. */
async function command(): Promise<void> {
  const bundle = await rolldown({
    input: { cli: 'src/cli/main.ts' },
    cwd: ROOT,
    platform: 'node',
    external: [/^node:/, 'pocketbase', 'rolldown'],
    plugins: [builtValidator],
    logLevel: 'warn',
  })
  try {
    await bundle.write({ dir: DIST, format: 'esm', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' })
  } finally {
    await bundle.close()
  }
  await carriesItsValidator()
  await chmod(join(DIST, 'cli.js'), 0o755)
}

/** Every file under a folder. */
async function filesUnder(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true, recursive: true })
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name))
}

// from './x', import('./x'), import './x': a relative import in a declaration.
const RELATIVE = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\2/g

/** A relative import as Node's own resolution wants it: with the file's name. */
function named(file: string, specifier: string): string {
  const target = resolve(dirname(file), specifier)
  if (existsSync(`${target}.d.ts`)) return `${specifier}.js`
  if (existsSync(join(target, 'index.d.ts'))) return `${specifier}/index.js`
  throw new Error(`${file} imports ${specifier}, which the build did not declare.`)
}

/** The declarations. TypeScript writes them from the package's root (the
 * schema lies outside src/), so they land under a src/ folder, which is
 * moved up; and it keeps each relative import as the source wrote it, with
 * no extension, which only a bundler resolves. */
async function declarations(): Promise<void> {
  const emitted = join(DIST, '.declarations')
  // The package's own TypeScript (6: its declaration emit is what the surface test records).
  const tsc = spawnSync('node', [join(ROOT, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--outDir', emitted], { cwd: ROOT, stdio: 'inherit' })
  if (tsc.status !== 0) throw new Error('The declarations did not compile.')
  await rename(join(emitted, 'src'), TYPES)
  await rm(emitted, { recursive: true })
  for (const file of await filesUnder(TYPES)) {
    const text = await readFile(file, 'utf8')
    const fixed = text.replace(RELATIVE, (_all, lead: string, quote: string, specifier: string) => `${lead}${quote}${named(file, specifier)}${quote}`)
    if (fixed !== text) await writeFile(file, fixed)
  }
}

/** npm packs what package.json says, and leaves publishConfig's exports and bin unapplied: a package that
 * points at sources it does not carry. So a pack or a publish by anything but pnpm stops here, at prepack. */
function onlyPnpmPacks(env: NodeJS.ProcessEnv): void {
  if (env.npm_lifecycle_event !== 'prepack' || (env.npm_config_user_agent ?? '').startsWith('pnpm/')) return
  console.error('Pack and publish songstress with pnpm (pnpm pack, pnpm publish): npm does not apply\npublishConfig, and would publish a package that points at files it does not carry.')
  process.exit(1)
}

/** Every file publishConfig points an export or the command at, built: an entry the declarations leave out
 * (tsconfig.build.json's include) would be published with no types. */
async function everyExportBuilt(): Promise<void> {
  const { publishConfig } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
    publishConfig: { exports: Record<string, string | Record<string, string>>; bin: Record<string, string> }
  }
  const targets = [...Object.values(publishConfig.exports).flatMap((target) => (typeof target === 'string' ? [target] : Object.values(target))), ...Object.values(publishConfig.bin)]
  const missing = targets.filter((target) => !existsSync(join(ROOT, target)))
  if (missing.length > 0) throw new Error(`publishConfig points at files the build did not write: ${missing.join(', ')}`)
}

onlyPnpmPacks(process.env)
await rm(DIST, { recursive: true, force: true })
await library()
await command()
await declarations()
await everyExportBuilt()
console.log(`built ${(await filesUnder(DIST)).length} files in dist/`)
