// The ping that tells songstress.app a new index is out: signed as
// songstress.app checks it, and asked again when a commit pushed a moment ago
// is not served yet.

import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { ping, signature } from './ping'

describe('signature', () => {
  it('is over the time and the body, as songstress.app checks it', () => {
    const secret = 'a ping secret of thirty-two characters or more'
    const body = JSON.stringify({ commit: 'c'.repeat(40) })
    expect(signature(secret, body, 1795132800)).toBe(`t=1795132800,v1=${createHmac('sha256', secret).update(`1795132800.${body}`).digest('hex')}`)
    expect(signature(secret, body, 1795132800)).not.toBe(signature(secret, body, 1795132801))
    expect(signature(secret, body, 1795132800)).not.toBe(signature(secret, `${body} `, 1795132800))
  })
})

describe('ping', () => {
  const quiet = () => vi.spyOn(console, 'log').mockImplementation(() => undefined)

  it('is asked again, twice at most, until songstress.app takes the index', async () => {
    quiet()
    const pause = vi.fn(async () => undefined)
    const answers = [{ status: 409, text: '{"taken":false,"why":"index_unavailable"}' }, { status: 200, text: '{"taken":true,"sequence":3,"listed":5}' }]
    const ask = vi.fn(async () => answers.shift()!)
    expect(await ping('secret', 'c'.repeat(40), ask, pause)).toBe(true)
    expect(ask).toHaveBeenCalledTimes(2)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('fails when songstress.app never says yes', async () => {
    quiet()
    const ask = vi.fn(async () => ({ status: 503, text: '{"error":"unavailable"}' }))
    expect(await ping('secret', 'c'.repeat(40), ask, async () => undefined)).toBe(false)
    expect(ask).toHaveBeenCalledTimes(3)
  })
})
