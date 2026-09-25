import { describe, expect, it } from 'vitest'
import { dateText, instantInput, lineInput, parametersInput, sameLines } from './validation'

describe('configurações de estratégia', () => {
  it('mantém valores exatos escritos como strings e objetos aninhados', () => {
    expect(parametersInput('{"price":"9007199254740993.01","nested":[true,null,{"rate":"0.30"}]}')).toEqual({ price: '9007199254740993.01', nested: [true, null, { rate: '0.30' }] })
  })
  it.each(['null', '[]', '1', '{', '{"a":1e999}', '{"a":{"b":9007199254740993}}'])('recusa JSON inválido ou inseguro: %s', (value) => expect(() => parametersInput(value)).toThrow())
})

describe('datas com fuso explícito', () => {
  it.each(['2026-09-16T14:30:00-03:00', '2026-09-16T17:30:00Z', '2024-02-29T00:00+03:00'])('preserva o instante %s', (value) => expect(instantInput(value)).toBe(value))
  it.each(['2026-09-16T14:30', '2026-02-29T00:00:00Z', '2026-04-31T00:00Z', '2026-09-16T24:00Z', '2026-09-16T14:30+03:99', '2026-09-16T14:30+24:00'])('recusa data inválida/sem fuso: %s', (value) => expect(() => instantInput(value)).toThrow())
  it('exibe a data no fuso da empresa', () => expect(dateText('2026-09-16T01:00:00Z', 'America/Sao_Paulo')).toContain('15/09/2026'))
})

it('envia apenas os campos graváveis do item', () => {
  const line = { kind: 'service' as const, service_id: 'service', material_id: null, product_id: null, quantity: '1.000000', unit_code: null, id: 'historical', description_snapshot: 'Histórico', unit_price_snapshot: '15' }
  expect(lineInput(line)).toEqual({ kind: 'service', service_id: 'service', quantity: '1.000000' })
})

it('preserva snapshots quando só muda a formatação da quantidade', () => {
  const original = { kind: 'material' as const, material_id: 'm', quantity: '10.000000', unit_code: 'kg' }
  expect(sameLines([original], [{ ...original, quantity: '010,0' }])).toBe(true)
  expect(sameLines([original], [{ ...original, quantity: '10.000001' }])).toBe(false)
  expect(sameLines([original], [{ ...original, quantity: 'inválido' }])).toBe(false)
  expect(sameLines([original], [])).toBe(false)
})
