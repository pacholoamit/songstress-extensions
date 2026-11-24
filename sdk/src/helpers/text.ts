// Text as a source hands it out and as Songstress compares it: one spelling
// for comparing names (lowercase, no marks, words of letters and digits in
// any script), how alike two names and two lengths are, and the plain text
// of a page's HTML, which the sandbox has no DOM to read.

/** Text folded for comparing: lowercase, accents off, and every run of
 * anything but letters and digits (in any script) one space. Two names that
 * fold the same are the same name, as `matchScore` reads them.
 * @param text - The text.
 * @returns It, folded.
 * @example
 * ```ts
 * import { foldText } from 'songstress/server'
 *
 * foldText('Beyoncé — Halo (Live)') // "beyonce halo live"
 * foldText('Sigur Rós') === foldText('sigur ros') // true
 * ```
 */
export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .normalize('NFC')
}

/** The edit distance of a and b, for short texts. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]!
}

/** How alike two names are, from 0 to 1, after folding: 1 when they are
 * the same, 0.9 when one holds the other whole, else by their spelling. */
export function likeness(a: string, b: string): number {
  const x = foldText(a)
  const y = foldText(b)
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) return 0.9
  const longest = Math.max(x.length, y.length)
  if (longest > 300) return 0
  return Math.max(0, 1 - distance(x, y) / longest)
}

/** How alike two lengths in seconds are: 1 within 2 s, nothing past 30 s. */
export function lengthLikeness(a: number, b: number): number {
  const gap = Math.abs(a - b)
  if (gap <= 2) return 1
  return Math.max(0, 1 - (gap - 2) / 28)
}

const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** The character a numeric reference stands for ("#233", "#xE9"); "" for none. */
function numbered(name: string): string {
  const code = name.startsWith('#x') ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
}

/** HTML's character references, as the characters they stand for: every
 * numeric one (`&#233;`, `&#xE9;`) and the named ones a page's text uses
 * (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&nbsp;`, a space). Any other
 * name stays as it is written.
 * @param text - Text with references in it.
 * @returns The text, the references read.
 * @example
 * ```ts
 * import { unescapeHtml } from 'songstress/server'
 *
 * unescapeHtml('Simon &amp; Garfunkel &#8211; Am&eacute;lie') // "Simon & Garfunkel – Am&eacute;lie"
 * ```
 */
export function unescapeHtml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    const lower = name.toLowerCase()
    return lower.startsWith('#') ? numbered(lower) : (NAMED[lower] ?? whole)
  })
}

/** The text of an HTML fragment, as a reader sees it: comments out, a line
 * break a space, other tags out (an inline tag stays part of its word),
 * references read, every run of spaces one space. It reads no scripts and
 * no styles: hand it the fragment that holds the text.
 * @param fragment - The HTML.
 * @returns Its text.
 * @example
 * ```ts
 * import { htmlToText } from 'songstress/server'
 *
 * htmlToText('<h2 class="name">Dear <b>my</b> crazy<br>soulmate &amp; me</h2>') // "Dear my crazy soulmate & me"
 * ```
 */
export function htmlToText(fragment: string): string {
  return unescapeHtml(fragment.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}
