// The manifest's JSON Schema, and the closed lists it holds. The schema file
// is the one place a name is written: the lists below, the generated types
// and the validator all read it. The theme tokens alone are written again, in
// songstress/theme (src/theme/tokens.ts), which carries no schema into an
// app; a test holds them to the schema's.

import schema from '../../schema/extension.v1.json'
import themeSchema from '../../schema/theme.v1.json'
import type { SchemaNode } from './json'
import type {
  Category,
  ClientHook,
  Menus,
  PanelLocation,
  Permissions,
  Platform,
  ServerHook,
  SourcesByKind,
  Theme,
} from './types.generated'

export { THEME_TOKENS } from '../theme/tokens'
export type { ThemeToken } from '../theme/tokens'

/** The name of the manifest file, at the root of an extension's package. */
export const MANIFEST_FILE = 'songstress.json'

/** `value`, frozen down to its last leaf. The schema and the lists below are
 * this module's for the life of the process: a caller that changed one would
 * change what every later check accepts. */
function frozen<Value>(value: Value): Value {
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) frozen(inner)
    Object.freeze(value)
  }
  return value
}

/** The manifest's JSON Schema (draft 2020-12). */
export const MANIFEST_SCHEMA: SchemaNode = frozen(schema)

/** The address the schema is published at, and its `$id`. */
export const MANIFEST_SCHEMA_ID: string = schema.$id

/** A theme file's JSON Schema (draft 2020-12): the looks of one theme, which
 * a manifest's theme names by its `path`. Its definitions are the manifest
 * schema's own (the theme tokens). */
export const THEME_FILE_SCHEMA: SchemaNode = frozen(themeSchema)

/** The address the theme file's schema is published at, and its `$id`. */
export const THEME_FILE_SCHEMA_ID: string = themeSchema.$id

/** A permission's name, as the manifest's `permissions` keys it. */
export type PermissionName = keyof Permissions

/** A place a menu item can appear, as `contributes.menus` keys it. */
export type MenuLocation = keyof Menus

/** A kind of provider, as `contributes.providers` keys it. */
export type ProviderKind = keyof SourcesByKind

/** The looks a theme has, as its `appearance` names them. */
export type ThemeAppearance = Theme['appearance']

const defs = schema.$defs

/** Every hook the server entry may listen to, as the schema lists them. */
export const SERVER_HOOKS = defs.serverHook.enum as readonly ServerHook[]
/** Every hook the client entry may listen to, as the schema lists them. */
export const CLIENT_HOOKS = defs.clientHook.enum as readonly ClientHook[]
/** Every category a manifest may list, as the schema lists them. */
export const CATEGORIES = defs.category.enum as readonly Category[]
/** The apps an extension's interface and client code may work in. */
export const PLATFORMS = defs.platform.enum as readonly Platform[]
/** Every screen a panel may be drawn in. */
export const PANEL_LOCATIONS = defs.panelLocation.enum as readonly PanelLocation[]
/** Every permission a manifest may ask for. */
export const PERMISSIONS = Object.keys(defs.permissions.properties) as readonly PermissionName[]
/** Every place a menu item may stand. */
export const MENU_LOCATIONS = Object.keys(defs.menus.properties) as readonly MenuLocation[]
/** Every kind of provider a manifest may declare. */
export const PROVIDER_KINDS = Object.keys(defs.sourcesByKind.properties) as readonly ProviderKind[]
/** A theme's appearances: `dark`, `light` or `both`. */
export const THEME_APPEARANCES = defs.theme.properties.appearance.enum as readonly ThemeAppearance[]
