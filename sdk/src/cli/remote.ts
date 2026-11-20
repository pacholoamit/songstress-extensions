// The server `songstress dev` pushes to: your own Songstress server, over
// http or https, signed in as one of its admins, through PocketBase's own SDK
// (as the apps reach it) and the server's extension routes
// (/api/songstress/extensions/v1, listed in apps/pocketbase/internal/
// extensions/README.md).

import PocketBase, { ClientResponseError } from 'pocketbase'

const ROUTES = '/api/songstress/extensions/v1'
/** How long the server waits for a log line before answering none. */
const LOG_WAIT_MS = 25_000

/** How to sign in: a session token, or an admin's email and password. */
export interface Credentials {
  readonly token?: string
  readonly email?: string
  readonly password?: string
}

/** An install, as the server answers it (the parts the command reads). */
export interface Install {
  readonly id: string
  readonly version: string
  readonly status: string
  readonly statusDetail?: string
}

/** A line of an extension's log. */
export interface LogLine {
  readonly seq: number
  readonly level: string
  readonly text: string
}

/** One problem with the manifest: the SDK's code, where, and a sentence. */
export interface Issue {
  readonly code: string
  readonly pointer: string
  readonly message: string
}

/** What the server said no to: its status, its code, its sentence, and the manifest's issues. */
export class Refused extends Error {
  override readonly name = 'Refused'
  readonly status: number
  readonly code: string
  readonly issues: readonly Issue[]

  constructor(status: number, code: string, message: string, issues: readonly Issue[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.issues = issues
  }
}

/** The server, as the command uses it. */
export interface Server {
  push(archive: Uint8Array): Promise<Install>
  logs(id: string, after: number, signal?: AbortSignal): Promise<LogLine[]>
}

function refusal(error: unknown): never {
  if (error instanceof ClientResponseError) {
    const answer = error.response as { error?: string; message?: string; issues?: Issue[] }
    throw new Refused(error.status, answer.error ?? 'failed', answer.message ?? error.message, answer.issues ?? [])
  }
  throw error
}

/** The server at url, signed in. */
export async function connect(url: string, credentials: Credentials): Promise<Server> {
  const pb = new PocketBase(url)
  pb.autoCancellation(false)
  if (credentials.token) {
    pb.authStore.save(credentials.token)
  } else if (credentials.email && credentials.password) {
    await pb.collection('users').authWithPassword(credentials.email, credentials.password).catch(refusal)
  } else {
    throw new Refused(0, 'sign-in', 'Sign in as an admin of the server: --email with SONGSTRESS_PASSWORD, or SONGSTRESS_TOKEN.')
  }
  return {
    push: (archive) =>
      pb
        .send<Install>(`${ROUTES}/dev`, { method: 'POST', body: new Blob([archive]), headers: { 'Content-Type': 'application/zip' } })
        .catch(refusal),
    logs: async (id, after, signal) => {
      const answer = await pb
        .send<{ lines: LogLine[] }>(`${ROUTES}/installs/${encodeURIComponent(id)}/logs`, { query: { after, wait: LOG_WAIT_MS }, signal })
        .catch(refusal)
      return answer.lines
    },
  }
}
