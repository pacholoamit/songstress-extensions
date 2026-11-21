# Gruvbox

Gruvbox's retro groove: warm browns and creams with orange, for dark and for light. Songstress's themes in [Gruvbox](https://github.com/morhetz/gruvbox)'s palette, each look's colours by the palette's own roles:

**Gruvbox, dark.**

| Token | Gruvbox |
|---|---|
| `background` | dark0 |
| `sidebar` | dark0_hard |
| `surface` | dark0_soft |
| `surface.raised` | dark1 |
| `border` | light1 at 14% |
| `text` | light1 |
| `text.muted` | light3 |
| `text.faint` | gray |
| `accent` | bright_orange |
| `accent.fill` | bright_orange |
| `accent.fill.pressed` | the fill, pressed |
| `accent.onFill` | dark0 |
| `success` | bright_green |
| `warning` | bright_yellow |
| `danger` | bright_red |
| `info` | bright_blue |

**Gruvbox, light.**

| Token | Gruvbox |
|---|---|
| `background` | light0 |
| `sidebar` | light0_soft |
| `surface` | light1 |
| `surface.raised` | light0_hard |
| `border` | dark1 at 18% |
| `text` | dark1 |
| `text.muted` | dark3 |
| `text.faint` | dark4 |
| `accent` | faded_orange |
| `accent.fill` | faded_orange |
| `accent.onFill` | light0 |
| `success` | faded_green |
| `warning` | faded_yellow |
| `danger` | faded_red |
| `info` | faded_blue |

Hairlines are the words' colour at a low alpha, so they read on the stage, on rows and on menus alike. What a look leaves out, Songstress fills from its own colours (sdk/SPEC.md, section 12).

Some colours are moved off the palette to the nearest tone of their own hue that reads where the apps draw them, with room rather than by a hair, on the stage, on menus and on the player (sdk/SPEC.md, section 12, "The rules"; and the official bar: words near 7:1, an accent label that reads on rows, a light look's status colours at 3:1, a second voice apart from the words):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Gruvbox, Dark | `danger` | bright_red `#fb4934` | `#ff8470` | 4.5:1 with room, on the stage, rows, menus |
| Gruvbox, Dark | `accent.fill.pressed` | the fill, pressed `#dc711b` | `#e37621` | 4.5:1 with room for its label, pressed |
| Gruvbox, Light | `text.muted` | dark3 `#665c54` | `#645a52` | 4.5:1 with room, on the stage, rows, menus, the player over black artwork, the player over white artwork |
| Gruvbox, Light | `accent` | faded_orange `#af3a03` | `#a83600` | 4.5:1 with room, on the stage, rows |
| Gruvbox, Light | `accent.fill` | faded_orange `#af3a03` | `#a83600` | the accent it is |
| Gruvbox, Light | `warning` | faded_yellow `#b57614` | `#a66a01` | 3.0:1 with room, on the stage, rows |

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are Gruvbox's, under the MIT License (`NOTICE`): Gruvbox's README and package.json give its licence as MIT/X11; the repository has no licence file.; this extension is MIT too (`LICENSE`).
