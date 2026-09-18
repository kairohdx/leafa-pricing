import { describe, expect, it } from 'vitest'
import { decimalInput, decimalText } from './decimals'
import { ApiError } from '../../api/client'

describe('decimais exatos do catálogo', () => {
  it.each([
    ['money', '9007199254740993,01', '9007199254740993.01'],
    ['money', '92233720368547758.07', '92233720368547758.07'],
    ['money', '00070,25', '70.25'],
    ['money', '0', '0'],
    ['quantity', '9223372036854.775807', '9223372036854.775807'],
    ['quantity', '0,000001', '0.000001'],
  ] as const)('preserva %s: %s', (kind, value, expected) => {
    expect(decimalInput(value, kind, 'value')).toBe(expected)
  })
  it.each([
    ['money', '92233720368547758.08'], ['quantity', '9223372036854.775808'],
    ['money', '1.001'], ['quantity', '1.0000001'], ['quantity', '0'],
    ['money', '-1'], ['money', '1.000,00'], ['quantity', '1e6'],
    ['money', 'Infinity'], ['money', 'NaN'], ['quantity', ''],
  ] as const)('rejeita %s: %s sem arredondar', (kind, value) => {
    expect(() => decimalInput(value, kind, 'value')).toThrow(ApiError)
  })
  it('formata valores maiores que inteiros seguros sem converter para Number', () => {
    expect(decimalText('9007199254740993.01')).toBe('9.007.199.254.740.993,01')
    expect(decimalText('0.000001')).toBe('0,000001')
  })
})
