// JSON Pointers (RFC 6901): where in the manifest a problem is. "" is the
// whole document; "/contributes/menus/song~1context/0" is the first item of
// the "song/context" menu.

/** One member name or list index as a pointer token: "~" and "/" are escaped. */
function token(part: string | number): string {
  return String(part).replaceAll('~', '~0').replaceAll('/', '~1')
}

/** The pointer of `parent`'s member `part`. */
export function child(parent: string, part: string | number): string {
  return `${parent}/${token(part)}`
}

/** The pointer that `parts` lead to from the root. */
export function pointerOf(...parts: (string | number)[]): string {
  return parts.reduce<string>(child, '')
}
