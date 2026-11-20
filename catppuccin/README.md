# Catppuccin

Songstress's themes in [Catppuccin](https://catppuccin.com)'s palette (version 1.8.0): **Catppuccin Latte** for light, and **Catppuccin Frappé**, **Macchiato** and **Mocha** for dark. Pick a dark flavour and Latte beside it, and the apps follow the phone's appearance.

Each flavour's colours are Catppuccin's, by its style guide: the stage is Base, the sidebar Mantle, rows and cards Surface 0, menus Surface 1, the pressed wash Overlay 2 at 20% (15% in Latte), words Text, the accent and Play Mauve with Crust on it (Base in Latte), and Green, Yellow, Red and Blue for done, attention, danger and work in progress. The second voice and faint words are Subtext 0 and Overlay 1 in Mocha and Macchiato, Subtext 1 and Overlay 2 in Frappé and Latte; hairlines are Text at 14% in the dark flavours, so they read on the stage, on rows and on menus alike, and Surface 0 in Latte.

These colours are moved off the palette, to the nearest tone of the same hue that reads where the apps draw them (SPEC.md, section 12, "The rules"), or composed from it:

| Flavour | Token | Palette | Here | Why |
|---|---|---|---|---|
| Mocha | `border` | Surface 1 `#45475a` | Text at 14%, `#cdd6f424` | Surface 1 is also the menus': a hairline on a menu was 1.00:1 |
| Macchiato | `border` | Surface 1 `#494d64` | Text at 14%, `#cad3f524` | The same |
| Frappé | `border` | Surface 1 `#51576d` | Text at 14%, `#c6d0f524` | The same |
| Frappé | `accent` | Mauve `#ca9ee6` | `#d0a4ed` | 4.5:1 on Surface 0, where an accent label otherwise falls back to the text; Play keeps Mauve |
| Frappé | `danger` | Red `#e78284` | `#ff9799` | 4.5:1 on Surface 0, where Delete and Sign Out sit |
| Frappé | `info` | Blue `#8caaee` | `#97b5fa` | 4.5:1 on Surface 0 |
| Latte | `accent` | Mauve `#8839ef` | `#8535eb` | 4.5:1 on Mantle, for accent labels on rows; Play keeps Mauve |
| Latte | `danger` | Red `#d20f39` | `#ce0937` | 4.5:1 on Mantle |
| Latte | `info` | Blue `#1e66f5` | `#095eed` | 4.5:1 on Base and Mantle |

Mocha and Macchiato take Subtext 0 and Overlay 1 rather than Subtext 1 and Overlay 2 so that the second voice stands apart from the first, as Songstress's own does; Frappé and Latte keep Subtext 1, since Subtext 0 does not read on their rows.

The player keeps Songstress's own dark neutrals over its artwork, in each flavour's Mauve, and Wrapped, share cards and the first run stay Songstress's own, as they do under every theme: no theme reaches them.

The colours are Catppuccin's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
