// A stand-in host for the tests: it records every call the SDK hands over
// and answers from a script. The real test kit for extension authors comes
// with the runtime; this is only what this package's own tests need.

import { HOST_KEY, type HostBridge } from '../host'

export interface Call {
  readonly member: string
  readonly args: readonly unknown[]
}

type Answers = Record<string, (...args: never[]) => unknown>

const slot = globalThis as { [HOST_KEY]?: HostBridge }

/** Puts a host in place that answers each member from `answers`, and a
 * disposable for every member it has no answer for. */
export function installHost(answers: Answers = {}): { calls: Call[]; remove(): void } {
  const calls: Call[] = []
  slot[HOST_KEY] = {
    call(member, args) {
      calls.push({ member, args })
      const answer = answers[member] as ((...given: readonly unknown[]) => unknown) | undefined
      return answer ? answer(...args) : { dispose: () => undefined }
    },
  }
  return { calls, remove: () => delete slot[HOST_KEY] }
}
