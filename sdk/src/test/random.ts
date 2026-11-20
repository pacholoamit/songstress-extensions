// A seeded source of randomness and the manglers the fuzz tests share: the
// same seed gives the same thousand manifests on every machine, so a failure
// can be run again.

import { isRecord } from '../manifest/json'

export type Random = () => number

/** A 32-bit xorshift generator: three shifts, good enough to pick things.
 * Zero is its one fixed point, so a seed of zero is replaced. */
export function seeded(seed: number): Random {
  let state = seed >>> 0 || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
}

export function pick<T>(random: Random, from: readonly T[]): T {
  return from[Math.floor(random() * from.length)]
}

type Holder = Record<string, unknown> | unknown[]
type Place = [holder: Holder, key: string | number]

/** Every place under `value` that holds something: a field or a list item. */
function places(value: unknown, found: Place[] = []): Place[] {
  if (Array.isArray(value)) value.forEach((item, index) => places(item, (found.push([value, index]), found)))
  else if (isRecord(value)) for (const key of Object.keys(value)) places(value[key], (found.push([value, key]), found))
  return found
}

const get = ([holder, key]: Place): unknown => (holder as Record<string | number, unknown>)[key]

function set([holder, key]: Place, to: unknown): void {
  ;(holder as Record<string | number, unknown>)[key] = to
}

function remove([holder, key]: Place): void {
  if (Array.isArray(holder)) holder.splice(key as number, 1)
  else delete holder[key]
}

// What a field may be swapped for: every JSON type, the edges of the
// numbers and lengths the schema limits, and names every object has.
const STAND_INS: readonly unknown[] = [
  null,
  true,
  false,
  0,
  -1,
  1.5,
  512,
  1280,
  720,
  4000,
  1e21,
  '',
  'x',
  'x'.repeat(300),
  'onPlay',
  'server',
  '1.0.0',
  '*.example.com',
  '../x.png',
  'constructor',
  [],
  {},
  [[]],
  { type: 'string' },
  { reason: 'A reason long enough to pass.' },
]

const EXTRA_KEYS = ['extra', '__proto__', 'constructor', 'toString', 'type', 'id', 'a/b', 'a~b', '']

type Mangler = (place: Place, random: Random) => void

const MANGLERS: readonly Mangler[] = [
  (place) => remove(place),
  // A copy, never the stand-in itself: a later turn may add a field inside
  // what was put here, which must not change the stand-in for every later
  // round, nor put the value inside itself.
  (place, random) => set(place, structuredClone(pick(random, STAND_INS))),
  // Add a field beside it, or inside it when it is an object.
  (place, random) => {
    const target = get(place)
    const into = isRecord(target) ? target : place[0]
    if (isRecord(into)) Object.defineProperty(into, pick(random, EXTRA_KEYS), { value: structuredClone(pick(random, STAND_INS)), enumerable: true, writable: true, configurable: true })
  },
  // Say a list item twice.
  (place) => {
    if (Array.isArray(place[0])) place[0].push(structuredClone(get(place)))
  },
  // Cut a text short, or stretch it.
  (place, random) => {
    const text = get(place)
    if (typeof text === 'string') set(place, random() < 0.5 ? text.slice(0, Math.floor(random() * text.length)) : text + text)
  },
  // Move something to where it does not belong.
  (place, random) => {
    const others = places(place[0])
    if (others.length > 0) set(place, structuredClone(get(pick(random, others))))
  },
]

/** A copy of `value` with one to three things wrong with it, or nothing
 * wrong at all when the dice fall that way. */
export function mangle(value: unknown, random: Random): unknown {
  const copy = structuredClone(value)
  for (let turn = 1 + Math.floor(random() * 3); turn > 0; turn -= 1) {
    const all = places(copy)
    if (all.length > 0) pick(random, MANGLERS)(pick(random, all), random)
  }
  return copy
}
