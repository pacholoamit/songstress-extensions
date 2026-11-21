# Kanagawa

Kanagawa's ink and wave, after Hokusai: Kanagawa Wave, for dark. Songstress's themes in [Kanagawa](https://github.com/rebelot/kanagawa.nvim)'s palette, each look's colours by the palette's own roles:

**Kanagawa, dark.**

| Token | Kanagawa |
|---|---|
| `background` | sumiInk3 |
| `sidebar` | sumiInk1 |
| `surface` | sumiInk4 |
| `surface.raised` | sumiInk5 |
| `border` | fujiWhite at 12% |
| `text` | fujiWhite |
| `text.muted` | katanaGray |
| `text.faint` | fujiGray |
| `accent` | crystalBlue |
| `accent.fill` | crystalBlue |
| `accent.fill.pressed` | the fill, pressed |
| `accent.onFill` | sumiInk3 |
| `success` | springGreen |
| `warning` | carpYellow |
| `danger` | waveRed |
| `info` | oniViolet |

Hairlines are the words' colour at a low alpha, so they read on the stage, on rows and on menus alike. What a look leaves out, Songstress fills from its own colours (sdk/SPEC.md, section 12).

Some colours are moved off the palette to the nearest tone of their own hue that reads where the apps draw them, with room rather than by a hair, on the stage, on menus and on the player (sdk/SPEC.md, section 12, "The rules"; and the official bar: words near 7:1, an accent label that reads on rows, a light look's status colours at 3:1, a second voice apart from the words):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Kanagawa, Dark | `text.muted` | katanaGray `#717c7c` | `#9da8a8` | 4.5:1 with room, on the stage, rows, menus, the player over black artwork, the player over white artwork |
| Kanagawa, Dark | `text.faint` | fujiGray `#727169` | `#7a7970` | 3.0:1 with room, on the stage, rows |
| Kanagawa, Dark | `danger` | waveRed `#e46876` | `#fe7d8a` | 4.5:1 with room, on the stage, rows, menus |
| Kanagawa, Dark | `info` | oniViolet `#957fb8` | `#a38cc6` | 4.5:1 with room, on the stage, rows |
| Kanagawa, Dark | `accent.fill.pressed` | the fill, pressed `#6f88ba` | `#728bbd` | 4.5:1 with room for its label, pressed |

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are Kanagawa's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
