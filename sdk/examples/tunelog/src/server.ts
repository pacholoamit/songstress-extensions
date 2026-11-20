// Tunelog Scrobbler: the server entry of the example in SPEC.md.
// It sends each member's plays to their own Tunelog profile.

import { songstress, type NetRequest, type Song } from 'songstress/server'

// Every address the extension reaches, written out. The manifest's `network`
// permission names the same host, and Songstress lets no request go elsewhere.
const tunelog = {
  nowPlaying: (request: NetRequest) => songstress.net.fetch('https://api.tunelog.example/v1/now-playing', request),
  listens: (request: NetRequest) => songstress.net.fetch('https://api.tunelog.example/v1/listens', request),
  profile: (request: NetRequest) => songstress.net.fetch('https://api.tunelog.example/v1/me', request),
}

interface Listen {
  title: string
  artist: string
  album?: string
  playedAt: string
}

/** A request signed with one member's token. */
function signed(token: string, body?: object): NetRequest {
  return {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }
}

const named = (song: Song) => ({ title: song.title, artist: song.artist, album: song.album })

// A song started in one of the member's apps: show it on their profile, when
// they want that. onPlay is live and may be missed, which suits "now playing".
songstress.hooks.onPlay(async (song, play) => {
  const member = { userId: play.userId }
  const token = await songstress.settings.get<string>('token', member)
  const wanted = await songstress.settings.get<boolean>('nowPlaying', member)
  if (token && wanted !== false) await tunelog.nowPlaying(signed(token, named(song)))
})

// A play counted. onScrobble is the reliable one: a play made offline arrives
// later with the time it really happened. What Tunelog does not take now is
// kept in the member's part of the store and sent with the next play.
songstress.hooks.onScrobble(async (song, play) => {
  const member = { userId: play.userId }
  const token = await songstress.settings.get<string>('token', member)
  if (!token) return
  const waiting = (await songstress.storage.get<Listen[]>('waiting', member)) ?? []
  const listens = [...waiting, { ...named(song), playedAt: play.playedAt }]
  const answer = await tunelog.listens(signed(token, { listens })).catch(() => null)
  const sent = answer !== null && answer.status < 300
  await songstress.storage.set('waiting', sent ? [] : listens.slice(-500), member)
})

// The "Test the connection" button of the settings page.
songstress.commands.register('test-connection', async (_input, context) => {
  const token = await songstress.settings.get<string>('token', { userId: context.userId })
  const answer = token ? await tunelog.profile(signed(token)).catch(() => null) : null
  const connected = answer?.status === 200
  const message = connected ? 'Tunelog is connected.' : 'Tunelog did not accept the token.'
  return { action: { type: 'toast', message, tone: connected ? 'success' : 'danger' } }
})
