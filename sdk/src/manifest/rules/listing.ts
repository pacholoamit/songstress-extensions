// What the official list asks of a manifest on top of the rest: the listing
// profile. An extension installed from a link or a file is not held to it.

import { pointerOf } from '../pointer'
import type { Rule } from './rule'

/** The fields a listing cannot do without. */
export const LISTING_FIELDS = ['license', 'repository', 'categories', 'icon', 'screenshots'] as const

/** The licences the official list accepts, as SPDX identifiers. */
export const LISTING_LICENSES: readonly string[] = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'MPL-2.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
]

/** The fewest screenshots a listing shows. The schema holds the most (six). */
export const LISTING_MIN_SCREENSHOTS = 3

// https://github.com/<owner>/<repository>, and nothing after it.
const GITHUB_REPOSITORY = /^https:\/\/github\.com\/[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9._-]{1,100}$/

const requiredFields: Rule = (manifest, report) => {
  for (const field of LISTING_FIELDS) {
    if (manifest[field] !== undefined) continue
    report('LISTING_FIELD_REQUIRED', pointerOf(field), `The official list needs "${field}".`)
  }
}

const license: Rule = (manifest, report) => {
  if (manifest.license === undefined || LISTING_LICENSES.includes(manifest.license)) return
  const message = `"${manifest.license}" is not a licence the official list accepts: ${LISTING_LICENSES.join(', ')}.`
  report('LISTING_LICENSE', '/license', message)
}

const repository: Rule = (manifest, report) => {
  if (manifest.repository === undefined || GITHUB_REPOSITORY.test(manifest.repository)) return
  const message = 'The official list needs a GitHub repository address: https://github.com/owner/name.'
  report('LISTING_REPOSITORY', '/repository', message)
}

const screenshots: Rule = (manifest, report) => {
  const count = manifest.screenshots?.length
  if (count === undefined || count >= LISTING_MIN_SCREENSHOTS) return
  report('LISTING_SCREENSHOTS', '/screenshots', `The official list asks for three to six screenshots, and there are ${count}.`)
}

export const LISTING_RULES: readonly Rule[] = [requiredFields, license, repository, screenshots]
