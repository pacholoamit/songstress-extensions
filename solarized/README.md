# Solarized

Ethan Schoonover's Solarized: sixteen colours, one dark look and one light, built to be read for hours. Songstress's themes in [Solarized](https://ethanschoonover.com/solarized/)'s palette, each look's colours by the palette's own roles:

**Solarized, dark.**

| Token | Solarized |
|---|---|
| `background` | base03 |
| `sidebar` | base02 |
| `surface` | base02 |
| `surface.raised` | base02 |
| `border` | base1 at 16% |
| `text` | base1 |
| `text.muted` | base0 |
| `text.faint` | base01 |
| `accent` | blue |
| `accent.fill` | blue |
| `accent.fill.pressed` | the fill, pressed |
| `accent.onFill` | base03 |
| `success` | green |
| `warning` | yellow |
| `danger` | red |
| `info` | violet |

**Solarized, light.**

| Token | Solarized |
|---|---|
| `background` | base3 |
| `sidebar` | base2 |
| `surface` | base2 |
| `border` | base02 at 18% |
| `text` | base02 |
| `text.muted` | base01 |
| `text.faint` | base00 |
| `accent` | blue |
| `accent.fill` | blue |
| `accent.onFill` | base3 |
| `success` | green |
| `warning` | yellow |
| `danger` | red |
| `info` | violet |

Hairlines are the words' colour at a low alpha, so they read on the stage, on rows and on menus alike. What a look leaves out, Songstress fills from its own colours (sdk/SPEC.md, section 12).

Some colours are moved off the palette to the nearest tone of their own hue that reads where the apps draw them, with room rather than by a hair, on the stage, on menus and on the player (sdk/SPEC.md, section 12, "The rules"; and the official bar: words near 7:1, an accent label that reads on rows, a light look's status colours at 3:1, a second voice apart from the words):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Solarized, Dark | `text` | base1 `#93a1a1` | `#c4d2d2` | the words lifted, so the second voice stands apart (1.5 between them) |
| Solarized, Dark | `text.muted` | base0 `#839496` | `#9bacae` | 4.5:1 with room, on the stage, rows, menus, the player over black artwork, the player over white artwork |
| Solarized, Dark | `text.faint` | base01 `#586e75` | `#6c838a` | 3.0:1 with room, on the stage, rows |
| Solarized, Dark | `accent` | blue `#268bd2` | `#48a3eb` | 4.5:1 with room, on the stage, rows |
| Solarized, Dark | `success` | green `#859900` | `#92a718` | 4.5:1 with room, on the stage, rows |
| Solarized, Dark | `warning` | yellow `#b58900` | `#c49617` | 4.5:1 with room, on the stage, rows |
| Solarized, Dark | `danger` | red `#dc322f` | `#ff7266` | 4.5:1 with room, on the stage, rows, menus |
| Solarized, Dark | `info` | violet `#6c71c4` | `#9196ec` | 4.5:1 with room, on the stage, rows |
| Solarized, Dark | `accent.fill` | blue `#268bd2` | `#48a3eb` | the accent it is |
| Solarized, Dark | `accent.fill.pressed` | the fill, pressed `#4993d0` | `#4c96d3` | 4.5:1 with room for its label, pressed |
| Solarized, Light | `text.muted` | base01 `#586e75` | `#4c6269` | 4.5:1 with room, on the stage, rows, menus, the player over black artwork, the player over white artwork |
| Solarized, Light | `accent` | blue `#268bd2` | `#0069a6` | 4.5:1 with room, on the stage, rows |
| Solarized, Light | `danger` | red `#dc322f` | `#b81419` | 4.5:1 with room, on the stage, rows, menus |
| Solarized, Light | `info` | violet `#6c71c4` | `#585dae` | 4.5:1 with room, on the stage, rows |
| Solarized, Light | `accent.fill` | blue `#268bd2` | `#0069a6` | the accent it is |
| Solarized, Light | `success` | green `#859900` | `#748600` | 3.0:1 with room, on the stage, rows |
| Solarized, Light | `warning` | yellow `#b58900` | `#a27a00` | 3.0:1 with room, on the stage, rows |

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are Solarized's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
