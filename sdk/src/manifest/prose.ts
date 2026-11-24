// A page's longer text, as a manifest writes it (`about`, `useCases`,
// `howItWorks`): a list of blocks, each one line, read as a small part of
// Markdown and nothing more (SPEC.md, section 3, "Prose"). The apps and
// songstress.app draw a page from what this reads, so they draw the same
// page, and none of them hands an author's text to anything that would run
// it: what is not one of the forms below is text.

/** A run of a block's text: plain, bold, emphasis, code, or a link to an https address. */
export type ProseSpan =
  | { kind: 'text' | 'strong' | 'emphasis' | 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

/** A block of a page's text: a paragraph, a heading of the second or third level, or a list (the items that followed one another). */
export type ProseBlock =
  | { kind: 'paragraph'; spans: ProseSpan[] }
  | { kind: 'heading'; level: 2 | 3; spans: ProseSpan[] }
  | { kind: 'list'; items: ProseSpan[][] }

/** An https address as the manifest's schema takes one, 300 characters at most. */
const HTTPS = /^https:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%[\]-]+$/

// One alternative a form, tried at each character from the left: a span in
// backticks, bold, emphasis, a link. None nests in another.
const FORMS = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^()\s]+)\)/g

function spanOf(match: RegExpExecArray): ProseSpan {
  const [whole, code, strong, emphasis, label, href] = match
  if (code !== undefined) return { kind: 'code', text: code }
  if (strong !== undefined) return { kind: 'strong', text: strong }
  if (emphasis !== undefined) return { kind: 'emphasis', text: emphasis }
  // A link that goes anywhere but an https address is the text it was written as.
  const linked = href !== undefined && href.length <= 300 && HTTPS.test(href)
  return linked ? { kind: 'link', text: label ?? '', href } : { kind: 'text', text: whole }
}

/** A line of prose as its runs, in order: every character of the line is in exactly one of them.
 * @example
 * ```ts
 * import { proseSpans } from 'songstress/prose'
 *
 * proseSpans('Set `mode` to **collapse**.')
 * // [{ kind: 'text', text: 'Set ' }, { kind: 'code', text: 'mode' }, { kind: 'text', text: ' to ' },
 * //  { kind: 'strong', text: 'collapse' }, { kind: 'text', text: '.' }]
 * ```
 */
export function proseSpans(line: string): ProseSpan[] {
  const spans: ProseSpan[] = []
  const text = (value: string) => {
    const last = spans.at(-1)
    if (value === '') return
    if (last?.kind === 'text') last.text += value
    else spans.push({ kind: 'text', text: value })
  }
  let from = 0
  for (const match of line.matchAll(FORMS)) {
    text(line.slice(from, match.index))
    const span = spanOf(match)
    if (span.kind === 'text') text(span.text)
    else spans.push(span)
    from = match.index + match[0].length
  }
  text(line.slice(from))
  return spans
}

/** The blocks of a manifest's prose as a page draws them: a block that starts with `## ` or `### ` is a heading, blocks that start with `- ` and follow one another are one list, and every other block is a paragraph.
 * @example
 * ```ts
 * import { parseProse } from 'songstress/prose'
 *
 * parseProse(['## Sources', '- Search', '- Links', 'Both are **off** until an admin turns them on.'])
 * // a heading, a list of two items, a paragraph
 * ```
 */
export function parseProse(blocks: readonly string[]): ProseBlock[] {
  const out: ProseBlock[] = []
  for (const block of blocks) {
    const heading = /^(##|###) (.+)$/.exec(block)
    const item = /^- (.+)$/.exec(block)
    const last = out.at(-1)
    if (heading) out.push({ kind: 'heading', level: heading[1] === '##' ? 2 : 3, spans: proseSpans(heading[2] ?? '') })
    else if (item && last?.kind === 'list') last.items.push(proseSpans(item[1] ?? ''))
    else if (item) out.push({ kind: 'list', items: [proseSpans(item[1] ?? '')] })
    else out.push({ kind: 'paragraph', spans: proseSpans(block) })
  }
  return out
}

/** A manifest's prose as Markdown, for a page's copy as text: the blocks as written, a blank line between them, and the items of one list on lines that follow one another.
 * @example
 * ```ts
 * import { proseToMarkdown } from 'songstress/prose'
 *
 * proseToMarkdown(['Finds lyrics.', '- Synced', '- Plain'])
 * // 'Finds lyrics.\n\n- Synced\n- Plain'
 * ```
 */
export function proseToMarkdown(blocks: readonly string[]): string {
  const isItem = (block: string | undefined) => block?.startsWith('- ') === true
  return blocks.map((block, at) => (at === 0 ? block : `${isItem(block) && isItem(blocks[at - 1]) ? '\n' : '\n\n'}${block}`)).join('')
}
