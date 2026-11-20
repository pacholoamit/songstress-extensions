// Text as the sources compare and show it: one spelling for comparing
// (lowercase, no marks, words of letters and digits in any script), a
// likeness of two names from 0 to 1, of two lengths too, and the plain text
// of a page's HTML.

/** Text folded for comparing: lowercase, accents off, every run of
 * anything but letters and digits one space. */
export function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
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
  const x = fold(a)
  const y = fold(b)
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

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

/** HTML's character references, as the characters they stand for. */
export function unescapeHTML(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (whole, name: string) => {
    const lower = name.toLowerCase()
    if (lower.startsWith('#x') || /^#\d+$/.test(lower)) {
      const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    }
    return NAMED[lower] ?? whole
  })
}

/** The text of an HTML fragment: comments out, a line break a space, other
 * tags out (an inline span stays part of its word), references read,
 * spaces made one. */
export function htmlText(fragment: string): string {
  return unescapeHTML(fragment.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}
