// A `when` clause, read for the validator (SPEC.md section 10, "Conditions"):
// the keys it names, and whether it is written in the grammar every app
// reads. Each app evaluates a clause with its own reader; this one only says
// what an app would make of it.
//
//   clause     := either
//   either     := both ("||" both)*
//   both       := not ("&&" not)*
//   not        := "!" not | term
//   term       := "(" either ")" | "true" | "false" | key (("==" | "!=") literal)?
//   literal    := 'text' | number | "true" | "false"
//   key        := a name, then ".name" parts: platform, setting.nowPlaying

/** How deep parentheses and `!` may nest. */
const MAX_NESTING = 8

/** A key, compared or not: `platform == 'ios'` names `platform`, with 'ios'. */
export interface WhenKey {
  key: string
  /** The literal it is compared to, as JSON; undefined when it stands alone. */
  value?: string | number | boolean
}

export type WhenRead = { ok: true; keys: WhenKey[] } | { ok: false; why: string }

type Token = { kind: 'op'; text: string } | { kind: 'key'; text: string } | { kind: 'value'; value: string | number | boolean }

const OPERATORS = ['&&', '||', '==', '!=', '!', '(', ')'] as const
const KEY = /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9][a-zA-Z0-9_-]*)*/
const NUMBER = /^-?\d+(?:\.\d+)?/

/** The word `rest` begins with, and how long it is; or a string saying why
 * no word can begin there. */
function nextToken(rest: string): [Token, number] | string {
  const op = OPERATORS.find((candidate) => rest.startsWith(candidate))
  if (op) return [{ kind: 'op', text: op }, op.length]
  if (rest.startsWith("'")) {
    const end = rest.indexOf("'", 1)
    return end < 0 ? 'a quote is never closed' : [{ kind: 'value', value: rest.slice(1, end) }, end + 1]
  }
  const number = NUMBER.exec(rest)?.[0]
  if (number) return [{ kind: 'value', value: Number(number) }, number.length]
  const word = KEY.exec(rest)?.[0]
  if (!word) return `"${Array.from(rest)[0]}" is not part of the grammar`
  const literal = word === 'true' || word === 'false'
  return [literal ? { kind: 'value', value: word === 'true' } : { kind: 'key', text: word }, word.length]
}

/** The clause cut into its words; a string saying why when it cannot be.
 * Spaces, tabs and line ends part words, as the server's reader takes them. */
function tokens(text: string): Token[] | string {
  const out: Token[] = []
  let rest = text.replace(/^[ \t\n\r]+/, '')
  while (rest.length > 0) {
    const next = nextToken(rest)
    if (typeof next === 'string') return next
    out.push(next[0])
    rest = rest.slice(next[1]).replace(/^[ \t\n\r]+/, '')
  }
  return out
}

class Unreadable extends Error {}

/** A reading of the tokens from the left, collecting the keys. */
class Reader {
  private at = 0
  private depth = 0
  readonly keys: WhenKey[] = []
  // A field set in the constructor, not a parameter property: the apps
  // compile the SDK's source with erasableSyntaxOnly (apps/web).
  private readonly words: Token[]

  constructor(words: Token[]) {
    this.words = words
  }

  private peek(): Token | undefined {
    return this.words[this.at]
  }

  private isOp(text: string): boolean {
    const next = this.peek()
    return next?.kind === 'op' && next.text === text
  }

  either(): void {
    this.both()
    while (this.isOp('||')) {
      this.at += 1
      this.both()
    }
  }

  private both(): void {
    this.not()
    while (this.isOp('&&')) {
      this.at += 1
      this.not()
    }
  }

  private nested(read: () => void): void {
    this.depth += 1
    if (this.depth > MAX_NESTING) throw new Unreadable(`it nests deeper than ${MAX_NESTING}`)
    read()
    this.depth -= 1
  }

  private not(): void {
    if (!this.isOp('!')) return this.term()
    this.at += 1
    this.nested(() => this.not())
  }

  private term(): void {
    const next = this.peek()
    this.at += 1
    if (next?.kind === 'op' && next.text === '(') {
      this.nested(() => this.either())
      if (!this.isOp(')')) throw new Unreadable('a parenthesis is never closed')
      this.at += 1
      return
    }
    if (next?.kind === 'value' && typeof next.value === 'boolean') return
    if (next?.kind !== 'key') throw new Unreadable(next ? 'a key is missing where it is expected' : 'it ends too soon')
    this.keys.push(this.compared(next.text))
  }

  private compared(key: string): WhenKey {
    if (!this.isOp('==') && !this.isOp('!=')) return { key }
    this.at += 1
    const literal = this.peek()
    this.at += 1
    if (literal?.kind !== 'value') throw new Unreadable(`${key} is compared to no value`)
    return { key, value: literal.value }
  }

  done(): void {
    if (this.at < this.words.length) throw new Unreadable('there is more after the end of the condition')
  }
}

/** What an app would make of `text`: the keys it names, or why no app can
 * read it. */
export function readWhen(text: string): WhenRead {
  const words = tokens(text)
  if (typeof words === 'string') return { ok: false, why: words }
  if (words.length === 0) return { ok: false, why: 'it says nothing' }
  const reader = new Reader(words)
  try {
    reader.either()
    reader.done()
  } catch (error) {
    if (error instanceof Unreadable) return { ok: false, why: error.message }
    throw error
  }
  return { ok: true, keys: reader.keys }
}
