# Dracula

A Songstress theme in the [Dracula Theme](https://draculatheme.com)'s palettes: Dracula Classic for dark and Alucard Classic for light, as its specification pairs them, in one theme that follows the phone's appearance.

**Dark.** The stage is Background, the sidebar Background Dark, rows, cards and menus Background Light, hairlines Foreground at 12%, the pressed wash Current Line at 20%; words Foreground; the accent and Play Purple, with Background Darker on it; Green, Orange and Cyan for done, attention and work in progress.

**Light.** The same parts in Alucard Classic's: Background, Background Lighter, Floating interactive elements, Selection, Current Line at 12%; Foreground, Comment as the second voice; Purple with Background on it; Green, Orange and Cyan. Faint words sit between Comment and Selection.

These colours are moved to a tone that reads where the apps draw them, with room rather than by a hair (sdk/SPEC.md, section 12, "The rules"):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Dark | `surface.raised` | Background Lighter `#424450` | Background Light `#343746` | Menus as rows are, as Songstress's own sheets sit barely above its cards. On Background Lighter the second voice read 4.7:1 and the faint words 2.9:1, and the apps, lifting both to read as words there, made them one colour; on Background Light the second voice reads 5.8:1 and the faint words stay a step below it |
| Dark | `text.muted` | Comment `#6272a4` | `#adb5cb`, Comment and Foreground in equal parts | 4.5:1 on Background and Background Light; Comment raised in its own hue read as a link in every caption |
| Dark | `text.faint` | Comment `#6272a4` | `#828ba8` | 3:1 on Background Light, at half Comment's colour |
| Dark | `border` | Selection `#44475a` | Foreground at 12%, `#f8f8f21f` | Selection was 1.06:1 on menus |
| Dark | `danger` | Red `#ff5555` | `#ff9c96` | 4.5:1 with room on Background Light and on menus |
| Light | `text.muted` | Comment `#6c664b` | `#676247` | 4.5:1 with room on menus and on the player over a dark cover |
| Light | `text.faint` | (filled) | `#84827a` | 3:1 with room on Floating interactive elements |
| Light | `danger` | Red `#cb3a2a` | `#c13224` | 4.5:1 with room on Floating interactive elements and on menus |

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are the Dracula Theme's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
