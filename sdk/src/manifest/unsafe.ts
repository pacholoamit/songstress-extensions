// The characters no text of a manifest may hold (TEXT_UNSAFE): those that
// cannot be seen and those that change the direction text reads in. A name
// or a permission's reason is shown to the person who grants it, and must
// read as it is written: a name of three Hangul fillers is a blank name.
//
// The ranges are code points, inclusive: the controls, the line and
// paragraph separators, the interlinear annotation characters, and every
// code point Unicode calls default-ignorable (DerivedCoreProperties.txt,
// Default_Ignorable_Code_Point, checked against Unicode 18.0.0), which draw
// nothing, but those a script or an emoji needs. Those stay legal: the
// zero-width joiners (U+200C, U+200D), the direction marks (U+200E, U+200F,
// U+061C), the Mongolian variation selectors and vowel separator (U+180B to
// U+180F) and the variation selectors (U+FE00 to U+FE0F, U+E0100 to
// U+E01EF). Half a surrogate pair and U+FFFD are here for a value that never
// went through the reader, which refuses both.

export const UNSAFE_CODE_POINTS: readonly (readonly [from: number, to: number])[] = [
  [0x0000, 0x001f], // C0 controls, line breaks and tabs among them
  [0x007f, 0x009f], // delete and the C1 controls
  [0x00ad, 0x00ad], // soft hyphen
  [0x034f, 0x034f], // combining grapheme joiner
  [0x115f, 0x1160], // Hangul choseong and jungseong fillers
  [0x17b4, 0x17b5], // Khmer inherent vowels, which draw nothing
  [0x200b, 0x200b], // zero-width space
  [0x2028, 0x2029], // line and paragraph separators
  [0x202a, 0x202e], // direction embeddings and overrides
  [0x2060, 0x206f], // word joiner, invisible operators, direction isolates, deprecated format characters
  [0x3164, 0x3164], // Hangul filler
  [0xd800, 0xdfff], // a surrogate with no partner
  [0xfeff, 0xfeff], // byte-order mark
  [0xffa0, 0xffa0], // halfwidth Hangul filler
  [0xfff0, 0xfffb], // unassigned ignorable code points, interlinear annotation characters
  [0xfffd, 0xfffd], // the mark a decoder leaves for what it could not read
  [0x1bca0, 0x1bca3], // shorthand format controls
  [0x1d173, 0x1d17a], // musical symbol format characters: beams, ties, slurs, phrases
  [0xe0000, 0xe00ff], // tag characters, and the unassigned ignorable code points around them
  [0xe01f0, 0xe0fff], // the unassigned ignorable code points after the variation selectors
]

const isUnsafe = (point: number) => UNSAFE_CODE_POINTS.some(([from, to]) => point >= from && point <= to)

/** A code point as Unicode writes it: "U+202E". */
const named = (point: number) => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`

/** The first unsafe character of `text` as "U+202E", or null. */
export function firstUnsafe(text: string): string | null {
  for (const char of text) {
    const point = char.codePointAt(0) ?? 0
    if (isUnsafe(point)) return named(point)
  }
  return null
}

/** `text` with each unsafe character written as its name ("<U+202E>"): how
 * a message quotes a manifest's own text, so that what a person reads about
 * a manifest cannot hide or reverse anything either. */
export function shown(text: string): string {
  let out = ''
  for (const char of text) {
    const point = char.codePointAt(0) ?? 0
    out += isUnsafe(point) ? `<${named(point)}>` : char
  }
  return out
}
