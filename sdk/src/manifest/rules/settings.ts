// SETTING_DEFAULT_INVALID, SETTING_RANGE_INVALID and SETTING_OPTION_DUPLICATE:
// a setting must accept its own default.

import type { Report } from '../codes'
import { pointerOf } from '../pointer'
import type { NumberSetting, SelectSetting, Setting, StringSetting } from '../types.generated'
import type { Rule } from './rule'

type At = (...parts: (string | number)[]) => string

function badDefault(at: At, report: Report, why: string): void {
  report('SETTING_DEFAULT_INVALID', at('default'), `The default ${why}.`)
}

function checkString(setting: StringSetting, at: At, report: Report): void {
  const { default: value, maxLength } = setting
  if (value === undefined || maxLength === undefined || Array.from(value).length <= maxLength) return
  badDefault(at, report, `is longer than the setting's own maxLength of ${maxLength}`)
}

function checkNumber(setting: NumberSetting, at: At, report: Report): void {
  const { default: value, minimum, maximum } = setting
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    report('SETTING_RANGE_INVALID', at('maximum'), `The maximum (${maximum}) is below the minimum (${minimum}).`)
  }
  if (value === undefined) return
  if (minimum !== undefined && value < minimum) badDefault(at, report, `(${value}) is below the minimum of ${minimum}`)
  if (maximum !== undefined && value > maximum) badDefault(at, report, `(${value}) is above the maximum of ${maximum}`)
}

function checkSelect(setting: SelectSetting, at: At, report: Report): void {
  const seen = new Set<string>()
  setting.options.forEach((option, index) => {
    if (seen.has(option.value)) {
      const message = `"${option.value}" is already the value of an earlier option.`
      report('SETTING_OPTION_DUPLICATE', at('options', index, 'value'), message)
    }
    seen.add(option.value)
  })
  const value = setting.default
  if (value !== undefined && !seen.has(value)) badDefault(at, report, `("${value}") is not the value of any option`)
}

function checkSetting(setting: Setting, at: At, report: Report): void {
  if (setting.type === 'string') checkString(setting, at, report)
  else if (setting.type === 'number') checkNumber(setting, at, report)
  else if (setting.type === 'select') checkSelect(setting, at, report)
}

export const settings: Rule = (manifest, report) => {
  manifest.contributes?.settings?.forEach((setting, index) => {
    checkSetting(setting, (...parts) => pointerOf('contributes', 'settings', index, ...parts), report)
  })
}
