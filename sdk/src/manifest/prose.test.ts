import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { parseProse, proseSpans, proseToMarkdown } from './prose'

it('reads a line as its runs: code, bold, emphasis and links, and plain text between them', () => {
  expect(proseSpans('Set `mode` to **collapse**, *then* read [the spec](https://songstress.app/docs/).')).toEqual([
    { kind: 'text', text: 'Set ' },
    { kind: 'code', text: 'mode' },
    { kind: 'text', text: ' to ' },
    { kind: 'strong', text: 'collapse' },
    { kind: 'text', text: ', ' },
    { kind: 'emphasis', text: 'then' },
    { kind: 'text', text: ' read ' },
    { kind: 'link', text: 'the spec', href: 'https://songstress.app/docs/' },
    { kind: 'text', text: '.' },
  ])
  expect(proseSpans('Plain.')).toEqual([{ kind: 'text', text: 'Plain.' }])
  expect(proseSpans('')).toEqual([])
})

it('keeps every character: the runs of a line, put back as written, are the line', () => {
  const written = (line: string) =>
    proseSpans(line)
      .map((span) => {
        if (span.kind === 'code') return `\`${span.text}\``
        if (span.kind === 'strong') return `**${span.text}**`
        if (span.kind === 'emphasis') return `*${span.text}*`
        return span.kind === 'link' ? `[${span.text}](${span.href})` : span.text
      })
      .join('')
  for (const line of ['a * b * c', '2 * 3 = 6 and `x*y`', '**bold** and *em* and `code`', 'a [b](https://c.example/d?e=f#g) h', 'stars ** alone', '[x](y) [z]', '`open']) {
    expect(written(line), line).toBe(line)
  }
})

it('shows as text what is no form of prose: HTML, an image, a link that is not https, code inside nothing', () => {
  const texts = (line: string) => proseSpans(line).map((span) => span.kind)
  expect(proseSpans('<script>alert(1)</script>')).toEqual([{ kind: 'text', text: '<script>alert(1)</script>' }])
  expect(proseSpans('<img src=x onerror=alert(1)> ![a cat](https://example.com/cat.png)')[0]).toMatchObject({ kind: 'text' })
  for (const href of ['javascript:alert(1)', 'http://example.com', 'data:text/html,x', '//example.com', `https://example.com/${'a'.repeat(300)}`]) {
    expect(texts(`[click](${href})`), href).toEqual(['text'])
  }
  // Code is taken first, so nothing inside it is read as anything else.
  expect(proseSpans('`**not bold** [nor](https://a.example) a link`')).toEqual([{ kind: 'code', text: '**not bold** [nor](https://a.example) a link' }])
})

it('reads blocks as a page draws them: headings, one list for items that follow one another, paragraphs', () => {
  expect(parseProse(['Finds lyrics.', '## Sources', '- Search', '- **Links**', 'After the list.', '- Alone', '### Deeper', '#### not a heading', '-not an item'])).toEqual([
    { kind: 'paragraph', spans: [{ kind: 'text', text: 'Finds lyrics.' }] },
    { kind: 'heading', level: 2, spans: [{ kind: 'text', text: 'Sources' }] },
    { kind: 'list', items: [[{ kind: 'text', text: 'Search' }], [{ kind: 'strong', text: 'Links' }]] },
    { kind: 'paragraph', spans: [{ kind: 'text', text: 'After the list.' }] },
    { kind: 'list', items: [[{ kind: 'text', text: 'Alone' }]] },
    { kind: 'heading', level: 3, spans: [{ kind: 'text', text: 'Deeper' }] },
    { kind: 'paragraph', spans: [{ kind: 'text', text: '#### not a heading' }] },
    { kind: 'paragraph', spans: [{ kind: 'text', text: '-not an item' }] },
  ])
  expect(parseProse([])).toEqual([])
})

it('writes the blocks as Markdown: a blank line between blocks, a list on lines that follow one another', () => {
  expect(proseToMarkdown(['Finds lyrics.', '- Synced', '- Plain', '## How', 'By asking.'])).toBe('Finds lyrics.\n\n- Synced\n- Plain\n\n## How\n\nBy asking.')
  expect(proseToMarkdown([])).toBe('')
})

/** The modules a file's statements import or re-export from, as TypeScript parses it (a doc comment's example is no import). */
function importsOf(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.ES2022)
  const modules = source.statements.flatMap((statement) =>
    (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [],
  )
  return [...new Set(modules)]
}

it('is an entry of its own, songstress/prose, that reaches nothing but this reader', () => {
  // An app's bundler that does not tree-shake (Metro) takes whatever the entry imports.
  expect(importsOf('../prose.ts')).toEqual(['./manifest/prose'])
  expect(importsOf('./prose.ts')).toEqual([])
})
