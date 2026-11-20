# Dracula

A Songstress theme in the [Dracula Theme](https://draculatheme.com)'s palettes: Dracula Classic for dark and Alucard Classic for light, as its specification pairs them, in one theme that follows the phone's appearance.

**Dark.** The stage is Background, the sidebar Background Dark, rows and cards Background Light, menus Background Lighter, hairlines Selection, the pressed wash Current Line at 20%; words Foreground; the accent and Play Purple, with Background Darker on it; Green, Orange and Cyan for done, attention and work in progress.

**Light.** The same parts in Alucard Classic's: Background, Background Lighter, Floating interactive elements, Selection, Current Line at 12%; Foreground, Comment as the second voice; Purple with Background on it; Green, Orange and Cyan. Faint words are left for Songstress to fill.

Four colours are moved to the nearest tone of their own hue that reads where the apps draw them (SPEC.md, section 12, "The rules"):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Dark | `text.muted` | Comment `#6272a4` | `#91a1d6` | 4.5:1 on Background and Background Light |
| Dark | `text.faint` | Comment `#6272a4` | `#6f7fb2` | 3:1 on Background Light |
| Dark | `danger` | Red `#ff5555` | `#ff7772` | 4.5:1 on Background Light |
| Light | `danger` | Red `#cb3a2a` | `#c43526` | 4.5:1 on Floating interactive elements |

The player keeps Songstress's own dark neutrals over its artwork, in Purple, and Wrapped, share cards and the first run stay Songstress's own, as they do under every theme.

The colours are the Dracula Theme's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
