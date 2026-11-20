# Nord

A Songstress theme in [Nord](https://www.nordtheme.com)'s palette: Polar Night for dark and Snow Storm for light, as Nord itself pairs them, in one theme that follows the phone's appearance.

**Dark.** The stage is nord0, rows, cards and the sidebar nord1, menus nord2, hairlines nord6 at 12%; words nord6, the second voice nord4 a quarter of the way to nord3; the accent and Play are Frost's nord8 with nord0 on it; Aurora's nord14 and nord13 are done and attention.

**Light.** The stage is nord6, rows and the sidebar nord5, hairlines nord3 at 25%; words nord0, the second voice nord3; faint words are left for Songstress to fill from them.

Nord's palette is soft, and some of its colours do not read where the apps draw them. Each is moved to the nearest tone of its own hue that does (SPEC.md, section 12, "The rules"):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Dark | `text.muted` | nord4 `#d8dee9` | `#b5bcc9` | nord4 was within a step of the words (1.17:1); a quarter of the way to nord3 it is a second voice |
| Dark | `text.faint` | nord3 `#4c566a` | `#838da3` | 3:1 on nord0 and nord1 |
| Dark | `border` | nord3 `#4c566a` | nord6 at 12%, `#eceff41f` | Reads on nord0, nord1 and nord2 alike |
| Dark | `danger` | nord11 `#bf616a` | `#fb919a` | 4.5:1 on nord0 and nord1 |
| Dark | `info` | nord9 `#81a1c1` | `#91b1d2` | 4.5:1 on nord1 |
| Light | `accent`, `accent.fill` | nord10 `#5e81ac` | `#476a94` | 4.5:1 on nord6 and nord5, and nord6 on it |
| Light | `info` | nord9 `#81a1c1` | `#416c6b` | 4.5:1 on nord6 and nord5, toward nord7's green so that it is not one more slate blue beside the accent |
| Light | `danger` | nord11 `#bf616a` | `#a34b55` | 4.5:1 on nord6 and nord5 |
| Light | `success` | nord14 `#a3be8c` | `#708a5a` | 3.3:1, so a FLAC badge reads on rows |
| Light | `warning` | nord13 `#ebcb8b` | `#997c3d` | 3.3:1 |
| Light | `border` | nord4 `#d8dee9` | nord3 at 25%, `#4c566a40` | nord4 was 1.11:1 on rows |

The player keeps Songstress's own dark neutrals over its artwork, in nord8, and Wrapped, share cards and the first run stay Songstress's own, as they do under every theme.

The colours are Nord's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
