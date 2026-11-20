// Declared interface: what an extension draws, said as data. A page or a
// panel is a tree of the components below; each app draws the tree with its
// own controls, in its own design, so one page works on the web, on the
// desktop and on a phone.
//
// A tree is JSON and nothing else: no function, no script, no markup, no
// style. Colour is said by meaning (`tone`), size by a few named steps. An
// extension draws inside the places given to it, never over Songstress's own.
// What happens on a tap is an action (the end of this file), also data.
//
// The apps cap a tree's size, depth and number of rows, and how often it may
// be redrawn; a tree over a cap is not drawn.

import type { IconName } from '../manifest/types.generated'
import type { Awaitable, Disposable } from './common'
import type { ClientInfo } from './host'
import type { Album, Artist, LibraryType, Song } from './library'

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

export interface SongRow {
  type: 'song'
  songId: string
}

export interface AlbumCard {
  type: 'album'
  albumId: string
}

export interface ArtistCard {
  type: 'artist'
  artistId: string
}

export interface PlaylistCard {
  type: 'playlist'
  playlistId: string
}

// ── rows and cards of the extension's own ────────────────────────────────────

/** One entry of a menu. */
export interface MenuEntry {
  title: string
  icon?: IconName
  action: Action
  /** It deletes or cannot be undone: drawn as such. */
  destructive?: boolean
}

/** A row of a list. */
export interface Row {
  type: 'row'
  /** Unique among the rows of its list. */
  id: string
  title: string
  subtitle?: string
  icon?: IconName
  image?: ImageSource
  /** A short word at the row's end. */
  badge?: BadgeBlock
  /** What a tap does. */
  action?: Action
  /** More to do with the row. */
  menu?: MenuEntry[]
}

/** A card of a grid or a shelf. */
export interface Card {
  type: 'card'
  /** Unique among the cards beside it. */
  id: string
  title: string
  subtitle?: string
  image?: ImageSource
  action?: Action
  menu?: MenuEntry[]
}

// ── blocks: what a detail page, a section or a panel is built from ───────────

/** Blocks beside or under one another. */
export interface StackBlock {
  type: 'stack'
  /** Left out, "vertical". */
  direction?: 'vertical' | 'horizontal'
  gap?: Size
  align?: 'start' | 'center' | 'end'
  children: Block[]
}

/** Blocks under a heading. */
export interface SectionBlock {
  type: 'section'
  title?: string
  /** A line of help under the section. */
  footer?: string
  children: Block[]
}

export interface TextBlock {
  type: 'text'
  text: string
  /** Left out, "body". */
  style?: 'title' | 'heading' | 'body' | 'caption'
  tone?: Tone
}

export interface IconBlock {
  type: 'icon'
  name: IconName
  tone?: Tone
}

export interface ImageBlock {
  type: 'image'
  source: ImageSource
  /** What the image shows, for people who do not see it. */
  description: string
  shape?: 'square' | 'wide' | 'circle'
}

/** A short word in a pill. */
export interface BadgeBlock {
  type: 'badge'
  text: string
  tone?: Tone
}

export interface ProgressBlock {
  type: 'progress'
  /** From 0 to 1. Left out, the bar shows that something is going on without
   * saying how far it is. */
  value?: number
  label?: string
}

/** A notice across the page. */
export interface BannerBlock {
  type: 'banner'
  tone: 'info' | 'success' | 'warning' | 'danger'
  title: string
  text?: string
  /** One thing to do about it. */
  button?: { title: string; action: Action }
}

export interface DividerBlock {
  type: 'divider'
}

export interface SpacerBlock {
  type: 'spacer'
  size?: Size
}

/** Blocks a tap opens and closes. */
export interface CollapsibleBlock {
  type: 'collapsible'
  title: string
  /** Open at first. */
  open?: boolean
  children: Block[]
}

export interface ButtonBlock {
  type: 'button'
  title: string
  action: Action
  icon?: IconName
  /** Left out, "secondary". A page has at most one primary button. */
  style?: 'primary' | 'secondary' | 'destructive'
  disabled?: boolean
}

/** A button that opens a menu. */
export interface MenuBlock {
  type: 'menu'
  title: string
  icon?: IconName
  items: MenuEntry[]
}

/** A row of cards that scrolls sideways, under a heading. */
export interface ShelfBlock {
  type: 'shelf'
  title: string
  items: (Card | SongRow | AlbumCard | ArtistCard | PlaylistCard)[]
}

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
  label: string
  /** A line of help under the field. */
  help?: string
}

export interface TextField extends FieldBase {
  type: 'text-field'
  value?: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
  required?: boolean
}

export interface SwitchField extends FieldBase {
  type: 'switch'
  value?: boolean
}

export interface CheckboxField extends FieldBase {
  type: 'checkbox'
  value?: boolean
}

export interface SliderField extends FieldBase {
  type: 'slider'
  value?: number
  minimum: number
  maximum: number
  step?: number
}

export interface PickerField extends FieldBase {
  type: 'picker'
  /** The `value` of the option chosen. */
  value?: string
  options: { value: string; title: string }[]
}

export interface DateField extends FieldBase {
  type: 'date-picker'
  /** A day, as YYYY-MM-DD. */
  value?: string
  minimum?: string
  maximum?: string
}

export type Field = TextField | SwitchField | CheckboxField | SliderField | PickerField | DateField

/** What a form's fields hold when it is submitted, by field name. */
export type FormValues = Record<string, string | number | boolean>

// ── screens: what a whole page is ────────────────────────────────────────────

/** What a list or a grid shows when it has nothing to show. */
export interface EmptyState {
  title: string
  text?: string
  icon?: IconName
  button?: { title: string; action: Action }
}

/** A page of rows. */
export interface ListScreen {
  type: 'list'
  sections: { title?: string; items: (Row | SongRow)[] }[]
  /** A search field over the list. The page is rendered again as the person
   * types, with what they typed in `RenderContext.search`. */
  search?: { placeholder?: string }
  empty?: EmptyState
  /** There are more rows: when the end is reached the page is rendered again
   * with this in `RenderContext.cursor`, and its rows are added below. */
  nextCursor?: string
}

/** A page of cards. */
export interface GridScreen {
  type: 'grid'
  sections: { title?: string; items: (Card | AlbumCard | ArtistCard | PlaylistCard)[] }[]
  search?: { placeholder?: string }
  empty?: EmptyState
  nextCursor?: string
}

/** A page of blocks, read from top to bottom. */
export interface DetailScreen {
  type: 'detail'
  children: Block[]
}

/** A page of fields and one button that submits them. */
export interface FormScreen {
  type: 'form'
  sections: { title?: string; footer?: string; fields: Field[] }[]
  submit: {
    title: string
    /** The command that receives the form. Its handler is given `input` as
     * it is here, and the fields in `CommandContext.values`. */
    command: string
    /** JSON. */
    input?: unknown
  }
}

export type Screen = ListScreen | GridScreen | DetailScreen | FormScreen

/** What a panel shows inside one of Songstress's own screens. */
export interface PanelContent {
  children: Block[]
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
  type: 'invoke'
  command: string
  input?: unknown
}

export interface NavigateAction {
  type: 'navigate'
  to: Destination
  /** Left out, "page": pushed like any page. A sheet slides over the screen. */
  present?: 'page' | 'sheet'
}

/** Plays now, as a tap on a song does. */
export interface PlayAction {
  type: 'play'
  what: Playable
}

/** Adds to the queue: at its end, or right after the current song. What is
 * playing is never touched. */
export interface QueueAction {
  type: 'queue'
  what: Playable
  next?: boolean
}

/** Opens an http or https address in the browser. */
export interface OpenUrlAction {
  type: 'openUrl'
  url: string
}

export interface CopyAction {
  type: 'copy'
  text: string
}

/** Opens the device's share sheet. */
export interface ShareAction {
  type: 'share'
  title?: string
  text?: string
  url?: string
}

/** Shows a short message that goes away by itself. */
export interface ToastAction {
  type: 'toast'
  message: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

/** Asks first, then does `action` when the person agrees. */
export interface ConfirmAction {
  type: 'confirm'
  title: string
  message?: string
  /** The word on the button that agrees. */
  confirm?: string
  destructive?: boolean
  action: Action
}

/** Renders the page or panel it came from again. */
export interface RefreshAction {
  type: 'refresh'
}

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
}

/** What a panel's renderer is told: who looks, and what the screen shows. */
export interface PanelContext {
  userId: string
  client: ClientInfo
  /** The song playing, on a "now-playing" panel. */
  song?: Song
  /** The artist of the page, on an "artist" panel. */
  artist?: Artist
  /** The album of the page, on an "album" panel. */
  album?: Album
}

export type PageRenderer = (context: RenderContext) => Awaitable<Screen>

/** Null when the panel has nothing to show here: it is then left out. */
export type PanelRenderer = (context: PanelContext) => Awaitable<PanelContent | null>

/** Renderers for the manifest's `contributes.pages`, each registered in the
 * entry its page names in `render`. */
export interface Pages {
  register(id: string, render: PageRenderer): Disposable
}

/** Renderers for the manifest's `contributes.panels`. */
export interface Panels {
  register(id: string, render: PanelRenderer): Disposable
}

/** Declared interface. Both sides; no permission. */
export interface Ui {
  pages: Pages
  panels: Panels
}
