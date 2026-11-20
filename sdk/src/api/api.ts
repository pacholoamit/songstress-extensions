// The extension API, whole: what `songstress` is in each entry.
//
//   import { songstress } from 'songstress/server'   the server entry
//   import { songstress } from 'songstress/client'   the client entry
//   import { songstress } from 'songstress'          code that runs in either
//
// Each namespace says which permission its calls need. A call the manifest
// did not ask for, or that nobody granted, rejects with a SongstressError
// whose code is "permission-denied".

import type { ClientCommands, Commands } from './commands'
import type { Net, Secrets, ServerSettings, ServerStore, Settings, Store } from './data'
import type { ClientHooks, ServerHooks, SharedHooks } from './hooks'
import type { Host } from './host'
import type { Library, Users } from './library'
import type { Player, Queue } from './player'
import type { Providers } from './providers'
import type { SignInRegistry } from './signin'
import type { Ui } from './ui'
import type { Jobs, Routes } from './work'

/** What both entries have. */
export interface SharedApi {
  hooks: SharedHooks
  commands: Commands
  ui: Ui
  settings: Settings
  storage: Store
  net: Net
  host: Host
}

/** The API of the server entry: code that runs on the user's own server, in
 * a sandbox, for every member and every app. */
export interface ServerApi extends SharedApi {
  hooks: ServerHooks
  settings: ServerSettings
  storage: ServerStore
  secrets: Secrets
  providers: Providers
  jobs: Jobs
  routes: Routes
  signIn: SignInRegistry
  library: Library
  users: Users
}

/** The API of the client entry: code that runs inside one app, in a sandbox,
 * for the member signed in there, while the app is open. */
export interface ClientApi extends SharedApi {
  hooks: ClientHooks
  commands: ClientCommands
  player: Player
  queue: Queue
}
