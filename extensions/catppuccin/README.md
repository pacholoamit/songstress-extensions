# Catppuccin

Songstress's themes in [Catppuccin](https://catppuccin.com)'s palette (version 1.8.0): **Catppuccin Latte** for light, and **Catppuccin Frappé**, **Macchiato** and **Mocha** for dark. Pick a dark flavour and Latte beside it, and the apps follow the phone's appearance.

Each flavour's colours are Catppuccin's, by its style guide: the stage is Base, the sidebar Mantle, rows, cards and menus Surface 0, the pressed wash Overlay 2 at 20% (15% in Latte), words Text, the accent and Play Mauve with Crust on it (Base in Latte), and Green, Yellow, Red and Blue for done, attention, danger and work in progress. The second voice and faint words are Subtext 0 and Overlay 1 in Mocha and Macchiato, Subtext 1 and Overlay 2 in Frappé and Latte; hairlines are Text at 14% in the dark flavours, so they read on the stage, on rows and on menus alike, and Surface 0 in Latte.

These colours are moved off the palette, to the nearest tone of the same hue that reads where the apps draw them (sdk/SPEC.md, section 12, "The rules"), with room rather than by a hair, on the stage, on menus and on the player; or composed from it:

| Flavour | Token | Palette | Here | Why |
|---|---|---|---|---|
| Mocha | `surface.raised` | Surface 1 `#45475a` | Surface 0 `#313244` | Menus as rows are, as Songstress's own sheets sit barely above its cards. On a half step above (`#383a4c`) Overlay 1 read 3.0:1, and the apps, lifting it to read as words there, brought it up to Subtext 0's 5.0:1: one voice where there were two. On Surface 0 Subtext 0 reads 5.7:1 and the lifted Overlay 1 stays a step below it |
| Mocha | `border` | Surface 1 `#45475a` | Text at 14%, `#cdd6f424` | Surface 1 was also the menus': a hairline on a menu was 1.00:1 |
| Macchiato | `surface.raised` | Surface 1 `#494d64` | Surface 0 `#363a4f` | As Mocha's: on `#393d52` Subtext 0 read 4.8:1 and Overlay 1 3.1:1 |
| Macchiato | `border` | Surface 1 `#494d64` | Text at 14%, `#cad3f524` | As Mocha's |
| Macchiato | `text.faint` | Overlay 1 `#8087a2` | `#838aa5` | 3:1 with room on Surface 0 |
| Macchiato | `danger` | Red `#ed8796` | `#fa91a0` | 4.5:1 with room on menus, where Delete sits |
| Frappé | `surface.raised` | Surface 1 `#51576d` | Surface 0 `#414559` | Menus as rows are: on Surface 1 the second voice and Delete washed out |
| Frappé | `border` | Surface 1 `#51576d` | Text at 14%, `#c6d0f524` | As Mocha's |
| Frappé | `text` | Text `#c6d0f5` | `#dee4ff` | The words lifted, so the second voice stands apart where the player holds it near 6.5:1 |
| Frappé | `text.muted` | Subtext 1 `#b5bfe2` | `#b5bddf` | 4.5:1 with room on menus and on the player |
| Frappé | `accent` | Mauve `#ca9ee6` | `#d3a7f0` | 4.5:1 with room on Surface 0, where an accent label otherwise falls back to the text; Play keeps Mauve |
| Frappé | `danger` | Red `#e78284` | `#ffa0a1` | 4.5:1 with room on Surface 0 and on menus |
| Frappé | `info` | Blue `#8caaee` | `#9ab8fd` | 4.5:1 with room on Surface 0 |
| Latte | `text` | Text `#4c4f69` | `#393d56` | The words darker, so the second voice stands apart where the player holds it |
| Latte | `text.muted` | Subtext 1 `#5c5f77` | `#55586f` | 4.5:1 with room on the player over a dark cover |
| Latte | `accent` | Mauve `#8839ef` | `#8231e8` | 4.5:1 with room on Mantle, for accent labels on rows; Play keeps Mauve |
| Latte | `success` | Green `#40a02b` | `#32921e` | 3:1 with room, so a FLAC badge reads |
| Latte | `warning` | Yellow `#df8e1d` | `#b77100` | 3:1 with room |
| Latte | `danger` | Red `#d20f39` | `#ca0335` | 4.5:1 with room on Mantle and on menus |
| Latte | `info` | Blue `#1e66f5` | `#0059e5` | 4.5:1 with room on Base and Mantle |

Mocha and Macchiato take Subtext 0 and Overlay 1 rather than Subtext 1 and Overlay 2, so that the second voice stands apart from the first as Songstress's own does; Frappé and Latte keep Subtext 1, since Subtext 0 does not read on their rows.

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are Catppuccin's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
