// What an extension can find out about where it runs, so that it need not
// assume. An app may be unable to run client code or to show free-form views
// (a phone build made for an app store leaves both out): code asks, and
// offers a declared page where a view cannot be shown.

import type { Platform, Side } from '../manifest/types.generated'

/** The version of the component vocabulary (ui.ts) this package describes.
 * An app says which version it draws in `ClientInfo.ui`. Version 2 added the
 * tree screen, status items, and the pick, input and notify actions. */
export const UI_VERSION = 2

/** What an app can show or run of an extension. */
export interface ClientCapabilities {
  /** It runs extensions' client entries. */
  clientCode: boolean
  /** It opens free-form views: in the browser, apart from the app. */
  views: boolean
}

/** An app that draws an extension's interface or runs its client code. */
export interface ClientInfo {
  platform: Platform
  /** The version of the component vocabulary the app draws. A node it does
   * not know is shown as "needs a newer app". */
  ui: number
  capabilities: ClientCapabilities
}

/** Where the code is running. */
export interface HostInfo {
  /** The extension API version of this host: the version `engines.songstress`
   * is held against. */
  apiVersion: string
  /** The entry the code is running as. */
  side: Side
  /** The extension itself, as installed. */
  extension: { id: string; version: string }
  /** The app the code runs in. On the client side only. */
  client?: ClientInfo
}

/** Asking the host about itself. Both sides; no permission. */
export interface Host {
  info(): Promise<HostInfo>
}
