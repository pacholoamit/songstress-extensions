// The trees every reader of declared interface is held to: one of each
// screen and a panel, every kind of node and action in them, written against
// this package's own types (ui.ts), so a shape that changes fails here when
// it compiles. uiTrees.test.ts keeps them as testdata/ui-trees.json, which
// the Go server's reader (apps/pocketbase/internal/extensions, ui_tree.go)
// and the apps' (packages/app, features/extensions/ui/tree.ts) each read in
// place: what either reads of a tree here must be the tree itself.

import { fileURLToPath } from 'node:url'
import type { DetailScreen, FormScreen, GridScreen, ListScreen, PanelContent, StatusContent, TreeScreen } from '../api/ui'

export const UI_TREES_FILE = fileURLToPath(new URL('../../testdata/ui-trees.json', import.meta.url))

const list: ListScreen = {
  type: 'list',
  search: { placeholder: 'Search plays' },
  empty: { title: 'No plays yet', text: 'Play something.', icon: 'music', button: { title: 'Refresh', action: { type: 'refresh' } } },
  nextCursor: 'page-2',
  sections: [
    {
      title: 'Today',
      items: [
        {
          type: 'row',
          id: 'r1',
          title: 'Blue Monday',
          subtitle: 'New Order',
          icon: 'music',
          image: { cover: 'album', id: 'al-1' },
          badge: { type: 'badge', text: 'Sent', tone: 'success' },
          action: { type: 'navigate', to: { page: 'play', params: { id: 'r1' } }, present: 'sheet' },
          menu: [
            { title: 'Send again', icon: 'refresh', action: { type: 'invoke', command: 'resend', input: { id: 'r1' } } },
            {
              title: 'Forget',
              destructive: true,
              action: {
                type: 'confirm',
                title: 'Forget this play?',
                message: 'Tunelog keeps its own copy.',
                confirm: 'Forget',
                destructive: true,
                action: { type: 'invoke', command: 'forget' },
              },
            },
          ],
        },
        { type: 'song', songId: 'so-1' },
      ],
    },
    { items: [{ type: 'row', id: 'r2', title: 'Elsewhere', image: { url: 'https://img.example/a.png' } }] },
  ],
}

const grid: GridScreen = {
  type: 'grid',
  sections: [
    {
      title: 'Charts',
      items: [
        {
          type: 'card',
          id: 'c1',
          title: 'This week',
          subtitle: '42 plays',
          action: { type: 'play', what: { songIds: ['so-1', 'so-2'] } },
          menu: [{ title: 'Play next', action: { type: 'queue', what: { playlistId: 'pl-1' }, next: true } }],
        },
        { type: 'album', albumId: 'al-1' },
        { type: 'artist', artistId: 'ar-1' },
        { type: 'playlist', playlistId: 'pl-1' },
      ],
    },
  ],
}

const detail: DetailScreen = {
  type: 'detail',
  children: [
    {
      type: 'banner',
      tone: 'warning',
      title: 'Not connected',
      text: 'Add your token.',
      button: { title: 'Open settings', action: { type: 'openUrl', url: 'https://tunelog.example/settings' } },
    },
    {
      type: 'section',
      title: 'Profile',
      footer: 'From Tunelog.',
      children: [
        {
          type: 'stack',
          direction: 'horizontal',
          gap: 'small',
          align: 'center',
          children: [
            { type: 'icon', name: 'person', tone: 'accent' },
            { type: 'text', text: 'ada', style: 'heading' },
          ],
        },
        { type: 'text', text: 'Member since 2021', tone: 'muted' },
        { type: 'badge', text: 'Pro' },
        { type: 'progress', value: 0.4, label: 'This week' },
        { type: 'progress' },
        { type: 'divider' },
        { type: 'spacer', size: 'large' },
        { type: 'image', source: { cover: 'artist', id: 'ar-1' }, description: 'The artist', shape: 'circle' },
      ],
    },
    { type: 'collapsible', title: 'More', open: true, children: [{ type: 'text', text: 'Details' }] },
    { type: 'button', title: 'Sync now', icon: 'refresh', style: 'primary', action: { type: 'invoke', command: 'sync' } },
    { type: 'button', title: 'Queue it', disabled: true, action: { type: 'queue', what: { albumId: 'al-1' } } },
    {
      type: 'menu',
      title: 'Share',
      icon: 'share',
      items: [
        { title: 'Copy link', action: { type: 'copy', text: 'https://tunelog.example/ada' } },
        { title: 'Share', action: { type: 'share', title: 'ada', text: 'My profile', url: 'https://tunelog.example/ada' } },
        { title: 'Open the album', action: { type: 'navigate', to: { library: 'album', id: 'al-1' } } },
        { title: 'Open the visualiser', action: { type: 'navigate', to: { view: 'visualiser' } } },
      ],
    },
    {
      type: 'shelf',
      title: 'Top albums',
      items: [
        { type: 'album', albumId: 'al-1' },
        { type: 'card', id: 'c9', title: 'Elsewhere' },
        { type: 'song', songId: 'so-1' },
      ],
    },
    { type: 'song', songId: 'so-1' },
    { type: 'album', albumId: 'al-1' },
    { type: 'artist', artistId: 'ar-1' },
    { type: 'playlist', playlistId: 'pl-1' },
    { type: 'button', title: 'Say hello', action: { type: 'toast', message: 'Hello', tone: 'success' } },
    {
      type: 'button',
      title: 'Choose a period',
      action: {
        type: 'pick',
        title: 'Which plays?',
        placeholder: 'Search periods',
        many: true,
        items: [
          { id: 'week', title: 'This week', subtitle: '42 plays', icon: 'calendar', picked: true },
          { id: 'year', title: 'This year', image: { cover: 'album', id: 'al-1' } },
        ],
        command: 'import',
        input: { from: 'pick' },
      },
    },
    {
      type: 'button',
      title: 'Rename',
      icon: 'edit',
      action: {
        type: 'input',
        title: 'Rename the chart',
        prompt: 'As your profile shows it.',
        placeholder: 'My chart',
        value: 'Charts',
        multiline: false,
        maxLength: 60,
        required: true,
        submit: 'Rename',
        command: 'rename',
        input: { chart: 'c1' },
      },
    },
    {
      type: 'button',
      title: 'Check the import',
      action: {
        type: 'notify',
        title: 'Import finished',
        message: '1,204 plays came in.',
        tone: 'success',
        buttons: [
          { title: 'Undo', action: { type: 'invoke', command: 'undo-import' } },
          { title: 'Open', action: { type: 'navigate', to: { page: 'recent' } } },
        ],
      },
    },
    { type: 'button', title: 'Play the artist', style: 'secondary', action: { type: 'play', what: { artistId: 'ar-1' } } },
  ],
}

const form: FormScreen = {
  type: 'form',
  sections: [
    {
      title: 'Import',
      footer: 'Plays older than a year are skipped.',
      fields: [
        { type: 'text-field', name: 'user', label: 'Profile name', help: 'As on your profile.', placeholder: 'ada', maxLength: 40, required: true },
        { type: 'text-field', name: 'note', label: 'Note', value: 'hi', multiline: true },
        { type: 'switch', name: 'loved', label: 'Loved songs too', value: true },
        { type: 'checkbox', name: 'agree', label: 'I have a backup' },
        { type: 'slider', name: 'weeks', label: 'Weeks', value: 4, minimum: 1, maximum: 52, step: 1 },
        {
          type: 'picker',
          name: 'mode',
          label: 'Mode',
          value: 'merge',
          options: [
            { value: 'merge', title: 'Merge' },
            { value: 'replace', title: 'Replace' },
          ],
        },
        { type: 'date-picker', name: 'since', label: 'Since', value: '2026-01-01', minimum: '2020-01-01', maximum: '2026-12-31' },
      ],
    },
    { fields: [{ type: 'switch', name: 'quiet', label: 'Quietly' }] },
  ],
  submit: { title: 'Import', command: 'import', input: { source: 'form' } },
}

const tree: TreeScreen = {
  type: 'tree',
  search: { placeholder: 'Search folders' },
  empty: { title: 'No folders', text: 'Add one on Tunelog.' },
  nodes: [
    {
      type: 'node',
      id: 'n1',
      title: '2026',
      subtitle: '12 months',
      icon: 'folder',
      badge: { type: 'badge', text: 'New', tone: 'accent' },
      open: true,
      menu: [{ title: 'Play all', action: { type: 'play', what: { playlistId: 'pl-1' } } }],
      children: [
        { type: 'node', id: 'n1-1', title: 'January', image: { cover: 'album', id: 'al-1' }, action: { type: 'refresh' } },
        { type: 'node', id: 'n1-2', title: 'February', expandable: true },
        { type: 'song', songId: 'so-2' },
      ],
    },
    { type: 'node', id: 'n2', title: '2025', expandable: true },
    { type: 'song', songId: 'so-1' },
  ],
}

const panel: PanelContent = {
  children: [
    { type: 'text', text: 'Scrobbled 12 times', style: 'caption' },
    { type: 'button', title: 'Recent plays', action: { type: 'navigate', to: { page: 'recent' } } },
  ],
}

const status: StatusContent = {
  text: 'Sent',
  icon: 'check',
  tone: 'success',
  tooltip: '12 plays sent today',
  progress: 0.5,
  busy: false,
  action: { type: 'navigate', to: { page: 'recent' }, present: 'sheet' },
}

/** One of each screen, a panel and a status item. */
const UI_TREES = { screens: { list, grid, detail, form, tree }, panel, status }

/** The trees as the file keeps them. */
export function uiTreesFixture(): string {
  const note = 'Written by "pnpm --dir packages/extensions ui-trees:record" from src/test/uiTrees.ts. Never edit it by hand.'
  return `${JSON.stringify({ note, ...UI_TREES }, null, 2)}\n`
}
