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
import type { ClientUi, ServerUi, Ui } from './ui'
import type { Jobs, Routes } from './work'

/** What both entries have. */
export interface SharedApi {
  /** Listening to what happens: the hooks both entries have. */
  hooks: SharedHooks
  /** The handlers of the extension's declared commands. */
  commands: Commands
  /** The renderers of the extension's pages, panels and status items. */
  ui: Ui
  /** The extension's settings, as Songstress keeps them. */
  settings: Settings
  /** The extension's own small store. Permission `storage`. */
  storage: Store
  /** The only way to the network. Permission `network`. */
  net: Net
  /** What the code runs in: the API version, the side, and on the client the app. */
  host: Host
}

/** The API of the server entry: code that runs on the user's own server, in
 * a sandbox, for every member and every app. */
export interface ServerApi extends SharedApi {
  /** What happens on the server, for every member who granted it: plays, favourites, library changes. */
  hooks: ServerHooks
  /** The renderers of the extension's pages, panels and status items, and notices and refreshes for one member. */
  ui: ServerUi
  /** The extension's settings, the server's and, with `{ userId }`, each member's. */
  settings: ServerSettings
  /** The extension's own small store, as a whole and for each member. Permission `storage`. */
  storage: ServerStore
  /** Sealed credentials. Permission `secrets`. */
  secrets: Secrets
  /** One registry for each kind of source the extension adds. Permission `providers`. */
  providers: Providers
  /** The handlers of declared jobs, and starting a run. Permission `jobs`. */
  jobs: Jobs
  /** The handlers of declared routes. Permission `routes`. */
  routes: Routes
  /** The handler of the declared sign-in. Permission `secrets`. */
  signIn: SignInRegistry
  /** Reading the library. Permission `library.read`. */
  library: Library
  /** Reading members' ids and names. Permission `users.read`. */
  users: Users
}

/** The API of the client entry: code that runs inside one app, in a sandbox,
 * for the member signed in there, while the app is open. */
export interface ClientApi extends SharedApi {
  /** This device's player, live, while the app is open. */
  hooks: ClientHooks
  /** The handlers of the extension's commands, and running one of its server commands. */
  commands: ClientCommands
  /** The renderers of the extension's pages, panels and status items, and notices in this app. */
  ui: ClientUi
  /** This device's player. Permissions `listening.read` and `player.control`. */
  player: Player
  /** This device's queue. Permissions `listening.read` and `player.control`. */
  queue: Queue
}
