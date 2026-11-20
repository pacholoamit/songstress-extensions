// Commands: the named actions an extension declares in its manifest and
// carries out in code. Menus, buttons, forms and pages run them by id.

import type { MenuLocation } from '../manifest/schema'
import type { Awaitable, Disposable } from './common'
import type { ClientInfo } from './host'
import type { Action, FormValues } from './ui'

/** What a command's handler is told beside its input. */
export interface CommandContext {
  /** The member who ran it. */
  userId: string
  /** How it was run: from a menu, by an action of a page, by a form, by a
   * button of the settings page, or by client code (`commands.execute`). */
  source: 'menu' | 'action' | 'form' | 'settings' | 'code'
  /** The menu it was picked from, when it was. */
  location?: MenuLocation
  /** The app it was run from, when a person ran it. */
  client?: ClientInfo
  /** The form's fields, when a form ran it. */
  values?: FormValues
}

/** What a command leaves behind. Both parts are optional. */
export interface CommandOutcome {
  /** What the app does next, when a person ran the command. */
  action?: Action
  /** What `commands.execute` resolves to, when code ran it. JSON. */
  value?: unknown
}

/** A command's handler. `input` is what the command was run on: the song,
 * album, artist or playlist whose menu it was picked from, or the `input` of
 * the action, the form or the call that ran it. */
export type CommandHandler<Input = unknown> = (
  input: Input,
  context: CommandContext,
) => Awaitable<CommandOutcome | void>

/** Commands: the named actions of the manifest's `contributes.commands`.
 * Both sides; no permission. */
export interface Commands {
  /** Sets the handler of one of the manifest's commands, in the entry the
   * command names in `run`. */
  register<Input = unknown>(id: string, handler: CommandHandler<Input>): Disposable
}

/** Commands as client code has them: it may also run one. */
export interface ClientCommands extends Commands {
  /** Runs one of the extension's own commands, in the entry it names in
   * `run`, for the member signed in here, and resolves to the `value` it
   * left. This is how client code asks its server half for something.
   * Server code has no `execute`: it calls its own functions, and a command
   * it ran would have no member to run for. */
  execute<Value = unknown>(id: string, input?: unknown): Promise<Value | undefined>
}
