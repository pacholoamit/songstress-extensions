// The library as an extension sees it: plain facts about songs, albums,
// artists and playlists. Nothing of one member's own (their likes, their play
// counts) and nothing of the server's disk (file paths) is in these shapes.
// Lengths are in seconds everywhere in the API.

/** A song of the library. */
export interface Song {
  /** Its library id. */
  id: string
  /** Its title. */
  title: string
  /** The artist as the song's tags credit them. */
  artist: string
  /** Its artist's library id. */
  artistId?: string
  /** Its album's name. */
  album?: string
  /** Its album's library id. */
  albumId?: string
  /** Its length, in seconds. */
  durationS?: number
  /** Its place on its album. */
  track?: number
  /** Its disc. */
  disc?: number
  /** The year it came out. */
  year?: number
  /** Its genre. */
  genre?: string
  /** The recording's ISRC, when its tags carry one. */
  isrc?: string
  /** The recording's MusicBrainz id, when its tags carry one. */
  musicBrainzId?: string
}

/** An album of the library. */
export interface Album {
  /** Its library id. */
  id: string
  /** Its name. */
  name: string
  /** Its artist's name. */
  artist: string
  /** Its artist's library id. */
  artistId?: string
  /** The year it came out. */
  year?: number
  /** Its genre. */
  genre?: string
  /** How many songs it holds. */
  songCount?: number
  /** Its length, in seconds. */
  durationS?: number
  /** The release group's MusicBrainz id, when the tags carry one. */
  musicBrainzId?: string
}

/** An artist of the library. */
export interface Artist {
  /** Its library id. */
  id: string
  /** Its name. */
  name: string
  /** How many albums the library holds of theirs. */
  albumCount?: number
  /** Its MusicBrainz id. */
  musicBrainzId?: string
}

/** A playlist. */
export interface Playlist {
  /** Its library id. */
  id: string
  /** Its name. */
  name: string
  /** What the playlist's owner wrote about it. */
  description?: string
  /** The member it belongs to. */
  ownerId?: string
  /** Every member can see it. */
  public?: boolean
  /** How many songs it holds. */
  songCount?: number
  /** Its length, in seconds. */
  durationS?: number
}

/** A member of the server: an id and the name they show. */
export interface User {
  /** The member's id. */
  id: string
  /** The member's display name. */
  name: string
}

/** What a library search found. */
export interface LibrarySearchResults {
  /** The songs found. */
  songs: Song[]
  /** The albums found. */
  albums: Album[]
  /** The artists found. */
  artists: Artist[]
}

/** A kind of thing the library holds. */
export type LibraryType = 'song' | 'album' | 'artist' | 'playlist'

/** Reading the library. Server entry; permission `library.read`. */
export interface Library {
  /** The song with this id, or null when the library has none.
   * @param id - The song's library id.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onLibraryChange(async (change) => {
   *   for (const id of change.added) {
   *     const song = await songstress.library.getSong(id)
   *     if (song) console.log(`new: ${song.artist} - ${song.title}`)
   *   }
   * })
   * ```
   */
  getSong(id: string): Promise<Song | null>
  /** The album with this id, or null when the library has none.
   * @param id - The album's library id.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onPlay(async (song) => {
   *   const album = song.albumId ? await songstress.library.getAlbum(song.albumId) : null
   *   if (album) console.log(`${album.name} (${album.year ?? 'year unknown'}), ${album.songCount ?? 0} songs`)
   * })
   * ```
   */
  getAlbum(id: string): Promise<Album | null>
  /** The artist with this id, or null when the library has none.
   * @param id - The artist's library id.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onPlay(async (song) => {
   *   const artist = song.artistId ? await songstress.library.getArtist(song.artistId) : null
   *   if (artist) console.log(`${artist.name}: ${artist.albumCount ?? 0} albums in the library`)
   * })
   * ```
   */
  getArtist(id: string): Promise<Artist | null>
  /** A public playlist by its id; null for one that does not exist or that
   * its owner keeps private.
   * @param id - The playlist's library id.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.ui.panels.register('playlist-note', async (context) => {
   *   const playlist = context.playlist ? await songstress.library.getPlaylist(context.playlist.id) : null
   *   return playlist ? { children: [{ type: 'text', text: playlist.description ?? playlist.name }] } : null
   * })
   * ```
   */
  getPlaylist(id: string): Promise<Playlist | null>
  /** An album's songs, in order.
   * @param albumId - The album's library id.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onPlay(async (song) => {
   *   if (!song.albumId) return
   *   const songs = await songstress.library.getAlbumSongs(song.albumId)
   *   const next = songs[songs.findIndex((one) => one.id === song.id) + 1]
   *   if (next) console.log(`next on the album: ${next.title}`)
   * })
   * ```
   */
  getAlbumSongs(albumId: string): Promise<Song[]>
  /** A public playlist's songs, in order.
   * @param playlistId - The playlist's library id.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * declare const playlistId: string // a public playlist's library id
   *
   * const songs = await songstress.library.getPlaylistSongs(playlistId)
   * const minutes = Math.round(songs.reduce((total, song) => total + (song.durationS ?? 0), 0) / 60)
   * console.log(`${songs.length} songs, ${minutes} minutes`)
   * ```
   */
  getPlaylistSongs(playlistId: string): Promise<Song[]>
  /** Searches songs, albums and artists by text. `limit` is for each kind
   * (20 when left out, 100 at most).
   * @param text - The words to search for.
   * @param options - Which kinds to find (`types`) and how many of each (`limit`).
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * const found = await songstress.library.search('kind of blue', { types: ['song', 'album'], limit: 10 })
   * for (const album of found.albums) console.log(album.name, album.artist)
   * ```
   */
  search(text: string, options?: { types?: Exclude<LibraryType, 'playlist'>[]; limit?: number }): Promise<LibrarySearchResults>
}

/** Reading who the members are. Server entry; permission `users.read`. */
export interface Users {
  /** The member with this id, or null when there is none.
   * @param id - The member's id.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onScrobble(async (song, play) => {
   *   const member = await songstress.users.get(play.userId)
   *   console.log(`${member?.name ?? play.userId} played ${song.title}`)
   * })
   * ```
   */
  get(id: string): Promise<User | null>
  /** Every member of the server.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.jobs.register('weekly-note', async () => {
   *   for (const member of await songstress.users.list()) {
   *     await songstress.ui.notify({ title: 'Your week in music is ready' }, { userId: member.id })
   *   }
   * })
   * ```
   */
  list(): Promise<User[]>
}
