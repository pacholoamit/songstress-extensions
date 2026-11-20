// Signing in to the service an extension reaches (the manifest's
// `contributes.signIn`). A person starts it in Songstress, signs in on the
// service's own page, and comes back; the extension's handlers do the two
// halves the service asks of it, and keep what they are given with
// `songstress.secrets`. Songstress keeps only the name of the account.
//
// Scope "server" is one account for the whole server: its admin signs in,
// and no member is named in any call.

import type { Awaitable, Disposable } from './common'

/** What `start` is handed. */
export interface SignInStart {
  /** Where the service must send the person back: this server's own
   * address for it. Register it with the service as the redirect address. */
  redirectUrl: string
  /** A one-time value the service must hand back unchanged (OAuth's
   * `state`): Songstress finishes only the sign-in that carries it. */
  state: string
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
}

/** The account now signed in. */
export interface SignedIn {
  /** The account as its owner knows it (a name, an address): what the admin
   * reads beside "Signed in as". */
  account: string
}

/** The two halves of a sign-in, and its end. A half that cannot be done
 * throws a `ProviderFailure`; anything else thrown counts as broken. */
export interface SignInHandler {
  /** The service's page for this sign-in. Keep what `finish` will need (a
   * code verifier) in `songstress.secrets`: another instance may run it. */
  start(request: SignInStart): Awaitable<SignInPage>
  /** Trades what came back for the account's tokens, keeps them in
   * `songstress.secrets`, and answers whose account it is. */
  finish(returned: SignInReturn): Awaitable<SignedIn>
  /** Forgets the tokens, and tells the service when it has a way to. Left
   * out, signing out only forgets the account's name. */
  signOut?(): Awaitable<void>
}

/** The sign-in the manifest declares. Server entry; permission `secrets`. */
export interface SignInRegistry {
  /** Registers the declared sign-in's handler: one for the extension. */
  register(handler: SignInHandler): Disposable
}
