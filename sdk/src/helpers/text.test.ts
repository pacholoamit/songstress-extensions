import { describe, expect, it } from 'vitest'
import { foldText, htmlToText, likeness, unescapeHtml } from './text'

describe('foldText and likeness', () => {
  it('fold case, marks and punctuation, in any script', () => {
    expect(foldText('Beyoncé — Halo (Live)')).toBe('beyonce halo live')
    expect(foldText('Sigur Rós')).toBe(foldText('sigur ros'))
    expect(foldText('  아이유 (IU)  ')).toBe('아이유 iu')
    expect(foldText('ＡＢＣ')).toBe('abc')
  })

  it('count the same name whole, one held in the other 0.9, any other by its spelling', () => {
    expect(likeness('Halo', 'HALO!')).toBe(1)
    expect(likeness('Halo', 'Halo (Live)')).toBe(0.9)
    expect(likeness('Halo', 'Hello')).toBeCloseTo(0.6)
    expect(likeness('', 'Halo')).toBe(0)
  })
})

describe('unescapeHtml and htmlToText', () => {
  it('read numeric references and the named ones a page uses, and leave any other name', () => {
    expect(unescapeHtml('Simon &amp; Garfunkel &#8211; Am&eacute;lie')).toBe('Simon & Garfunkel – Am&eacute;lie')
    expect(unescapeHtml('&lt;b&gt; &quot;x&quot; &#39;y&#x27; &nbsp;|&#x1F3B5;|&#0;|&#x110000;')).toBe('<b> "x" \'y\'  |🎵||')
  })

  it('give the text of a fragment', () => {
    expect(htmlToText('<h2 class="name">Dear <b>my</b> crazy<br>soulmate &amp; me</h2>')).toBe('Dear my crazy soulmate & me')
    expect(htmlToText('<!-- <p>hidden</p> -->\n  <p>one</p>\n\n<p>two<br/>three</p>')).toBe('one two three')
  })
})
