// Generated from schema/extension.v1.json by src/manifest/generate.ts.
// Never edit it: change the schema, then run `pnpm --dir packages/extensions generate`.

/** The songstress.json file at the root of an extension's package: what the extension is, how it is listed, the code it ships, the permissions it asks for and everything it adds to Songstress. */
export interface Manifest {
  /** The address of this schema, so an editor can check the file as you type. */
  $schema?: string
  /** The version of the manifest format. Always 1. */
  manifestVersion: 1
  /** The extension's identity, as publisher.name. It never changes once the extension is installed anywhere. */
  id: ExtensionId
  /** The name people see. */
  name: string
  /** The extension's own version, as a semantic version (1.4.0). A release is tagged with it. */
  version: string
  /** One or two sentences on what the extension does, shown under its name. */
  description: string
  /** The extension API the extension was written for. */
  engines: Engines
  /** The licence of the extension's code, as an SPDX identifier (MIT, Apache-2.0). */
  license?: string
  /** Where the source lives. */
  repository?: HttpsUrl
  /** Where people can support the author. */
  sponsor?: Sponsor
  /** The extension's own page: its site, or its documentation. */
  homepage?: HttpsUrl
  /** Where the extension can be seen at work: a video, or a live demo. */
  demo?: HttpsUrl
  /** Where people ask for help: an issue tracker, a forum, a chat. */
  support?: HttpsUrl
  /** What the extension is and does, at length: the Description of its page in the Marketplace and in the apps, a block of text an item. A listing needs it. */
  about?: Prose[]
  /** What people use the extension for, a line each: the Use cases of its page. */
  useCases?: UseCase[]
  /** How the extension works: what it asks its service, what it keeps, what it changes. The How it works of its page, a block of text an item. */
  howItWorks?: Prose[]
  /** The one category the extension is listed under. */
  categories?: Category[]
  /** Free tags that help people find the extension. */
  keywords?: Keyword[]
  /** The Songstress apps the extension's interface and client code work in. Left out, it means all of them. Code in the server entry reaches every app whatever this says. */
  platforms?: Platform[]
  /** The extension's icon. */
  icon?: Icon
  /** The wide image on the extension's card. */
  banner?: Banner
  /** Captures of the extension at work. The official list asks for three to six. */
  screenshots?: Screenshot[]
  /** The extension's code: one JavaScript bundle for each side it runs on. */
  entry?: Entry
  /** The hooks the extension's code listens to. Songstress starts the code when one of them fires. */
  hooks?: Hooks
  /** What the extension asks to be allowed to do. Nothing is allowed unless it is asked for here and then granted by a person. */
  permissions?: Permissions
  /** What the extension adds to Songstress. */
  contributes?: Contributes
}

/** publisher.name, each part in lowercase letters, digits and single hyphens. */
export type ExtensionId = string

/** A name unique among its kind inside one extension: lowercase letters, digits and single hyphens, starting with a letter. */
export type LocalId = string

/** A setting's name as code reads it: letters and digits, starting with a lowercase letter. */
export type SettingKey = string

/** A name from Songstress's icon set. A name an app does not know is drawn as the extension mark. */
export type IconName = string

/** A short label, on one line. */
export type Title = string

/** A sentence or two, on one line. */
export type Sentence = string

/** A condition on what the app knows (SPEC.md section 10): keys such as platform, admin, signedIn, playing, favorite and setting.<key>, joined with !, &&, || and parentheses, and compared with == and != to 'text', true, false or a number. The item shows only while it holds. */
export type When = string

/** The heading a setting is drawn under, with the others that name it. */
export type SettingSection = string

/** One block of a page's text, on one line: a paragraph, a heading (it starts with `## ` or `### `) or a list item (it starts with `- `). Inside it, `**bold**`, `*emphasis*`, a span in backticks and `[a link](https://example.com)` are read as Markdown; anything else, HTML and images among it, is shown as the text it is. */
export type Prose = string

/** One use, in a line, read as a block of prose is: a span in backticks is shown as code. */
export type UseCase = string

/** An https address. */
export type HttpsUrl = string

/** Where people can support the extension's author. */
export interface Sponsor {
  /** The page where people can support the author. */
  url: HttpsUrl
}

/** The extension API versions the extension runs on. */
export interface Engines {
  /** The versions of the extension API the extension runs on, as a range: ^1.2.0, ~1.2.0, >=1.2.0, >=1.2.0 <2.0.0 or one exact version. Never *. */
  songstress: string
}

/** A category of the official list. */
export type Category = "sources" | "lyrics" | "metadata-artwork" | "scrobbling-stats" | "discovery" | "playback-audio" | "visualisers" | "themes" | "social-jam" | "library-tools" | "integrations" | "server-worker"

/** A tag: lowercase letters and digits, with single dots or hyphens between them. */
export type Keyword = string

/** A Songstress app: the web app, the desktop app, the iPhone and iPad app, the Android app. */
export type Platform = "web" | "desktop" | "ios" | "android"

/** Where code runs: in the server entry or in the client entry. */
export type Side = "server" | "client"

/** A square PNG of 512 by 512 pixels. */
export interface Icon {
  /** The PNG file, from the package root. */
  path: string
  /** The image's width in pixels: 512. */
  width: 512
  /** The image's height in pixels: 512. */
  height: 512
}

/** A 16:9 image, from 1280 by 720 up to 3840 by 2160 pixels. */
export interface Banner {
  /** The PNG, JPEG or WebP file, from the package root. */
  path: string
  /** The image's width in pixels. */
  width: number
  /** The image's height in pixels. */
  height: number
}

/** One capture, with the size it really has. */
export interface Screenshot {
  /** The PNG, JPEG or WebP file, from the package root. */
  path: string
  /** The image's width in pixels. */
  width: number
  /** The image's height in pixels. */
  height: number
  /** What the capture shows, also read aloud by screen readers. */
  caption?: string
  /** The app the capture was taken in. */
  platform?: Platform
}

/** The extension's code: the bundle that runs on the server, the one that runs in the apps, or both. */
export interface Entry {
  /** The bundle that runs on the user's server, in a sandbox. It hears every app's plays and does the work that must go on while no app is open. */
  server?: ScriptPath
  /** The bundle that runs inside an app while it is open, in a sandbox. It follows this device's player live. An app may not run client code at all: what must work everywhere belongs in the server entry. */
  client?: ScriptPath
}

/** One JavaScript file, from the package root. */
export type ScriptPath = string

/** The events the extension's code listens to, by side. */
export interface Hooks {
  /** Hooks the server entry listens to. */
  server?: ServerHook[]
  /** Hooks the client entry listens to. */
  client?: ClientHook[]
}

/** A hook of the server entry. */
export type ServerHook = "onPlay" | "onScrobble" | "onFavorite" | "onPlaylistChange" | "onLibraryChange" | "onScanComplete"

/** A hook of the client entry. */
export type ClientHook = "onPlay" | "onPause" | "onTrackChange" | "onSeek" | "onVolumeChange" | "onQueueChange" | "onProgress"

/** Why the extension needs this, in words the person granting it will read. */
export type Reason = string

/** A permission with nothing more to name than why it is asked for. */
export interface Permission {
  /** Why the extension needs this, in words the person granting it will read. */
  reason: Reason
}

/** Reaching public hosts: why, and which hosts. */
export interface NetworkPermission {
  /** Why the extension needs this, in words the person granting it will read. */
  reason: Reason
  /** The public hosts the extension may reach, over http or https. */
  hosts: HostPattern[]
}

/** A public host by name (api.example.com), or every host under a domain (*.example.com), with an optional port. Never an address, a scheme or a path. */
export type HostPattern = string

/** Reaching the user's own network: why, and which targets. */
export interface LocalNetworkPermission {
  /** Why the extension needs this, in words the person granting it will read. */
  reason: Reason
  /** The targets on the user's own network the extension asks for. Left out, the admin names them when granting. */
  targets?: LocalTarget[]
}

/** A target on the user's own network: an IPv4 address (192.168.1.20), a block of them (192.168.1.0/24) or a host name (nas.local), the address and the name with an optional port. */
export type LocalTarget = string

/** What the extension may do, each with the reason it gives. */
export interface Permissions {
  /** Reach the named public hosts. */
  network?: NetworkPermission
  /** Reach targets on the user's own network. */
  "network.local"?: LocalNetworkPermission
  /** Read the catalogue and hear when it changes. */
  "library.read"?: Permission
  /** Read members' ids and display names. */
  "users.read"?: Permission
  /** Read a member's plays, what they are playing now and what they like. Each member grants it for themselves. */
  "listening.read"?: Permission
  /** Start, pause, skip and seek the player of the device the code runs on, and add to its queue. */
  "player.control"?: Permission
  /** Answer beside Songstress's own sources. */
  providers?: Permission
  /** Serve its own signed-in routes. */
  routes?: Permission
  /** Run scheduled and background work. */
  jobs?: Permission
  /** Keep its own data, under a quota. */
  storage?: Permission
  /** Keep its own credentials, sealed. */
  secrets?: Permission
}

/** What the extension adds to Songstress: commands, menus, settings, pages, panels, status items, views, themes, providers, jobs, routes and a sign-in. */
export interface Contributes {
  /** Named actions the extension's code carries out. */
  commands?: Command[]
  /** Where the extension's commands appear in the apps. */
  menus?: Menus
  /** The settings Songstress draws and keeps for the extension, in the order they are shown. */
  settings?: Setting[]
  /** Pages the apps draw from a tree of Songstress's own components. */
  pages?: Page[]
  /** Sections drawn inside Songstress's own screens. */
  panels?: Panel[]
  /** Status items in the player: an icon and a few words each, the extension's state at a glance. */
  status?: StatusItem[]
  /** Free-form pages: the extension's own HTML, opened in the browser apart from the app, with no API. An app may not open them at all. */
  views?: View[]
  /** The themes the extension adds to the picker: each a dark look, a light one, or both. */
  themes?: Theme[]
  /** Sources the extension adds beside Songstress's own, by kind. */
  providers?: SourcesByKind
  /** Scheduled and background work, shown in Activity. */
  jobs?: Job[]
  /** Signed-in JSON routes under the extension's own prefix. */
  routes?: Route[]
  /** A sign-in to the service the extension reaches, which a person starts and ends in Songstress. */
  signIn?: SignIn
}

/** A named action the extension's code carries out, run from a menu, a button or another command. */
export interface Command {
  /** The command's name. Code registers its handler under it. */
  id: LocalId
  /** The label on the menu item or button that runs it. */
  title: Title
  /** The entry that holds the command's handler. */
  run: Side
  /** What the command does. */
  description?: Sentence
  /** The icon beside the title. */
  icon?: IconName
}

/** Where the extension's commands appear, by menu. */
export interface Menus {
  /** A song's menu. The command receives the song. */
  "song/context"?: MenuItems
  /** An album's menu. The command receives the album. */
  "album/context"?: MenuItems
  /** An artist's menu. The command receives the artist. */
  "artist/context"?: MenuItems
  /** A playlist's menu. The command receives the playlist. */
  "playlist/context"?: MenuItems
  /** The menu of a song waiting in the queue. The command receives the song. */
  "queue/item"?: MenuItems
  /** The player's own menu. The command receives the song that is playing. */
  "player/actions"?: MenuItems
  /** The sidebar of the web and desktop apps. */
  sidebar?: MenuItems
  /** Buttons on the extension's own settings page. */
  "settings/actions"?: MenuItems
}

/** The items an extension adds to one menu. */
export type MenuItems = MenuItem[]

/** One menu item: a command, and when it shows. */
export interface MenuItem {
  /** The id of one of the extension's commands. */
  command: LocalId
  /** The item shows only while this holds. */
  when?: When
}

/** Who a setting belongs to: the whole server (the admin sets it), each member, or each device. */
export type SettingScope = "server" | "user" | "device"

/** One setting. Its type decides the control Songstress draws and what else it may say. */
export type Setting = StringSetting | SecretSetting | NumberSetting | BooleanSetting | SelectSetting

/** A line of text. */
export interface StringSetting {
  /** The name code reads the setting by. */
  key: SettingKey
  /** A line of text. */
  type: "string"
  /** The setting's label. */
  title: Title
  /** A line of help under the label. */
  description?: Sentence
  /** The heading the setting is drawn under, with the other settings that name it. */
  section?: SettingSection
  /** Whose setting it is: the server's, each member's or each device's. */
  scope: SettingScope
  /** Songstress asks for it, and does not start the extension for whoever lacks it: anyone, a member or a device, by its scope. */
  required?: boolean
  /** The value until someone sets one. */
  default?: string
  /** The hint shown while the field is empty. */
  placeholder?: Title
  /** The longest value accepted, in characters. */
  maxLength?: number
}

/** A password, key or token. Songstress seals it, never shows it again and never sends it to an app. A device cannot keep one. */
export interface SecretSetting {
  /** The name code reads the setting by. */
  key: SettingKey
  /** A password field: Songstress seals what is typed and never shows it again. */
  type: "secret"
  /** The setting's label. */
  title: Title
  /** A line of help under the label. */
  description?: Sentence
  /** The heading the setting is drawn under, with the other settings that name it. */
  section?: SettingSection
  /** Who the secret belongs to: the whole server or each member. */
  scope: "server" | "user"
  /** Songstress asks for it, and does not start the extension for whoever lacks it: anyone, a member or a device, by its scope. */
  required?: boolean
  /** The hint shown while the field is empty. */
  placeholder?: Title
}

/** A number. */
export interface NumberSetting {
  /** The name code reads the setting by. */
  key: SettingKey
  /** A number. */
  type: "number"
  /** The setting's label. */
  title: Title
  /** A line of help under the label. */
  description?: Sentence
  /** The heading the setting is drawn under, with the other settings that name it. */
  section?: SettingSection
  /** Whose setting it is: the server's, each member's or each device's. */
  scope: SettingScope
  /** Songstress asks for it, and does not start the extension for whoever lacks it: anyone, a member or a device, by its scope. */
  required?: boolean
  /** The value until someone sets one. */
  default?: number
  /** The smallest value accepted. */
  minimum?: number
  /** The largest value accepted. */
  maximum?: number
  /** The distance between two values the control offers. */
  step?: number
}

/** A switch. */
export interface BooleanSetting {
  /** The name code reads the setting by. */
  key: SettingKey
  /** A switch. */
  type: "boolean"
  /** The setting's label. */
  title: Title
  /** A line of help under the label. */
  description?: Sentence
  /** The heading the setting is drawn under, with the other settings that name it. */
  section?: SettingSection
  /** Whose setting it is: the server's, each member's or each device's. */
  scope: SettingScope
  /** The value until someone sets one. */
  default?: boolean
}

/** One choice from a list. */
export interface SelectSetting {
  /** The name code reads the setting by. */
  key: SettingKey
  /** One choice from a list of options. */
  type: "select"
  /** The setting's label. */
  title: Title
  /** A line of help under the label. */
  description?: Sentence
  /** The heading the setting is drawn under, with the other settings that name it. */
  section?: SettingSection
  /** Whose setting it is: the server's, each member's or each device's. */
  scope: SettingScope
  /** Songstress asks for it, and does not start the extension for whoever lacks it: anyone, a member or a device, by its scope. */
  required?: boolean
  /** The value of the option chosen until someone picks one. */
  default?: string
  /** The choices, in the order they are shown. */
  options: SettingOption[]
}

/** One choice of a select setting. */
export interface SettingOption {
  /** What code reads when this option is chosen. */
  value: string
  /** The option's label. */
  title: Title
}

/** A page the apps draw from a tree of Songstress's own blocks, built by the extension's code. */
export interface Page {
  /** The page's name. Code registers its renderer under it, and it is the page's address. */
  id: LocalId
  /** The page's heading. */
  title: Title
  /** The entry that builds the page's tree. A page built in the server entry shows in every app. */
  render: Side
  /** The icon of the page's sidebar entry. */
  icon?: IconName
  /** Give the page an entry in the apps' own navigation: the sidebar of the web and desktop apps, the Library tab of the phones. */
  sidebar?: boolean
  /** The page's entry in the apps' navigation shows only while this holds. */
  when?: When
}

/** The Songstress screen a panel is drawn in: the player's now-playing view, Home, an artist's page, an album's page or a playlist's page. */
export type PanelLocation = "now-playing" | "home" | "artist" | "album" | "playlist"

/** A section the extension's code builds inside one of Songstress's own screens. */
export interface Panel {
  /** The panel's name. Code registers its renderer under it. */
  id: LocalId
  /** The panel's heading. */
  title: Title
  /** Which of Songstress's screens the panel is drawn in. */
  location: PanelLocation
  /** The entry that builds the panel's tree. */
  render: Side
  /** The panel is drawn only while this holds. */
  when?: When
}

/** An item in the player: an icon and a few words the extension's code keeps current. */
export interface StatusItem {
  /** The status item's name. Code registers its renderer under it. */
  id: LocalId
  /** What the item is, for people who do not see it, and where the player lists it. */
  title: Title
  /** The entry that says what the item shows, for the song playing. */
  render: Side
  /** The icon shown until the renderer answers. */
  icon?: IconName
  /** The item is drawn only while this holds. */
  when?: When
}

/** A free-form page: the extension's own HTML, opened in a sandboxed frame. */
export interface View {
  /** The view's name, and its address. */
  id: LocalId
  /** The view's heading. */
  title: Title
  /** The HTML file the browser opens, from the package root. */
  path: string
  /** The icon of the view's sidebar entry. */
  icon?: IconName
  /** Give the view an entry in the sidebar of the web and desktop apps. */
  sidebar?: boolean
}

/** One theme the picker lists: a dark look, a light one, or both, written here or in a theme file. */
export interface Theme {
  /** The theme's name inside the extension. */
  id: LocalId
  /** The theme's name, as the picker shows it. */
  label: Title
  /** The looks the theme has: a dark one, a light one, or both. They are written here or in its file, never both. */
  appearance: "dark" | "light" | "both"
  /** The theme's dark look, written here. */
  dark?: ThemeLook
  /** The theme's light look, written here. */
  light?: ThemeLook
  /** A theme file holding the theme's looks instead, from the package root. */
  path?: string
}

/** A theme file, which a theme names by its path: its looks, as the manifest would write them (schema/theme.v1.json). */
export interface ThemeFile {
  /** The address of the theme file's schema, so an editor can check the file as you type. */
  $schema?: string
  /** The theme's dark look. */
  dark?: ThemeLook
  /** The theme's light look. */
  light?: ThemeLook
}

/** A theme's look, dark or light: its colours, a seed for what they leave out, and the glow behind the stage. */
export interface ThemeLook {
  /** One colour the look grows from where it names no other: the accent, with the stage and the text tinted by its hue. */
  seed?: ThemeColor
  /** The look's colour tokens. What it leaves out, an app fills in. */
  colors?: ThemeColors
  /** Up to three colours for the ambient light behind the stage of the web and desktop apps. */
  glow?: ThemeColor[]
}

/** Colour tokens by name (SPEC.md, section 12). What a look leaves out, an app fills in. */
export interface ThemeColors {
  /** The stage behind every screen: lists, a tab's root, the window. */
  background?: ThemeColor
  /** Grouped rows, cards and sheets on the stage, and Android's tab bar. */
  surface?: ThemeColor
  /** What sits on a surface: menus, popovers, the disc of a pull to refresh. */
  "surface.raised"?: ThemeColor
  /** The wash under a pressed or hovered row, and behind secondary controls. It may be translucent. */
  "surface.hover"?: ThemeColor
  /** The sidebar of the web and desktop apps. */
  sidebar?: ThemeColor
  /** Hairlines between rows and around cards and fields. It may be translucent. */
  border?: ThemeColor
  /** Words: titles, rows, body copy. */
  text?: ThemeColor
  /** The second voice: an artist under a title, a caption. */
  "text.muted"?: ThemeColor
  /** Placeholders, chevrons, and captions that repeat what is beside them. */
  "text.faint"?: ThemeColor
  /** The theme's colour in Songstress Red's place: icons, active states, progress, links, the tab bar's tint. */
  accent?: ThemeColor
  /** A filled accent that carries a label: Play, a primary button, a selected segment, a badge. */
  "accent.fill"?: ThemeColor
  /** A filled accent under a press or the pointer, and the far end of Play's sweep. */
  "accent.fill.pressed"?: ThemeColor
  /** The label on a filled accent, at rest and pressed. */
  "accent.onFill"?: ThemeColor
  /** Lossless audio, done, connected. */
  success?: ThemeColor
  /** Lossy audio, something to look at. */
  warning?: ThemeColor
  /** Delete, Sign Out, errors, a menu's destructive items. */
  danger?: ThemeColor
  /** Work in progress: running, importing. */
  info?: ThemeColor
}

/** A colour: #RGB, #RGBA, #RRGGBB or #RRGGBBAA, or rgb(), rgba(), hsl() or hsla() as CSS writes them, the name in lower case (SPEC.md, section 12, "Colours"). Only border and surface.hover may be translucent. */
export type ThemeColor = string

/** A kind of thing a source lists. */
export type CatalogType = "track" | "album" | "artist" | "playlist"

/** One of Songstress's own catalogues. A source that reads the same catalogue joins its group and speaks its ids. */
export type ProviderGroup = "musicbrainz" | "spotify" | "deezer" | "tidal" | "itunes" | "ytmusic"

/** The extension's sources, by what they answer. Each kind is a provider contract the code registers. */
export interface SourcesByKind {
  /** Sources that answer a search. */
  search?: SearchSource[]
  /** Sources that open one track, album, artist or playlist by its id. */
  lookup?: LookupSource[]
  /** Sources that read a pasted link. */
  links?: LinkSource[]
  /** Sources of lyrics. */
  lyrics?: Source[]
  /** Sources of facts about artists, releases and tracks. */
  metadata?: MetadataSource[]
  /** Sources of artist photos and album covers. */
  artwork?: ArtworkSource[]
  /** Sources of words about an artist: who they are, and the artists like them. */
  artistInfo?: ArtistInfoSource[]
  /** Services that plays are reported to. */
  scrobble?: Source[]
  /** Sources of recommendations. */
  recommend?: RecommendSource[]
  /** Sources that can play what their own search found. Switched off until the admin turns each on. */
  play?: Source[]
  /** Sources songs can be acquired from. Switched off until the admin turns each on. */
  download?: DownloadSource[]
}

/** A source that answers beside Songstress's own. */
export interface Source {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
}

/** A source that answers a search. */
export interface SearchSource {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
  /** The catalogue of Songstress's own whose results this source's are merged with. Left out, the source is a group of its own. */
  group?: ProviderGroup
  /** What a search can find. */
  types: CatalogType[]
}

/** A source that opens one track, album, artist or playlist by its id. */
export interface LookupSource {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
  /** The catalogue of Songstress's own whose ids this source speaks. Left out, the source is a group of its own. */
  group?: ProviderGroup
  /** What it can open by id. */
  types: CatalogType[]
}

/** A source that reads a pasted link. */
export interface LinkSource {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
  /** The catalogue of Songstress's own whose links this source reads. Left out, the source is a group of its own. */
  group?: ProviderGroup
  /** The links it reads. The longest pattern that fits a link wins. */
  patterns: LinkPattern[]
}

/** A host with an optional path that a link must begin with (soundcloud.com, example.com/album/), or an app link's scheme (spotify:). A host also takes links to the hosts under it. */
export type LinkPattern = string

/** A source of facts about artists, releases and tracks. */
export interface MetadataSource {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
  /** The catalogue of Songstress's own whose artist ids this source speaks. Left out, the source is a group of its own. */
  group?: ProviderGroup
  /** What it answers: an artist's discography (their releases, their most played songs, a release's tracks), or the missing facts of one track. */
  supports: ("discography" | "enrich")[]
}

/** A source of artist photos and album covers. */
export interface ArtworkSource {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
  /** The pictures it can find. */
  supports: ("artist-photo" | "album-cover")[]
}

/** A source of words about an artist. */
export interface ArtistInfoSource {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
  /** What it can say about an artist: who they are, in words, or the artists like them. */
  supports: ("biography" | "similar")[]
}

/** A source of recommendations. */
export interface RecommendSource {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
  /** What it recommends from: one song, one artist, or a list of songs. */
  modes: ("track" | "artist" | "context")[]
}

/** A source the library can fetch audio from, at the qualities it offers. */
export interface DownloadSource {
  /** The source's name inside the extension. Code registers the provider under it; the same id under several kinds is one source. */
  id: LocalId
  /** The source's name as people read it. Left out, it is the extension's name. */
  name?: Title
  /** The qualities it offers, best first. The admin picks one. */
  qualities: Quality[]
}

/** One quality a download source offers. */
export interface Quality {
  /** The quality's name, as code receives it. */
  id: LocalId
  /** The quality as people read it (AAC 256 kbps). */
  title: Title
  /** The audio is lossless. */
  lossless?: boolean
}

/** Work the server runs in the background, on a schedule or when code asks, shown in Activity. */
export interface Job {
  /** The job's name. Code registers its handler under it. */
  id: LocalId
  /** The job as Activity shows it. */
  title: Title
  /** How often the job runs by itself: a number and m, h or d (15m, 6h, 1d). Left out, the job runs only when code starts it. */
  every?: string
}

/** An HTTP route under the extension's own prefix on the server. */
export interface Route {
  /** The route's name. Code registers its handler under it. */
  id: LocalId
  /** The HTTP method. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** The path under the extension's own prefix: segments of lowercase letters, digits, dots, hyphens and underscores, or :name for a part the handler reads (/charts/:period). */
  path: string
}

/** An account at a service the extension signs in to, for the server or for each member. */
export interface SignIn {
  /** Whose account it is. "server": one account for the whole server, which its admin signs in. "user": each member's own, which they sign in themselves. */
  scope: "server" | "user"
  /** The service as the sign-in names it (Tunelog). Left out, the extension's name. */
  title?: Title
}
