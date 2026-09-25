import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { RuleSimulator, StrategyFields } from './PricingCalculator'

const api = vi.fn()
const session = vi.hoisted(() => ({ company: { id: 'c', currency: 'BRL' }, user: { id: 'u' } }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ api, identity: session }) }))
const calculation = { status: 'available', base_cost: '100', price_before_adjustment: '130', suggested_price: '130.90', adjustment: '0.90', details: { fees_amount: '0', resulting_margin_percent: '23.6' } }
beforeEach(() => { session.company.id = 'c'; api.mockReset().mockResolvedValue(calculation) })

it('envia decimais ao backend e exibe o resultado retornado pelo motor', async () => {
  render(<RuleSimulator strategy="markup_percent" parameters={{ percentage: '30' }} />)
  expect(await screen.findByText('R$ 130,90', { selector: '.metric-value' })).toBeInTheDocument()
  expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({ strategy_key: 'markup_percent', parameters: { percentage: '30' }, base_cost: '100' })
  await userEvent.clear(screen.getByLabelText('Custo para testar'))
  await userEvent.type(screen.getByLabelText('Custo para testar'), '0,15')
  await waitFor(() => expect(JSON.parse(api.mock.calls.at(-1)![1].body).base_cost).toBe('0.15'))
})

it('mostra somente os parâmetros da estratégia e oferece cinco opções', async () => {
  const change = vi.fn()
  render(<StrategyFields strategy="margin_fees" parameters={{ margin: '20', fees: '15', fixed_cost: '0' }} onChange={change} />)
  expect(screen.getByLabelText('Margem (%)')).toBeInTheDocument()
  expect(screen.getByLabelText('Taxas/comissões (%)')).toBeInTheDocument()
  expect(screen.queryByLabelText('Multiplicador')).not.toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(5)
  await userEvent.click(screen.getByRole('button', { name: /Multiplicar o custo/ }))
  expect(change).toHaveBeenCalledWith('cost_multiplier', { multiplier: '1', rounding: 'none' })
})

it('não transforma cálculo indisponível em zero', async () => {
  api.mockResolvedValue({ status: 'unavailable', reason: 'Sem custo.', base_cost: null, price_before_adjustment: null, suggested_price: null, adjustment: null, details: {} })
  render(<RuleSimulator strategy="markup_percent" parameters={{ percentage: '30' }} />)
  expect(await screen.findByText('Sem custo.')).toBeInTheDocument()
  expect(screen.queryByText('R$ 0')).not.toBeInTheDocument()
  expect(screen.getAllByText('Indisponível').length).toBeGreaterThan(0)
})

it('descarta respostas atrasadas de parâmetros anteriores', async () => {
  let resolveOld: (value: unknown) => void = () => {}
  api.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValue(calculation)
  const view = render(<RuleSimulator strategy="markup_percent" parameters={{ percentage: '10' }} />)
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
  view.rerender(<RuleSimulator strategy="markup_percent" parameters={{ percentage: '30' }} />)
  expect(await screen.findByText('R$ 130,90', { selector: '.metric-value' })).toBeInTheDocument()
  resolveOld({ ...calculation, suggested_price: '110' })
  await waitFor(() => expect(screen.queryByText('R$ 110')).not.toBeInTheDocument())
})

it('mantém resposta anterior durante recálculo e a descarta ao trocar empresa', async () => {
  const view = render(<RuleSimulator strategy="markup_percent" parameters={{ percentage: '30' }} />)
  expect(await screen.findByText('R$ 130,90', { selector: '.metric-value' })).toBeInTheDocument()
  api.mockImplementation(() => new Promise(() => {}))
  view.rerender(<RuleSimulator strategy="markup_percent" parameters={{ percentage: '40' }} />)
  expect(screen.getByText('Atualizando… Resultado anterior.')).toBeInTheDocument()
  expect(screen.getByText('R$ 130,90', { selector: '.metric-value' })).toBeInTheDocument()
  session.company.id = 'another-company'
  view.rerender(<RuleSimulator strategy="markup_percent" parameters={{ percentage: '40' }} />)
  expect(screen.queryByText('R$ 130,90', { selector: '.metric-value' })).not.toBeInTheDocument()
})

it('clicar na estratégia atual não altera parâmetros', async () => {
  const change = vi.fn()
  render(<StrategyFields strategy="markup_percent" parameters={{ percentage: '37.5' }} onChange={change} />)
  await userEvent.click(screen.getByRole('button', { name: /Acréscimo sobre custo/ }))
  expect(change).not.toHaveBeenCalled()
})
