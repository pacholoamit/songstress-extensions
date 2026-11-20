// songstress/testing: a stand-in Songstress for an extension's own tests.
//
//   const host = createMockHost({ manifest, settings: { token: 'abc' } })
//   await import('./server')                    // the entry registers
//   await host.emit('onScrobble', song, play)   // a play counts
//   expect(host.requests).toHaveLength(1)
//   host.remove()
//
// It keeps what the entry registers and lets a test call it as Songstress
// does, answers the store, the secrets and the settings from memory, and
// hands the network to a function of the test's. Given the manifest it also
// refuses what a real host refuses for the same reason: a call whose
// permission the manifest does not ask for, a request to a host it does not
// name, a hook it does not list. It runs no sandbox: limits, deadlines and
// what a member granted are a real server's to show (`songstress dev`).

export { createMockHost } from './testing/host'
export type {
  HookArguments,
  HookName,
  MockCall,
  MockHost,
  MockHostOptions,
  MockManifest,
  MockRequest,
  ProviderOf,
} from './testing/host'
