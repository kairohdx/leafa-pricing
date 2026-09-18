import { ApiError } from '../../api/client'

// No Number/parseFloat: API amounts may exceed JavaScript's safe integer range.
export function decimalInput(value: string, kind: 'money' | 'quantity', field: string): string {
  const normalized = value.trim().replace(',', '.')
  const scale = kind === 'money' ? 2 : 6
  const fail = () => { throw new ApiError(422, [{ field, code: 'decimal_invalid' }]) }
  if (normalized.length > 32 || !/^\d+(?:\.\d+)?$/.test(normalized)) return fail()
  const [integer, fraction = ''] = normalized.split('.')
  if (fraction.length > scale) return fail()
  const scaled = BigInt(integer + fraction.padEnd(scale, '0'))
  if (scaled > 9223372036854775807n || (kind === 'quantity' && scaled === 0n)) return fail()
  return `${integer.replace(/^0+(?=\d)/, '')}${fraction ? `.${fraction}` : ''}`
}

export function decimalText(value: string): string {
  const [whole, fraction] = value.split('.')
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${fraction ? `,${fraction}` : ''}`
}
