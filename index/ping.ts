#!/usr/bin/env node
// Tell songstress.app that a new signed index is out, the last step of the
// index workflow (.github/workflows/index.yml):
//
//   node index/ping.ts <commit of the index branch>
//
// It POSTs {"commit": "<sha>"} to songstress.app/api/extensions/index/,
// signed with INDEX_PING_SECRET (the secret this repository's `index`
// environment and songstress.app share): HMAC-SHA256 of "<t>." and the body,
// sent as `X-Songstress-Signature: t=<unix seconds>,v1=<hex>`. songstress.app
// then fetches the index at that commit and takes it only if its own
// signature holds. A commit pushed a moment ago may not be served yet, so a
// refusal is asked again twice, twenty seconds apart; what it answers last
// decides, and anything but a yes fails this command, so the workflow fails
// where its owner sees it. (songstress.app also reads the index branch once a
// day, so a ping that never lands is caught up with.)

import { createHmac } from 'node:crypto'

const SITE = 'https://songstress.app/api/extensions/index/'
const TRIES = 3
const PAUSE_MS = 20_000

/** The signature header's value for a body sent at `seconds`. */
export function signature(secret: string, body: string, seconds: number): string {
  return `t=${seconds},v1=${createHmac('sha256', secret).update(`${seconds}.${body}`).digest('hex')}`
}

/** One ping: songstress.app's status and the start of its answer, or 0 and
 * why when it could not be asked. */
async function once(secret: string, commit: string): Promise<{ status: number; text: string }> {
  const body = JSON.stringify({ commit })
  try {
    const response = await fetch(SITE, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Songstress-Signature': signature(secret, body, Math.floor(Date.now() / 1000)) }, body, signal: AbortSignal.timeout(60_000) })
    return { status: response.status, text: (await response.text()).slice(0, 300) }
  } catch (error) {
    return { status: 0, text: error instanceof Error ? error.message : 'no answer' }
  }
}

/** Ping until songstress.app says yes, TRIES times at most. */
export async function ping(secret: string, commit: string, ask = once, pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))): Promise<boolean> {
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    const { status, text } = await ask(secret, commit)
    console.log(`songstress.app answered ${status || 'nothing'}: ${text}`)
    if (status >= 200 && status < 300) return true
    if (attempt < TRIES) await pause(PAUSE_MS)
  }
  return false
}

async function main(argv: string[]): Promise<number> {
  const [commit] = argv
  const secret = process.env.INDEX_PING_SECRET ?? ''
  if (!/^[0-9a-f]{40}$/.test(commit ?? '') || secret.length < 32) {
    console.error('node index/ping.ts <commit>, with INDEX_PING_SECRET set (32 characters or more)')
    return 2
  }
  return (await ping(secret, commit!)) ? 0 : 1
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2))
