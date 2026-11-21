# Tokyo Night

Tokyo Night's city lights after dark, and Tokyo Night Light for the day. Songstress's themes in [Tokyo Night](https://github.com/enkia/tokyo-night-vscode-theme)'s palette, each look's colours by the palette's own roles:

**Tokyo Night, dark.**

| Token | Tokyo Night |
|---|---|
| `background` | Editor Background (Night) |
| `sidebar` | Side Bar |
| `surface` | Editor Background (Storm) |
| `surface.raised` | Storm, a step up |
| `border` | Variables at 12% |
| `text` | Variables |
| `text.muted` | Markdown Text |
| `text.faint` | Comments |
| `accent` | Function names |
| `accent.fill` | Function names |
| `accent.onFill` | Editor Background (Night) |
| `success` | Strings |
| `warning` | Function parameters |
| `danger` | This keyword |
| `info` | Object literal keys |

**Tokyo Night, light.**

| Token | Tokyo Night |
|---|---|
| `background` | Editor Background |
| `sidebar` | Side Bar |
| `surface` | Side Bar |
| `surface.raised` | List hover |
| `border` | Editor Foreground at 16% |
| `text` | Editor Foreground |
| `text.muted` | Markdown Text |
| `text.faint` | Comments |
| `accent` | Function names |
| `accent.fill` | Function names |
| `accent.onFill` | Button foreground |
| `success` | Strings |
| `warning` | Function parameters |
| `danger` | This keyword |
| `info` | Object literal keys |

Hairlines are the words' colour at a low alpha, so they read on the stage, on rows and on menus alike. What a look leaves out, Songstress fills from its own colours (sdk/SPEC.md, section 12).

Some colours are moved off the palette to the nearest tone of their own hue that reads where the apps draw them, with room rather than by a hair, on the stage, on menus and on the player (sdk/SPEC.md, section 12, "The rules"; and the official bar: words near 7:1, an accent label that reads on rows, a light look's status colours at 3:1, a second voice apart from the words):

| Look | Token | Palette | Here | Why |
|---|---|---|---|---|
| Tokyo Night, Dark | `text.faint` | Comments `#565f89` | `#6c75a0` | 3.0:1 with room, on the stage, rows |
| Tokyo Night, Dark | `danger` | This keyword `#f7768e` | `#fa7991` | 4.5:1 with room, on the stage, rows, menus |
| Tokyo Night, Light | `text` | Editor Foreground `#343b58` | `#2b324f` | the words a step darker, so the second voice stands apart (1.5 between them) |
| Tokyo Night, Light | `text.muted` | Markdown Text `#40434f` | `#424551` | a second voice apart from the words (it was within a step of them) |

The full player follows the theme, as every screen does: the look showing, its words on its own stage laid over the cover, held to the rules there. Wrapped, share cards, the first run and supporters' medals stay Songstress's own, as they do under every theme.

The colours are Tokyo Night's, under the MIT License (`NOTICE`); this extension is MIT too (`LICENSE`).
