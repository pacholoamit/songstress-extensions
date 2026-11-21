# One Dark and One Light

Atom's One Dark and One Light, as GitHub drew them, in their own hsl() colours. Songstress's themes in [Atom's One Dark and One Light](https://github.com/atom/atom/tree/master/packages/one-dark-syntax)'s palette, each look's colours by the palette's own roles:

**One Dark, dark.**

| Token | Atom's One Dark and One Light |
|---|---|
| `background` | syntax-bg |
| `sidebar` | syntax-bg, 3% darker |
| `surface` | syntax-bg, 4% lighter |
| `surface.raised` | syntax-bg, 8% lighter |
| `border` | mono-1 at 12% |
| `text` | mono-1 |
| `text.muted` | mono-2 |
| `text.faint` | mono-3 |
| `accent` | hue-2 (blue) |
| `accent.fill` | hue-2 (blue) |
| `accent.fill.pressed` | the fill, pressed |
| `accent.onFill` | syntax-bg |
| `success` | hue-4 (green) |
| `warning` | hue-6-2 (orange 2) |
| `danger` | hue-5 (red 1) |
| `info` | hue-3 (purple) |

**One Light, light.**

| Token | Atom's One Dark and One Light |
|---|---|
| `background` | syntax-bg |
| `sidebar` | syntax-bg, 4% darker |
| `surface` | syntax-bg, 4% darker |
| `surface.raised` | white |
| `border` | mono-1 at 15% |
| `text` | mono-1 |
| `text.muted` | mono-2 |
| `text.faint` | mono-3 |
| `accent` | hue-2 (blue) |
| `accent.fill` | hue-2 (blue) |
| `accent.onFill` | white |
| `success` | hue-4 (green) |
| `warning` | hue-6 (orange 1) |
| `danger` | hue-5-2 (red 2) |
| `info` | hue-3 (purple) |

Hairlines are the words' colour at a low alpha, so they read on the stage, on rows and on menus alike. What a look leaves out, Songstress fills from its own colours (sdk/SPEC.md, section 12).

Some colours are moved off the palette to the nearest tone of their own hue that reads where the apps draw them, with room rather than by a hair, on the stage, on menus and on the player (sdk/SPEC.md, section 12, "The rules"; and the official bar: words near 7:1, an accent label that reads on rows, a light look's status colours at 3:1, a second voice apart from the words):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| One Dark, Dark | `text` | mono-1 `hsl(220, 14%, 71%)` | `#d2d8e6` | the words lifted, so the second voice stands apart (1.5 between them) |
| One Dark, Dark | `text.muted` | mono-2 `hsl(220, 9%, 55%)` | `#aab1c0` | 4.5:1 with room, on the stage, rows, menus, the player over black artwork, the player over white artwork |
| One Dark, Dark | `text.faint` | mono-3 `hsl(220, 10%, 40%)` | `#7d8492` | 3.0:1 with room, on the stage, rows |
| One Dark, Dark | `danger` | hue-5 (red 1) `hsl(355, 65%, 65%)` | `#ff8f96` | 4.5:1 with room, on the stage, rows, menus |
| One Dark, Dark | `info` | hue-3 (purple) `hsl(286, 60%, 67%)` | `#d283e9` | 4.5:1 with room, on the stage, rows |
| One Dark, Dark | `accent.fill.pressed` | the fill, pressed `#5798cf` | `#5a9bd2` | 4.5:1 with room for its label, pressed |
| One Light, Light | `text.faint` | mono-3 `hsl(230, 4%, 64%)` | `#83848a` | 3.0:1 with room, on the stage, rows |
| One Light, Light | `accent` | hue-2 (blue) `hsl(221, 87%, 60%)` | `#2363dc` | 4.5:1 with room, on the stage, rows |
| One Light, Light | `accent.fill` | hue-2 (blue) `hsl(221, 87%, 60%)` | `#2363dc` | the accent it is |
| One Light, Light | `text.muted` | mono-2 `hsl(230, 6%, 44%)` | `#5d606b` | 4.5:1 with room, on the stage, rows, menus, the player over black artwork, the player over white artwork |
| One Light, Light | `success` | hue-4 (green) `hsl(119, 34%, 47%)` | `#459646` | 3.0:1 with room, on the stage, rows |

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are Atom's One Dark and One Light's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
