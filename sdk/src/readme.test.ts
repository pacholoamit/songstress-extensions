import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'
import { parseManifest } from './manifest/validate'

// README.md is what an author reads first, on npm: what it shows must be
// true of the package.

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

describe('README.md', () => {
  it('shows a manifest a server installs', () => {
    const manifests = [...README.matchAll(/```json\n([\s\S]*?)```/g)].map((block) => block[1]!).filter((text) => text.includes('"manifestVersion"'))
    expect(manifests).toHaveLength(1)
    expect(parseManifest(manifests[0]!, { profile: 'install' }).issues).toEqual([])
  })

  it('names only entries the package exports, and every one an author imports', () => {
    const named = new Set([...README.matchAll(/`songstress\/([a-z]+)`/g)].map((match) => `./${match[1]}`))
    const exported = Object.keys(packageJson.exports).filter((entry) => /^\.\/[a-z]+$/.test(entry))
    expect([...named].sort()).toEqual(exported.sort())
    expect(Object.keys(packageJson.publishConfig.exports)).toEqual(Object.keys(packageJson.exports))
  })

  it('declares the types of every entry it exports, and builds every one', () => {
    const build = JSON.parse(readFileSync(new URL('../tsconfig.build.json', import.meta.url), 'utf8')) as { include: string[] }
    const sources = Object.values(packageJson.exports)
      .filter((target): target is string => typeof target === 'string' && target.endsWith('.ts'))
      .map((target) => target.replace(/^\.\//, ''))
    expect([...build.include].sort()).toEqual([...sources].sort())
    const script = readFileSync(new URL('../scripts/build.ts', import.meta.url), 'utf8')
    for (const source of sources) expect(script).toContain(`'${source}'`)
  })

  it('is published with the files it sends its reader to', () => {
    const linked = [...README.matchAll(/\]\(\.\/([^)/]+)/g)].map((match) => match[1]!)
    const always = ['README.md', 'LICENSE']
    expect(linked.filter((file) => !always.includes(file) && !packageJson.files.includes(file))).toEqual([])
  })
})
