import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'

// The Agent Skill the package carries (skill/): a Claude Code plugin whose
// version is this package's, holding one skill within the limits an agent
// loads a skill by. Its words on the format point at SPEC.md and the docs,
// which are versioned with the SDK; this test holds what can drift.

const ROOT = fileURLToPath(new URL('../skill/', import.meta.url))
const SKILL = join(ROOT, 'skills/songstress-extensions')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const json = (path: string) => JSON.parse(read(path)) as Record<string, unknown>

/** The skill's Markdown files, by their paths. */
const markdown = readdirSync(SKILL, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.md'))
  .map((path) => join(SKILL, path))

describe('the skill the package carries', () => {
  it('is versioned with the package, as a plugin and in its marketplace of one', () => {
    const plugin = json('.claude-plugin/plugin.json')
    expect(plugin).toMatchObject({ name: 'songstress', version: packageJson.version, license: packageJson.license })
    expect(json('.claude-plugin/marketplace.json').plugins).toEqual([
      expect.objectContaining({ name: plugin.name, source: './', version: packageJson.version }),
    ])
  })

  it('is named after its folder and described within what an agent loads', () => {
    const text = readFileSync(join(SKILL, 'SKILL.md'), 'utf8')
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? ''
    const field = (key: string) => new RegExp(`^${key}: (.*)$`, 'm').exec(front)?.[1] ?? ''
    expect(front.split('\n').map((line) => line.split(':')[0])).toEqual(['name', 'description'])
    expect(field('name')).toBe('songstress-extensions')
    expect(field('name')).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    expect(field('description').length).toBeGreaterThan(100)
    expect(field('description').length).toBeLessThanOrEqual(1024)
    expect(field('description')).not.toMatch(/[<>]/)
    // The body is read whole each time the skill is used: the detail lives in references/.
    expect(text.split('\n').length).toBeLessThanOrEqual(500)
  })

  it('links only to files it has', () => {
    const broken = markdown.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
        .map((match) => match[1] ?? '')
        .filter((link) => !/^[a-z]+:/.test(link))
        .filter((link) => !existsSync(join(dirname(file), link)))
        .map((link) => `${file}: ${link}`),
    )
    expect(broken).toEqual([])
  })
})
