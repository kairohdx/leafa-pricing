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

export function decimalText(value: string, precision = 6): string {
  value = rounded(value, precision).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  const [whole, fraction] = value.split('.')
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${fraction ? `,${fraction}` : ''}`
}

export const currencies: Record<string, string> = { BRL: 'R$ — Real brasileiro', USD: 'US$ — Dólar americano', EUR: '€ — Euro' }
export function currencySymbol(currency: string) { return currencies[currency]?.split(' — ')[0] || currency }
export function rounded(value: string, scale: number): string {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
  let units = BigInt(whole + fraction.padEnd(scale, '0').slice(0, scale))
  if ((fraction[scale] || '0') >= '5') units += 1n
  const digits = units.toString().padStart(scale + 1, '0')
  return `${negative && units ? '-' : ''}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`
}
export function moneyText(value: string, currency: string): string {
  if (/^0\.0*[1-9]/.test(value) && BigInt(value.split('.')[0]) === 0n && value.split('.')[1].slice(0, 2) === '00') return `menos de ${currencySymbol(currency)} 0,01`
  const [whole, fraction] = rounded(value, 2).split('.')
  return `${currencySymbol(currency)} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`
}

export function pastedMoney(text: string): string {
  const clean = text.trim().replace(/^(R\$|US\$|€)\s*/, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(clean)) throw new Error('Cole uma quantia como 1.234,56 ou 1234,56.')
  return rounded(decimalInput(clean.replaceAll('.', '').replace(',', '.'), 'money', 'amount'), 2)
}
