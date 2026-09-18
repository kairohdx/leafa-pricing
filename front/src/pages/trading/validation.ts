import { ApiError } from '../../api/client'
import { decimalInput } from '../catalog/decimals'
import type { LineInput } from './types'

export function parametersInput(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    function validate(item: unknown) {
      if (typeof item === 'number' && (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item)))) throw new Error()
      if (item && typeof item === 'object') Object.values(item).forEach(validate)
    }
    validate(value)
    return value as Record<string, unknown>
  } catch { throw new ApiError(422, [{ field: 'parameters', code: 'invalid_json' }]) }
}

// Require an explicit offset: the browser's local timezone must never change the instant.
export function instantInput(value: string, field = 'occurred_at'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value.trim())
  if (match) {
    const [, year, month, day, hour, minute, second, offset] = match
    const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
    const validOffset = offset === 'Z' || (Number(offset.slice(1, 3)) <= 23 && Number(offset.slice(4)) <= 59)
    if (Number(year) >= 100 && Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= days && Number(hour) < 24 && Number(minute) < 60 && Number(second || 0) < 60 && validOffset && Number.isFinite(Date.parse(value))) return value.trim()
  }
  throw new ApiError(422, [{ field, code: 'invalid_datetime' }])
}

export function dateText(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function lineInput(line: LineInput): LineInput {
  return { kind: line.kind, [`${line.kind}_id`]: line[`${line.kind}_id`], quantity: line.quantity, ...(line.unit_code ? { unit_code: line.unit_code } : {}) }
}

export function sameLines(before: LineInput[], after: LineInput[]): boolean {
  const normalized = (lines: LineInput[]) => lines.map((line) => {
    const quantity = decimalInput(line.quantity, 'quantity', 'quantity').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    return { ...lineInput(line), quantity }
  })
  try { return JSON.stringify(normalized(before)) === JSON.stringify(normalized(after)) }
  catch { return false }
}
