# Nord

A Songstress theme in [Nord](https://www.nordtheme.com)'s palette: Polar Night for dark and Snow Storm for light, as Nord itself pairs them, in one theme that follows the phone's appearance.

**Dark.** The stage is nord0, rows, cards and the sidebar nord1, menus nord2, hairlines nord6 at 12%; words nord6, the second voice nord4 a quarter of the way to nord3; the accent and Play are Frost's nord8 with nord0 on it; Aurora's nord14 and nord13 are done and attention.

**Light.** The stage is nord6, rows and the sidebar nord5, hairlines nord3 at 25%; words nord0, the second voice nord3, faint words between nord3 and nord4.

Nord's palette is soft, and some of its colours do not read where the apps draw them. Each is moved to the nearest tone of its own hue that does, with room rather than by a hair (sdk/SPEC.md, section 12, "The rules"):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Dark | `text.muted` | nord4 `#d8dee9` | `#bbc1cf` | nord4 was within a step of the words (1.17:1); toward nord3 it is a second voice, and reads with room on menus and on the player |
| Dark | `text.faint` | nord3 `#4c566a` | `#8892a8` | 3:1 with room on nord0 and nord1 |
| Dark | `border` | nord3 `#4c566a` | nord6 at 12%, `#eceff41f` | Reads on nord0, nord1 and nord2 alike |
| Dark | `accent.fill.pressed` | nord8 pressed | `#78a7b5` | Its label reads with room under a press |
| Dark | `danger` | nord11 `#bf616a` | `#ffa9af` | 4.5:1 with room on nord0, nord1 and on menus (nord2) |
| Dark | `info` | nord15 `#b48ead` | `#d0a8c8` | Aurora purple, lifted to 4.5:1 with room: nord9 was one more frost beside the accent |
| Light | `text.faint` | (filled) | `#7b8088` | 3:1 with room on nord6 and nord5 |
| Light | `accent`, `accent.fill` | nord10 `#5e81ac` | `#446891` | 4.5:1 with room on nord6 and nord5, and nord6 on it |
| Light | `info` | nord9 `#81a1c1` | `#416c6b` | 4.5:1 on nord6 and nord5, toward nord7's green so that it is not one more slate blue beside the accent |
| Light | `danger` | nord11 `#bf616a` | `#a04953` | 4.5:1 with room on nord6, nord5 and menus |
| Light | `success` | nord14 `#a3be8c` | `#6e8758` | 3.3:1, so a FLAC badge reads on rows |
| Light | `warning` | nord13 `#ebcb8b` | `#997c3d` | 3.3:1 |
| Light | `border` | nord4 `#d8dee9` | nord3 at 25%, `#4c566a40` | nord4 was 1.11:1 on rows |

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are Nord's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
