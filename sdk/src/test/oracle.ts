// Ajv, the reference validator for JSON Schema, as the oracle the package's
// own reader is held to. It is a development dependency only: at run time the
// package reads the schema itself (structure.ts says why).

import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import { MANIFEST_SCHEMA } from '../manifest/schema'
import { KEYWORD_CODES } from '../manifest/structure'
import { child } from '../manifest/pointer'

/** Anything Ajv has to say about the schema itself fails the test. */
const strictLogger = {
  log: () => undefined,
  warn: (...words: unknown[]) => {
    throw new Error(`Ajv warns about the schema: ${words.join(' ')}`)
  },
  error: (...words: unknown[]) => {
    throw new Error(`Ajv rejects the schema: ${words.join(' ')}`)
  },
}

const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: true, logger: strictLogger })
const validate = ajv.compile(MANIFEST_SCHEMA)

/** The pair this package reports for one of Ajv's errors, or null for the
 * errors of keywords that only apply others. Two differences are bridged:
 * Ajv points at the object for a missing or unknown field and names the field
 * beside it, where the contract points at the field itself. */
function pairOf(error: ErrorObject): string | null {
  const { keyword, instancePath, params } = error
  if (keyword === 'if') return null
  if (keyword === 'required') return `SCHEMA_REQUIRED ${child(instancePath, params.missingProperty as string)}`
  if (keyword === 'additionalProperties') {
    return `SCHEMA_UNKNOWN_PROPERTY ${child(instancePath, params.additionalProperty as string)}`
  }
  if (!Object.hasOwn(KEYWORD_CODES, keyword)) throw new Error(`Ajv reported a keyword with no code: ${keyword}`)
  return `${KEYWORD_CODES[keyword as keyof typeof KEYWORD_CODES]} ${instancePath}`
}

/** What Ajv finds wrong with `value`, as sorted "CODE /pointer" pairs, each
 * once; or null when Ajv itself throws. It does for a list of objects that
 * must be unique when one has a field named like a method of every object
 * ({"toString": 1}): its comparison calls that field. */
export function oraclePairs(value: unknown): string[] | null {
  try {
    validate(value)
  } catch {
    return null
  }
  const found = (validate.errors ?? []).map(pairOf).filter((pair) => pair !== null)
  return [...new Set(found)].sort()
}
