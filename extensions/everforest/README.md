# Everforest

Everforest's green, warm and soft: a forest at dusk for dark, and at noon for light. Songstress's themes in [Everforest (medium)](https://github.com/sainnhe/everforest)'s palette, each look's colours by the palette's own roles:

**Everforest, dark.**

| Token | Everforest (medium) |
|---|---|
| `background` | bg0 |
| `sidebar` | bg_dim |
| `surface` | bg1 |
| `surface.raised` | bg2 |
| `border` | fg at 14% |
| `text` | fg |
| `text.muted` | grey2 |
| `text.faint` | grey1 |
| `accent` | green |
| `accent.fill` | green |
| `accent.fill.pressed` | the fill, pressed |
| `accent.onFill` | bg0 |
| `success` | aqua |
| `warning` | yellow |
| `danger` | red |
| `info` | blue |

**Everforest, light.**

| Token | Everforest (medium) |
|---|---|
| `background` | bg0 |
| `sidebar` | bg_dim |
| `surface` | bg1 |
| `border` | fg at 20% |
| `text` | fg |
| `text.muted` | grey2 |
| `text.faint` | grey1 |
| `accent` | green |
| `accent.fill` | green |
| `accent.onFill` | bg0 |
| `success` | aqua |
| `warning` | yellow |
| `danger` | red |
| `info` | blue |

Hairlines are the words' colour at a low alpha, so they read on the stage, on rows and on menus alike. What a look leaves out, Songstress fills from its own colours (sdk/SPEC.md, section 12).

Some colours are moved off the palette to the nearest tone of their own hue that reads where the apps draw them, with room rather than by a hair, on the stage, on menus and on the player (sdk/SPEC.md, section 12, "The rules"; and the official bar: words near 7:1, an accent label that reads on rows, a light look's status colours at 3:1, a second voice apart from the words):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Everforest, Dark | `text` | fg `#d3c6aa` | `#f3e5c8` | the words lifted, so the second voice stands apart (1.5 between them) where the player holds it near 6.5:1 |
| Everforest, Dark | `text.muted` | grey2 `#9da9a0` | `#b2beb5` | 4.5:1 with room, on the stage, rows, menus, the player over black artwork, the player over white artwork |
| Everforest, Dark | `danger` | red `#e67e80` | `#ff9c9d` | 4.5:1 with room, on the stage, rows, menus |
| Everforest, Dark | `accent.fill.pressed` | the fill, pressed `#8fa46e` | `#92a770` | 4.5:1 with room for its label, pressed |
| Everforest, Light | `text` | fg `#5c6a72` | `#344149` | the words darker, so the second voice stands apart (1.5 between them) |
| Everforest, Light | `text.muted` | grey2 `#829181` | `#536152` | 4.5:1 with room, on the stage, rows, menus, the player over black artwork, the player over white artwork |
| Everforest, Light | `text.faint` | grey1 `#939f91` | `#7b877a` | 3.0:1 with room, on the stage, rows |
| Everforest, Light | `accent` | green `#8da101` | `#627000` | 4.5:1 with room, on the stage, rows |
| Everforest, Light | `danger` | red `#f85552` | `#bc2a2c` | 4.5:1 with room, on the stage, rows, menus |
| Everforest, Light | `info` | blue `#3a94c5` | `#006f9c` | 4.5:1 with room, on the stage, rows |
| Everforest, Light | `accent.fill` | green `#8da101` | `#627000` | the accent it is |
| Everforest, Light | `success` | aqua `#35a77c` | `#1d976d` | 3.0:1 with room, on the stage, rows |
| Everforest, Light | `warning` | yellow `#dfa000` | `#ac7b00` | 3.0:1 with room, on the stage, rows |

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are Everforest (medium)'s, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
