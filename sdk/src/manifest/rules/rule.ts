// What every rule is: a look at a manifest that already has the schema's
// shape, reporting what a schema cannot say. A rule never throws and never
// changes the manifest.

import type { Report } from '../codes'
import type { Manifest } from '../types.generated'

/** What a rule may need to know about who is checking. */
export interface RuleContext {
  /** The extension API version of the host that is checking, when one is. */
  readonly apiVersion?: string
}

export type Rule = (manifest: Manifest, report: Report, context: RuleContext) => void
