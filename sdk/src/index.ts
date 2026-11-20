// songstress: the extension API as code that runs in either entry may use it.
// The server entry imports "songstress/server", the client entry
// "songstress/client": each adds what only its side has.

export * from './api/index'
export { API_PERMISSIONS, sharedApi as songstress } from './host'
export type { Needs } from './host'
export { API_VERSION } from './version'
