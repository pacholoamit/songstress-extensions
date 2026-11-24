import { describe, expect, it } from 'vitest'
import { parseUrl, queryString, resolveUrl, urlParam } from './url'

describe('parseUrl and urlParam', () => {
  it('read an absolute http or https address, and nothing else', () => {
    expect(parseUrl(' https://Music.Example.com/album/42?l=en#top ')).toEqual({ scheme: 'https', host: 'music.example.com', path: '/album/42', query: 'l=en' })
    expect(parseUrl('HTTP://example.com:8080')).toEqual({ scheme: 'http', host: 'example.com:8080', path: '/', query: '' })
    expect(parseUrl('example.com/album/42')).toBeNull()
    expect(parseUrl('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toBeNull()
    expect(parseUrl('https://user:secret@example.com/')).toBeNull()
  })

  it('read a parameter decoded, the first of two, and "" for one missing or one that does not decode', () => {
    const url = 'https://music.example.com/search?i=1440&q=sigur+r%C3%B3s&i=9&flag&bad=%E0%A4%A&n%61me=x'
    expect(urlParam(url, 'i')).toBe('1440')
    expect(urlParam(parseUrl(url), 'q')).toBe('sigur rós')
    expect(urlParam(url, 'flag')).toBe('')
    expect(urlParam(url, 'bad')).toBe('')
    expect(urlParam(url, 'name')).toBe('x')
    expect(urlParam(url, 'missing')).toBe('')
    expect(urlParam(null, 'i')).toBe('')
    expect(urlParam('not an address', 'i')).toBe('')
  })
})

describe('resolveUrl and queryString', () => {
  it('resolve a reference as a browser resolves a link', () => {
    const base = 'https://cdn.example.com/hls/42/index.m3u8?sig=1'
    expect(resolveUrl('segment-1.aac', base)).toBe('https://cdn.example.com/hls/42/segment-1.aac')
    expect(resolveUrl('./segment-2.aac?part=2', base)).toBe('https://cdn.example.com/hls/42/segment-2.aac?part=2')
    expect(resolveUrl('../keys/k1', base)).toBe('https://cdn.example.com/hls/keys/k1')
    expect(resolveUrl('../../../../k2', base)).toBe('https://cdn.example.com/k2')
    expect(resolveUrl('/art/42.jpg', base)).toBe('https://cdn.example.com/art/42.jpg')
    expect(resolveUrl('//other.example.com/a', base)).toBe('https://other.example.com/a')
    expect(resolveUrl('HTTP://other.example.com/b', base)).toBe('HTTP://other.example.com/b')
    expect(resolveUrl('a', 'not an address')).toBe('')
  })

  it('keep the base path for a query or a fragment alone, and a fragment out of the path', () => {
    const base = 'https://cdn.example.com/hls/42/index.m3u8?sig=1'
    expect(resolveUrl('?sig=2', base)).toBe('https://cdn.example.com/hls/42/index.m3u8?sig=2')
    expect(resolveUrl('#t=10', base)).toBe('https://cdn.example.com/hls/42/index.m3u8?sig=1#t=10')
    expect(resolveUrl('', base)).toBe('https://cdn.example.com/hls/42/index.m3u8?sig=1')
    expect(resolveUrl('part.aac#t=10', base)).toBe('https://cdn.example.com/hls/42/part.aac#t=10')
    expect(resolveUrl('part.aac?x=1#t=10', base)).toBe('https://cdn.example.com/hls/42/part.aac?x=1#t=10')
  })

  it('write a query in order, encoded, with the empty parameters left out', () => {
    expect(queryString({ q: 'sigur rós & co', limit: 25, explicit: false, offset: undefined, market: '' })).toBe('q=sigur%20r%C3%B3s%20%26%20co&limit=25&explicit=false')
    expect(queryString({})).toBe('')
  })
})
