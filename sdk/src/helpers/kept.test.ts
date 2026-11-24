import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockHost, type MockHost } from '../testing/host'
import { KeptValue } from './kept'

let host: MockHost | undefined
afterEach(() => {
  host?.remove()
  vi.useRealTimers()
})

const withStorage = () => (host = createMockHost({ manifest: { permissions: { storage: {} } } }))

describe('KeptValue', () => {
  it('is nothing until set, the value until its time, and nothing after', async () => {
    withStorage()
    vi.useFakeTimers({ now: 1_000_000 })
    const token = new KeptValue<string>('token')
    expect(await token.get()).toBeNull()
    await token.set('abc', 1_060_000)
    expect(await token.get()).toBe('abc')
    vi.setSystemTime(1_060_000)
    expect(await token.get()).toBeNull()
  })

  it('is kept in the store, so another instance reads it, until it is deleted', async () => {
    const mock = withStorage()
    await new KeptValue<{ id: string }>('client').set({ id: 'c1' }, Date.now() + 60_000)
    expect(await new KeptValue<{ id: string }>('client').get()).toEqual({ id: 'c1' })
    await new KeptValue('client').delete()
    expect(await new KeptValue('client').get()).toBeNull()
    expect(mock.calls.map((call) => call.member)).toEqual(['storage.set', 'storage.get', 'storage.delete', 'storage.get'])
  })

  it('asks once for calls made at the same time, keeps what it brings, and asks again after a failure', async () => {
    withStorage()
    const token = new KeptValue<string>('token')
    let asked = 0
    const fetch = vi.fn(async () => ({ value: `t${++asked}`, until: Date.now() + 60_000 }))
    expect(await Promise.all([token.getOr(fetch), token.getOr(fetch), token.getOr(fetch)])).toEqual(['t1', 't1', 't1'])
    expect(await token.getOr(fetch)).toBe('t1')
    expect(fetch).toHaveBeenCalledTimes(1)
    const other = new KeptValue<string>('other')
    await expect(other.getOr(() => Promise.reject(new Error('the source refused')))).rejects.toThrow('the source refused')
    expect(await other.getOr(fetch)).toBe('t2')
  })

  it('is kept in memory alone when the manifest asks for no storage, and never throws for it', async () => {
    const mock = (host = createMockHost({ manifest: { permissions: {} } }))
    const token = new KeptValue<string>('token')
    await token.set('abc', Date.now() + 60_000)
    expect(await token.get()).toBe('abc')
    await token.delete()
    expect(await token.get()).toBeNull()
    expect(mock.calls.map((call) => call.member)).toEqual(['storage.set', 'storage.delete', 'storage.get'])
  })
})
