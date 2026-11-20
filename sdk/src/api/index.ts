// Everything the three code entries share: every type of the API, and the
// few values it has.

export type * from './api'
export type * from './commands'
export type * from './common'
export type * from './data'
export type * from './hooks'
export type * from './host'
export type * from './library'
export type * from './player'
export type * from './providers'
export type * from './signin'
export type * from './ui'
export type * from './work'
// The manifest's own types that the API's types speak of.
export type { MenuLocation, PermissionName } from '../manifest/schema'
export type { CatalogType, IconName, Platform, ProviderGroup, Side } from '../manifest/types.generated'
export { SongstressError } from './common'
export { UI_VERSION } from './host'
export { ProviderFailure } from './providers'
