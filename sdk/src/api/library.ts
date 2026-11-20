// The library as an extension sees it: plain facts about songs, albums,
// artists and playlists. Nothing of one member's own (their likes, their play
// counts) and nothing of the server's disk (file paths) is in these shapes.
// Lengths are in seconds everywhere in the API.

/** A song of the library. */
export interface Song {
  id: string
  title: string
  /** The artist as the song's tags credit them. */
  artist: string
  artistId?: string
  album?: string
  albumId?: string
  durationS?: number
  track?: number
  disc?: number
  year?: number
  genre?: string
  /** The recording's ISRC, when its tags carry one. */
  isrc?: string
  /** The recording's MusicBrainz id, when its tags carry one. */
  musicBrainzId?: string
}

/** An album of the library. */
export interface Album {
  id: string
  name: string
  artist: string
  artistId?: string
  year?: number
  genre?: string
  songCount?: number
  durationS?: number
  /** The release group's MusicBrainz id, when the tags carry one. */
  musicBrainzId?: string
}

/** An artist of the library. */
export interface Artist {
  id: string
  name: string
  albumCount?: number
  musicBrainzId?: string
}

/** A playlist. */
export interface Playlist {
  id: string
  name: string
  description?: string
  /** The member it belongs to. */
  ownerId?: string
  /** Every member can see it. */
  public?: boolean
  songCount?: number
  durationS?: number
}

/** A member of the server: an id and the name they show. */
export interface User {
  id: string
  name: string
}

/** What a library search found. */
export interface LibrarySearchResults {
  songs: Song[]
  albums: Album[]
  artists: Artist[]
}

/** A kind of thing the library holds. */
export type LibraryType = 'song' | 'album' | 'artist' | 'playlist'

/** Reading the library. Server entry; permission `library.read`. */
export interface Library {
  /** The song with this id, or null when the library has none. */
  getSong(id: string): Promise<Song | null>
  getAlbum(id: string): Promise<Album | null>
  getArtist(id: string): Promise<Artist | null>
  /** A public playlist by its id; null for one that does not exist or that
   * its owner keeps private. */
  getPlaylist(id: string): Promise<Playlist | null>
  /** An album's songs, in order. */
  getAlbumSongs(albumId: string): Promise<Song[]>
  /** A public playlist's songs, in order. */
  getPlaylistSongs(playlistId: string): Promise<Song[]>
  /** Searches songs, albums and artists by text. `limit` is for each kind
   * (20 when left out, 100 at most). */
  search(text: string, options?: { types?: Exclude<LibraryType, 'playlist'>[]; limit?: number }): Promise<LibrarySearchResults>
}

/** Reading who the members are. Server entry; permission `users.read`. */
export interface Users {
  get(id: string): Promise<User | null>
  list(): Promise<User[]>
}
