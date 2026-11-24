// Signing in to the service an extension reaches (the manifest's
// `contributes.signIn`). A person starts it in Songstress, signs in on the
// service's own page, and comes back; the extension's handlers do the two
// halves the service asks of it, and keep what they are given with
// `songstress.secrets`. Songstress keeps only the name of the account.
//
// Scope "server" is one account for the whole server: its admin signs in,
// and no member is named in any call. Scope "user" is each member's own
// account: they sign in themselves, every call names them (`userId`), and
// the handler keeps their tokens as that member's
// (`songstress.secrets.set(key, value, { userId })`).

import type { Awaitable, Disposable } from './common'

/** What `start` is handed. */
export interface SignInStart {
  /** Where the service must send the person back: this server's own
   * address for it. Register it with the service as the redirect address. */
  redirectUrl: string
  /** A one-time value the service must hand back unchanged (OAuth's
   * `state`): Songstress finishes only the sign-in that carries it. */
  state: string
  /** The member signing in, for a sign-in of scope "user"; left out for the
   * server's own. */
  userId?: string
}

/** Where the person signs in. */
export interface SignInPage {
  /** The service's own page, an http or https address, with `redirectUrl`
   * and `state` in it as the service asks for them. */
  url: string
}

/** What `finish` is handed. */
export interface SignInReturn {
  /** The address the person came back on, whole: what the service added to
   * `redirectUrl` (a code, an error) is in it. */
  url: string
  /** The `redirectUrl` that `start` was handed, for a service that asks for
   * it again. */
  redirectUrl: string
  /** The member who signed in, for a sign-in of scope "user": the one
   * `start` was handed. Keep their tokens as theirs. */
  userId?: string
}

/** What `signOut` is handed: whose account ends. */
export interface SignOutRequest {
  /** The member signing out, for a sign-in of scope "user"; left out for
   * the server's own. */
  userId?: string
}

/** The account now signed in. */
export interface SignedIn {
  /** The account as its owner knows it (a name, an address): what the
   * person who signed in reads beside "Signed in as". */
  account: string
}

/** The two halves of a sign-in, and its end. A half that cannot be done
 * throws a `ProviderFailure`; anything else thrown counts as broken. */
export interface SignInHandler {
  /** The service's page for this sign-in. Keep what `finish` will need (a
   * code verifier) in `songstress.secrets`: another instance may run it.
   * @param request - Where the service sends the person back, and the `state` it must return.
   */
  start(request: SignInStart): Awaitable<SignInPage>
  /** Trades what came back for the account's tokens, keeps them in
   * `songstress.secrets`, and answers whose account it is.
   * @param returned - The address the person came back on.
   */
  finish(returned: SignInReturn): Awaitable<SignedIn>
  /** Forgets the tokens, and tells the service when it has a way to. Left
   * out, signing out only forgets the account's name.
   * @param request - Whose account it is.
   */
  signOut?(request: SignOutRequest): Awaitable<void>
}

/** The sign-in the manifest declares. Server entry; permission `secrets`. */
export interface SignInRegistry {
  /** Registers the declared sign-in's handler: one for the extension.
   * @param handler - What starts and finishes the sign-in.
   * @example
   * ```ts
   * import { fetchJson, queryString, songstress, urlParam } from 'songstress/server'
   *
   * const AUTH = 'https://accounts.example.com'
   *
   * songstress.signIn.register({
   *   start: (request) => ({
   *     url: `${AUTH}/authorize?${queryString({ client_id: 'my-extension', redirect_uri: request.redirectUrl, state: request.state })}`,
   *   }),
   *   async finish(returned) {
   *     const code = urlParam(returned.url, 'code')
   *     const got = await fetchJson<{ token: string; name: string }>(`${AUTH}/token`, {
   *       method: 'POST',
   *       body: JSON.stringify({ code, redirect_uri: returned.redirectUrl }),
   *     })
   *     await songstress.secrets.set('token', got.token, returned.userId ? { userId: returned.userId } : undefined)
   *     return { account: got.name }
   *   },
   *   async signOut(request) {
   *     await songstress.secrets.delete('token', request.userId ? { userId: request.userId } : undefined)
   *   },
   * })
   * ```
   */
  register(handler: SignInHandler): Disposable
}
