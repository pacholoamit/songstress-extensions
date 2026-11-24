// Declared interface: what an extension draws, said as data. A page, a
// panel or a status item is a tree of the components below; each app draws
// the tree with its own controls, in its own design, so one page works on
// the web, on the desktop and on a phone.
//
// A tree is JSON and nothing else: no function, no script, no markup, no
// style. Colour is said by meaning (`tone`), size by a few named steps. An
// extension draws inside the places given to it, never over Songstress's own.
// What happens on a tap is an action (the end of this file), also data: some
// actions ask the person something (a pick, a line of text, a yes) and hand
// the answer to a command.
//
// The apps cap a tree's size, depth and number of rows, and how often it may
// be redrawn; a tree over a cap is not drawn.

import type { IconName } from '../manifest/types.generated'
import type { Awaitable, Disposable } from './common'
import type { ForUser } from './data'
import type { ClientInfo } from './host'
import type { Album, Artist, LibraryType, Playlist, Song } from './library'

/** Colour by what it means; the theme decides what it looks like. */
export type Tone = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

/** A step of space. */
export type Size = 'small' | 'medium' | 'large'

/** A picture: the cover of something in the library, or an image on the web,
 * which the app fetches through the server and never from the device. */
export type ImageSource = { cover: LibraryType; id: string } | { url: string }

// ── Songstress's own rows and cards, by library id ───────────────────────────
// They are drawn exactly as Songstress draws them elsewhere, with their own
// menus and their own behaviour on a tap.

/** A song of the library, drawn as Songstress draws it, with its own menu. */
export interface SongRow {
  /** Always `"song"`: which kind this is. */
  type: 'song'
  /** The song's library id. */
  songId: string
}

/** An album of the library, drawn as Songstress draws it, with its own menu. */
export interface AlbumCard {
  /** Always `"album"`: which kind this is. */
  type: 'album'
  /** The album's library id. */
  albumId: string
}

/** An artist of the library, drawn as Songstress draws them, with their own menu. */
export interface ArtistCard {
  /** Always `"artist"`: which kind this is. */
  type: 'artist'
  /** The artist's library id. */
  artistId: string
}

/** A playlist of the library, drawn as Songstress draws it. */
export interface PlaylistCard {
  /** Always `"playlist"`: which kind this is. */
  type: 'playlist'
  /** The playlist's library id. */
  playlistId: string
}

// ── rows and cards of the extension's own ────────────────────────────────────

/** One entry of a menu. */
export interface MenuEntry {
  /** Its label. */
  title: string
  /** An icon from Songstress's icon set. */
  icon?: IconName
  /** What it does. */
  action: Action
  /** It deletes or cannot be undone: drawn as such. */
  destructive?: boolean
}

/** A row of a list. */
export interface Row {
  /** Always `"row"`: which kind this is. */
  type: 'row'
  /** Unique among the rows of its list. */
  id: string
  /** Its title. */
  title: string
  /** A line under the title. */
  subtitle?: string
  /** An icon from Songstress's icon set. */
  icon?: IconName
  /** A picture beside it. */
  image?: ImageSource
  /** A short word at the row's end. */
  badge?: BadgeBlock
  /** What choosing it does. */
  action?: Action
  /** More to do with the row. */
  menu?: MenuEntry[]
}

/** A card of a grid or a shelf. */
export interface Card {
  /** Always `"card"`: which kind this is. */
  type: 'card'
  /** Unique among the cards beside it. */
  id: string
  /** Its title. */
  title: string
  /** A line under the title. */
  subtitle?: string
  /** Its picture. */
  image?: ImageSource
  /** What choosing it does. */
  action?: Action
  /** Its menu. */
  menu?: MenuEntry[]
}

// ── blocks: what a detail page, a section or a panel is built from ───────────

/** Blocks beside or under one another. */
export interface StackBlock {
  /** Always `"stack"`: which kind this is. */
  type: 'stack'
  /** Left out, "vertical". */
  direction?: 'vertical' | 'horizontal'
  /** Room between its children. */
  gap?: Size
  /** How its children line up across it. */
  align?: 'start' | 'center' | 'end'
  /** What it holds, in order. */
  children: Block[]
}

/** Blocks under a heading. */
export interface SectionBlock {
  /** Always `"section"`: which kind this is. */
  type: 'section'
  /** The section's heading. */
  title?: string
  /** A line of help under the section. */
  footer?: string
  /** What it holds. */
  children: Block[]
}

/** Words, in one of four styles. */
export interface TextBlock {
  /** Always `"text"`: which kind this is. */
  type: 'text'
  /** The words. */
  text: string
  /** Left out, "body". */
  style?: 'title' | 'heading' | 'body' | 'caption'
  /** Their colour, by meaning. */
  tone?: Tone
}

/** An icon from Songstress's icon set. */
export interface IconBlock {
  /** Always `"icon"`: which kind this is. */
  type: 'icon'
  /** The icon's name, from Songstress's icon set. */
  name: IconName
  /** Its colour, by meaning. */
  tone?: Tone
}

/** A picture: a cover from the library, or an address the app fetches through the server. */
export interface ImageBlock {
  /** Always `"image"`: which kind this is. */
  type: 'image'
  /** Where the picture comes from. */
  source: ImageSource
  /** What the image shows, for people who do not see it. */
  description: string
  /** Its shape: square, wide or a circle. */
  shape?: 'square' | 'wide' | 'circle'
}

/** A short word in a pill. */
export interface BadgeBlock {
  /** Always `"badge"`: which kind this is. */
  type: 'badge'
  /** A word or two. */
  text: string
  /** Its colour, by meaning. */
  tone?: Tone
}

/** A bar that shows how far something has got. */
export interface ProgressBlock {
  /** Always `"progress"`: which kind this is. */
  type: 'progress'
  /** From 0 to 1. Left out, the bar shows that something is going on without
   * saying how far it is. */
  value?: number
  /** What it measures. */
  label?: string
}

/** A notice across the page. */
export interface BannerBlock {
  /** Always `"banner"`: which kind this is. */
  type: 'banner'
  /** Its colour, by meaning. */
  tone: 'info' | 'success' | 'warning' | 'danger'
  /** What the banner says. */
  title: string
  /** A sentence more. */
  text?: string
  /** One thing to do about it. */
  button?: { title: string; action: Action }
}

/** A line between blocks. */
export interface DividerBlock {
  /** Always `"divider"`: which kind this is. */
  type: 'divider'
}

/** Room between blocks. */
export interface SpacerBlock {
  /** Always `"spacer"`: which kind this is. */
  type: 'spacer'
  /** How much room. */
  size?: Size
}

/** Blocks a tap opens and closes. */
export interface CollapsibleBlock {
  /** Always `"collapsible"`: which kind this is. */
  type: 'collapsible'
  /** What shows while it is closed. */
  title: string
  /** Open at first. */
  open?: boolean
  /** What it holds, shown open. */
  children: Block[]
}

/** A button that does an action. */
export interface ButtonBlock {
  /** Always `"button"`: which kind this is. */
  type: 'button'
  /** The button's label. */
  title: string
  /** What choosing it does. */
  action: Action
  /** An icon from Songstress's icon set. */
  icon?: IconName
  /** Left out, "secondary". A page has at most one primary button. */
  style?: 'primary' | 'secondary' | 'destructive'
  /** Shown, but it cannot be chosen. */
  disabled?: boolean
}

/** A button that opens a menu. */
export interface MenuBlock {
  /** Always `"menu"`: which kind this is. */
  type: 'menu'
  /** The menu button's label. */
  title: string
  /** The menu button's icon. */
  icon?: IconName
  /** What the menu offers. */
  items: MenuEntry[]
}

/** A row of cards that scrolls sideways, under a heading. */
export interface ShelfBlock {
  /** Always `"shelf"`: which kind this is. */
  type: 'shelf'
  /** The shelf's heading. */
  title: string
  /** What it holds, side by side. */
  items: (Card | SongRow | AlbumCard | ArtistCard | PlaylistCard)[]
}

/** What a detail screen, a section and a panel are built from. */
export type Block =
  | StackBlock
  | SectionBlock
  | TextBlock
  | IconBlock
  | ImageBlock
  | BadgeBlock
  | ProgressBlock
  | BannerBlock
  | DividerBlock
  | SpacerBlock
  | CollapsibleBlock
  | ButtonBlock
  | MenuBlock
  | ShelfBlock
  | SongRow
  | AlbumCard
  | ArtistCard
  | PlaylistCard

// ── form fields ──────────────────────────────────────────────────────────────
// A field's `name` is the key its value is handed over under. The app keeps
// what is typed until the form is submitted. There is no password field: a
// secret is asked for on the extension's settings page, never in a page.

interface FieldBase {
  /** Unique in the form. */
  name: string
  /** The field's label. */
  label: string
  /** A line of help under the field. */
  help?: string
}

/** A form's text field. */
export interface TextField extends FieldBase {
  /** Always `"text-field"`: which kind this is. */
  type: 'text-field'
  /** What it holds at first. */
  value?: string
  /** The hint while it is empty. */
  placeholder?: string
  /** Several lines. */
  multiline?: boolean
  /** The most characters it takes. */
  maxLength?: number
  /** It may not be sent empty. */
  required?: boolean
}

/** A form's switch: on or off. */
export interface SwitchField extends FieldBase {
  /** Always `"switch"`: which kind this is. */
  type: 'switch'
  /** Whether it is on at first. */
  value?: boolean
}

/** A form's checkbox: true or false. */
export interface CheckboxField extends FieldBase {
  /** Always `"checkbox"`: which kind this is. */
  type: 'checkbox'
  /** Whether it is ticked at first. */
  value?: boolean
}

/** A form's slider over a range of numbers. */
export interface SliderField extends FieldBase {
  /** Always `"slider"`: which kind this is. */
  type: 'slider'
  /** Where it stands at first. */
  value?: number
  /** Its lowest value. */
  minimum: number
  /** Its highest value. */
  maximum: number
  /** How far one move goes. */
  step?: number
}

/** A form's choice of one option from a list. */
export interface PickerField extends FieldBase {
  /** Always `"picker"`: which kind this is. */
  type: 'picker'
  /** The `value` of the option chosen. */
  value?: string
  /** The choices. */
  options: { value: string; title: string }[]
}

/** A form's date picker. */
export interface DateField extends FieldBase {
  /** Always `"date-picker"`: which kind this is. */
  type: 'date-picker'
  /** A day, as YYYY-MM-DD. */
  value?: string
  /** The earliest date it takes. */
  minimum?: string
  /** The latest date it takes. */
  maximum?: string
}

/** One field of a form: what a `form` screen's sections hold. */
export type Field = TextField | SwitchField | CheckboxField | SliderField | PickerField | DateField

/** What a form's fields hold when it is submitted, by field name. */
export type FormValues = Record<string, string | number | boolean>

// ── screens: what a whole page is ────────────────────────────────────────────

/** What a list or a grid shows when it has nothing to show. */
export interface EmptyState {
  /** What it says when there is nothing. */
  title: string
  /** A sentence more. */
  text?: string
  /** An icon from Songstress's icon set. */
  icon?: IconName
  /** A button that does something about it. */
  button?: { title: string; action: Action }
}

/** A page of rows. */
export interface ListScreen {
  /** Always `"list"`: which kind this is. */
  type: 'list'
  /** Its sections of rows. */
  sections: { title?: string; items: (Row | SongRow)[] }[]
  /** A search field over the list. The page is rendered again as the person
   * types, with what they typed in `RenderContext.search`. */
  search?: { placeholder?: string }
  /** What it shows when it holds nothing. */
  empty?: EmptyState
  /** There are more rows: when the end is reached the page is rendered again
   * with this in `RenderContext.cursor`, and its rows are added below. */
  nextCursor?: string
}

/** A page of cards. */
export interface GridScreen {
  /** Always `"grid"`: which kind this is. */
  type: 'grid'
  /** Its sections of cards. */
  sections: { title?: string; items: (Card | AlbumCard | ArtistCard | PlaylistCard)[] }[]
  /** A search field over it, with its hint. */
  search?: { placeholder?: string }
  /** What it shows when it holds nothing. */
  empty?: EmptyState
  /** There are more cards: when the end is reached the page is rendered again
   * with this in `RenderContext.cursor`, and its cards are added below. */
  nextCursor?: string
}

/** A page of blocks, read from top to bottom. */
export interface DetailScreen {
  /** Always `"detail"`: which kind this is. */
  type: 'detail'
  /** Its blocks, read from top to bottom. */
  children: Block[]
}

/** A page of fields and one button that submits them. */
export interface FormScreen {
  /** Always `"form"`: which kind this is. */
  type: 'form'
  /** Its sections of fields. */
  sections: { title?: string; footer?: string; fields: Field[] }[]
  /** The button that hands the values to a command. */
  submit: {
    title: string
    /** The command that receives the form. Its handler is given `input` as
     * it is here, and the fields in `CommandContext.values`. */
    command: string
    /** JSON. */
    input?: unknown
  }
}

/** A node of a tree: a row that may hold rows of its own. */
export interface TreeNode {
  /** Always `"node"`: which kind this is. */
  type: 'node'
  /** Unique in the tree. */
  id: string
  /** Its title. */
  title: string
  /** A line under the title. */
  subtitle?: string
  /** An icon from Songstress's icon set. */
  icon?: IconName
  /** A picture beside it. */
  image?: ImageSource
  /** A badge beside it. */
  badge?: BadgeBlock
  /** What choosing it does. */
  action?: Action
  /** Its menu. */
  menu?: MenuEntry[]
  /** The nodes under it, given now. */
  children?: (TreeNode | SongRow)[]
  /** It has nodes under it that are not given now: when the person opens
   * it, the page is rendered again with its id in `RenderContext.node`, and
   * the answer's `nodes` are drawn under it. Left out when `children` is
   * given. */
  expandable?: boolean
  /** Open at first, on the web and the desktop. A phone opens a node with
   * nodes under it as a page of its own. */
  open?: boolean
}

/** A page of nodes in a tree: folders, groups, anything that holds more of
 * itself. The web and desktop apps open a node in place; the phones open it
 * as a page of its own, titled with the node's title. */
export interface TreeScreen {
  /** Always `"tree"`: which kind this is. */
  type: 'tree'
  /** The tree's top nodes, or the nodes under `RenderContext.node`. */
  nodes: (TreeNode | SongRow)[]
  /** A search field over it, with its hint. */
  search?: { placeholder?: string }
  /** What it shows when it holds nothing. */
  empty?: EmptyState
}

/** What a page is: a list, a grid, a tree, a detail or a form, by its `type`. */
export type Screen = ListScreen | GridScreen | DetailScreen | FormScreen | TreeScreen

/** What a panel shows inside one of Songstress's own screens. */
export interface PanelContent {
  /** Its blocks. */
  children: Block[]
}

/** What a status item shows in the player: an icon and a few words, the
 * extension's own state at a glance. */
export interface StatusContent {
  /** A few words; left out, the icon alone, named by the status item's
   * declared title for people who do not see it. */
  text?: string
  /** An icon from Songstress's icon set. */
  icon?: IconName
  /** Its colour, by meaning; the theme decides the colour itself. */
  tone?: Tone
  /** A line more, shown on hover or a long press. */
  tooltip?: string
  /** From 0 to 1: how far some work of the extension's is. */
  progress?: number
  /** Work is going on, with no telling how far it is. */
  busy?: boolean
  /** What choosing it does. */
  action?: Action
}

// ── actions: what a tap does ─────────────────────────────────────────────────

/** Something to play: songs by id, or everything of an album, an artist or a
 * playlist. */
export type Playable = { songIds: string[] } | { albumId: string } | { artistId: string } | { playlistId: string }

/** Where a tap can lead: a page or a view of the extension's own, or
 * Songstress's page for something in the library. */
export type Destination =
  | { page: string; params?: Record<string, string> }
  | { view: string; params?: Record<string, string> }
  | { library: LibraryType; id: string }

/** Runs one of the extension's commands, handing it `input` (JSON). */
export interface InvokeAction {
  /** Always `"invoke"`: which kind this is. */
  type: 'invoke'
  /** The command to run. */
  command: string
  /** JSON handed to the command as its input. */
  input?: unknown
}

/** Opens one of the extension's pages or views, or Songstress's own page for something in the library: as a page, or as a sheet. */
export interface NavigateAction {
  /** Always `"navigate"`: which kind this is. */
  type: 'navigate'
  /** Where it goes. */
  to: Destination
  /** Left out, "page": pushed like any page. A sheet slides over the screen.
   * On the phones a sheet has no navigation bar, so a list or a grid that
   * asks for `search` shows no search field there: present it as a page. */
  present?: 'page' | 'sheet'
}

/** Plays now, as a tap on a song does. */
export interface PlayAction {
  /** Always `"play"`: which kind this is. */
  type: 'play'
  /** The library songs to play. */
  what: Playable
}

/** Adds to the queue: at its end, or right after the current song. What is
 * playing is never touched. */
export interface QueueAction {
  /** Always `"queue"`: which kind this is. */
  type: 'queue'
  /** The library songs to add. */
  what: Playable
  /** Right after the current song, not at the end. */
  next?: boolean
}

/** Opens an http or https address in the browser. */
export interface OpenUrlAction {
  /** Always `"openUrl"`: which kind this is. */
  type: 'openUrl'
  /** The address to open, http or https. */
  url: string
}

/** Copies text to the clipboard. */
export interface CopyAction {
  /** Always `"copy"`: which kind this is. */
  type: 'copy'
  /** The text to copy. */
  text: string
}

/** Opens the device's share sheet. */
export interface ShareAction {
  /** Always `"share"`: which kind this is. */
  type: 'share'
  /** The title shared. */
  title?: string
  /** The text shared. */
  text?: string
  /** The address shared. */
  url?: string
}

/** Shows a short message that goes away by itself. */
export interface ToastAction {
  /** Always `"toast"`: which kind this is. */
  type: 'toast'
  /** The message. */
  message: string
  /** Its colour, by meaning. */
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

/** Asks first, then does `action` when the person agrees. */
export interface ConfirmAction {
  /** Always `"confirm"`: which kind this is. */
  type: 'confirm'
  /** What is asked. */
  title: string
  /** A sentence more. */
  message?: string
  /** The word on the button that agrees. */
  confirm?: string
  /** Yes is drawn as a destructive choice. */
  destructive?: boolean
  /** What happens on yes. */
  action: Action
}

/** Renders the page, panel or status item it came from again. */
export interface RefreshAction {
  /** Always `"refresh"`: which kind this is. */
  type: 'refresh'
}

/** One choice of a pick. */
export interface PickItem {
  /** What the command is handed when this is chosen. Unique in the pick. */
  id: string
  /** Its title. */
  title: string
  /** A line under the title. */
  subtitle?: string
  /** An icon from Songstress's icon set. */
  icon?: IconName
  /** A picture beside it. */
  image?: ImageSource
  /** Chosen at first, in a pick of several. */
  picked?: boolean
}

/** Asks the person to choose, with Songstress's own picker (a search field
 * over a long list), then runs a command with what they chose. Nothing runs
 * when they choose nothing and close it. */
export interface PickAction {
  /** Always `"pick"`: which kind this is. */
  type: 'pick'
  /** What the picker asks, as its heading. */
  title: string
  /** The hint in the search field. */
  placeholder?: string
  /** What to choose from, up to 100. */
  items: PickItem[]
  /** Several may be chosen. Left out, one. */
  many?: boolean
  /** The command that is handed the choice: `CommandContext.answer` is the
   * id chosen, or the ids for a pick of several. */
  command: string
  /** JSON, handed to the command as its input. */
  input?: unknown
}

/** Asks the person for a line of text, then runs a command with it. Never a
 * password: a secret is a setting. Nothing runs when they close it. */
export interface InputAction {
  /** Always `"input"`: which kind this is. */
  type: 'input'
  /** What is asked, as a heading. */
  title: string
  /** A line under the title: what to write. */
  prompt?: string
  /** The hint while the field is empty. */
  placeholder?: string
  /** What the field holds at first. */
  value?: string
  /** Several lines. */
  multiline?: boolean
  /** The most characters it takes. */
  maxLength?: number
  /** It cannot be sent empty. */
  required?: boolean
  /** The word on the button that sends it. Left out, "Done". */
  submit?: string
  /** The command that is handed the text, as `CommandContext.answer`. */
  command: string
  /** JSON, handed to the command as its input. */
  input?: unknown
}

/** A notice: what an extension has to tell, with up to two things to do
 * about it. It stays until the person closes it or picks one. */
export interface Notice {
  /** What the notice is about, in a few words. */
  title: string
  /** A sentence or two more. */
  message?: string
  /** Left out, "info". */
  tone?: 'info' | 'success' | 'warning' | 'danger'
  /** Each a title and what it does; at most two. */
  buttons?: { title: string; action: Action }[]
}

/** Shows a notice (`toast` is the message that goes away by itself). */
export interface NotifyAction extends Notice {
  /** Always `"notify"`: which kind this is. */
  type: 'notify'
}

/** What a tap, a button or a command's answer does: one of the actions, by its `type`. */
export type Action =
  | InvokeAction
  | NavigateAction
  | PlayAction
  | QueueAction
  | OpenUrlAction
  | CopyAction
  | ShareAction
  | ToastAction
  | ConfirmAction
  | RefreshAction
  | PickAction
  | InputAction
  | NotifyAction

// ── rendering ────────────────────────────────────────────────────────────────

/** What a page's renderer is told. */
export interface RenderContext {
  /** The member looking at the page. */
  userId: string
  /** The app that will draw the tree. */
  client: ClientInfo
  /** What the page was opened with (`Destination.params`). */
  params: Record<string, string>
  /** What the person typed in the page's search field. */
  search?: string
  /** The `nextCursor` of the rows already shown, when more are asked for. */
  cursor?: string
  /** On a tree, the id of the node the person opened: answer the nodes
   * under it. */
  node?: string
}

/** What a panel's renderer is told: who looks, and what the screen shows.
 * The song, artist or album is handed over whole to an extension granted
 * `library.read`, and left out for any other. */
export interface PanelContext {
  /** The member looking at the panel. */
  userId: string
  /** The app it is drawn in. */
  client: ClientInfo
  /** The song playing, on a "now-playing" panel. */
  song?: Song
  /** The artist of the page, on an "artist" panel. */
  artist?: Artist
  /** The album of the page, on an "album" panel. */
  album?: Album
  /** The playlist of the page, on a "playlist" panel: its id, to an
   * extension granted `library.read`. Playlists themselves are not read for
   * extensions yet. */
  playlist?: Pick<Playlist, 'id'>
}

/** What a status item's renderer is told: who looks, and the song playing,
 * whole to an extension granted `library.read`. */
export interface StatusContext {
  /** The member whose player shows the item. */
  userId: string
  /** The app it is drawn in. */
  client: ClientInfo
  /** The song playing, whole to an extension granted `library.read`. */
  song?: Song
}

/** Builds a page's screen. Registered with `songstress.ui.pages.register`. */
export type PageRenderer = (context: RenderContext) => Awaitable<Screen>

/** Null when the panel has nothing to show here: it is then left out. */
export type PanelRenderer = (context: PanelContext) => Awaitable<PanelContent | null>

/** Null when the status item has nothing to say now: it is then left out. */
export type StatusRenderer = (context: StatusContext) => Awaitable<StatusContent | null>

/** Renderers for the manifest's `contributes.pages`, each registered in the
 * entry its page names in `render`. */
export interface Pages {
  /** Registers the renderer of a declared page.
   * @param id - The id the manifest declares it under.
   * @param render - Builds the page each time it is shown.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.ui.pages.register('recent', async (context) => {
   *   const ids = (await songstress.storage.get<string[]>('recent', { userId: context.userId })) ?? []
   *   return {
   *     type: 'list',
   *     sections: [{ title: 'Played lately', items: ids.map((songId) => ({ type: 'song' as const, songId })) }],
   *     empty: { title: 'Nothing played yet' },
   *   }
   * })
   * ```
   */
  register(id: string, render: PageRenderer): Disposable
}

/** Renderers for the manifest's `contributes.panels`. */
export interface Panels {
  /** Registers the renderer of a declared panel.
   * @param id - The id the manifest declares it under.
   * @param render - Builds the panel each time it is shown.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.ui.panels.register('song-facts', (context) => {
   *   if (!context.song) return null
   *   const { title, genre, year } = context.song
   *   return { children: [{ type: 'text', text: `${title}: ${genre ?? 'no genre'}, ${year ?? 'year unknown'}` }] }
   * })
   * ```
   */
  register(id: string, render: PanelRenderer): Disposable
}

/** Renderers for the manifest's `contributes.status`. A status item is
 * rendered when the player shows it, when the song changes, and when it is
 * refreshed. */
export interface StatusItems {
  /** Registers the renderer of a declared status item.
   * @param id - The id the manifest declares it under.
   * @param render - Says what the item shows each time it is rendered.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.ui.status.register('sync', async (context) => {
   *   const at = await songstress.storage.get<string>('synced-at', { userId: context.userId })
   *   return at ? { text: 'Synced', tooltip: `Last synced ${at}` } : { text: 'Not synced', tone: 'warning' }
   * })
   * ```
   */
  register(id: string, render: StatusRenderer): Disposable
}

/** What to render again: one of the extension's pages, panels or status
 * items, by its id. */
export type RefreshTarget = { page: string } | { panel: string } | { status: string }

/** Declared interface. Both sides; no permission. */
export interface Ui {
  /** The renderers of the extension's pages. */
  pages: Pages
  /** The renderers of the extension's panels. */
  panels: Panels
  /** The renderers of the extension's status items. */
  status: StatusItems
}

/** Declared interface as the server entry has it: it may also tell a member
 * something, or have their apps render something again, while they are
 * open. Nothing is kept for an app that is closed. */
export interface ServerUi extends Ui {
  /** Shows a notice in the member's open apps. At most ten an hour for one
   * member: more reject with "limit-exceeded".
   * @param notice - The notice.
   * @param user - The member whose apps show it.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onScrobble(async (song, play) => {
   *   await songstress.ui.notify({ title: 'Scrobbled', message: `${song.artist} - ${song.title}`, tone: 'success' }, { userId: play.userId })
   * })
   * ```
   */
  notify(notice: Notice, user: ForUser): Promise<void>
  /** Has the member's open apps render a page, a panel or a status item
   * again, where it is showing. At most once every five seconds for one
   * target: more are let go.
   * @param target - What to render again.
   * @param user - The member whose apps render it.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onPlay(async (song, play) => {
   *   await songstress.storage.set('recent', [song.id], { userId: play.userId })
   *   await songstress.ui.refresh({ page: 'recent' }, { userId: play.userId })
   * })
   * ```
   */
  refresh(target: RefreshTarget, user: ForUser): Promise<void>
}

/** Declared interface as client code has it: the same, in its own app. */
export interface ClientUi extends Ui {
  /** Shows a notice in this app. At most ten an hour.
   * @param notice - The notice.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * await songstress.ui.notify({ title: 'Copied', message: 'The link is on your clipboard', tone: 'success' })
   * ```
   */
  notify(notice: Notice): Promise<void>
  /** Renders a page, a panel or a status item again, where it is showing.
   * @param target - What to render again.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.settings.onChange(async (change) => {
   *   if (change.key === 'style') await songstress.ui.refresh({ panel: 'song-facts' })
   * })
   * ```
   */
  refresh(target: RefreshTarget): Promise<void>
}
