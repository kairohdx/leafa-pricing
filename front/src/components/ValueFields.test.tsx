import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MoneyField } from './ValueFields'
import { decimalText, moneyText, pastedMoney } from '../pages/catalog/decimals'
import { dateBoundary, localDateTime, zonedInstant } from './dates'

function Example({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <><MoneyField label="Valor" currency="BRL" value={value} onChange={setValue} required /><output data-testid="value">{value}</output></>
}
describe('valores exatos', () => {
  it('acumula centavos e aceita vírgula explícita', async () => {
    const user = userEvent.setup(); render(<Example />)
    const input = screen.getByLabelText('Valor')
    await user.type(input, '1234'); expect(input).toHaveValue('12,34')
    await user.keyboard('{Backspace}'); expect(input).toHaveValue('1,23')
    await user.clear(input); expect(input).toHaveValue('')
    await user.type(input, '12,34'); expect(screen.getByTestId('value')).toHaveTextContent('12.34')
  })
  it('preserva valor existente, seleção e colagem inteira', async () => {
    const user = userEvent.setup(); render(<Example initial="130.00" />)
    const input = screen.getByLabelText('Valor')
    await user.click(input); expect(screen.getByTestId('value')).toHaveTextContent('130.00')
    await user.keyboard('{Control>}a{/Control}'); await user.paste('1234')
    expect(screen.getByTestId('value')).toHaveTextContent('1234.00')
    await user.clear(input); await user.paste('R$ 1.234,56')
    expect(screen.getByTestId('value')).toHaveTextContent('1234.56')
    await user.paste('-10'); expect(input).toBeInvalid()
  })
  it('não perde precisão nem transforma quantidade pequena em zero', () => {
    expect(pastedMoney('92233720368547758,07')).toBe('92233720368547758.07')
    expect(() => pastedMoney('92233720368547758,08')).toThrow()
    expect(() => pastedMoney('1,234.56')).toThrow()
    expect(moneyText('9007199254740993.12', 'USD')).toBe('US$ 9.007.199.254.740.993,12')
    expect(decimalText('0.000001')).toBe('0,000001')
    expect(decimalText('2.000000')).toBe('2')
    expect(moneyText('0.000001', 'BRL')).toBe('menos de R$ 0,01')
  })
  it('mantém caret e substitui apenas o trecho selecionado', async () => {
    const user = userEvent.setup(); render(<Example initial="1234.56" />)
    const input = screen.getByLabelText('Valor') as HTMLInputElement
    await user.click(input)
    input.setSelectionRange(1, 3)
    await user.keyboard('9')
    expect(input).toHaveValue('194,56')
    await user.keyboard('{Home}{Delete}')
    expect(input).toHaveValue('94,56')
    input.setSelectionRange(0, 2)
    await user.paste('12')
    expect(input).toHaveValue('12,56')
    await user.keyboard('{End}{ArrowLeft}{Backspace}')
    expect(input).toHaveValue('1,26')
  })
  it('distingue vazio obrigatório, zero e limite excedido sem truncar', async () => {
    const user = userEvent.setup(); render(<Example />)
    const input = screen.getByLabelText('Valor')
    expect(input).toBeInvalid()
    await user.type(input, '0'); expect(input).toBeValid()
    await user.clear(input); await user.paste('92233720368547758,08')
    expect(input).toBeInvalid(); expect(input).toHaveValue('')
    await user.paste('92233720368547758,07')
    expect(input).toBeValid(); expect(input).toHaveValue('92233720368547758,07')
  })
})
describe('datas no fuso da empresa', () => {
  it('converte sem depender do fuso do navegador', () => {
    expect(zonedInstant('2026-09-23T10:00', 'America/Sao_Paulo')).toBe('2026-09-23T13:00:00.000Z')
    expect(localDateTime('2026-09-23T13:00:00Z', 'Europe/Lisbon')).toBe('2026-09-23T14:00')
  })
  it('inclui o último dia mesmo quando ele tem 23 horas', () => {
    const start = dateBoundary('2026-03-08', 'America/New_York')
    const end = dateBoundary('2026-03-08', 'America/New_York', true)
    expect(Date.parse(end) - Date.parse(start)).toBe(23 * 3600000)
    expect(() => zonedInstant('2026-03-08T02:30', 'America/New_York')).toThrow()
  })
})
