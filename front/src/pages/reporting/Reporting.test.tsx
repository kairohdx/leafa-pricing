import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../../App'
import { AuthProvider } from '../../auth/AuthProvider'
import { barWidths } from './Analytics'
import { periodParams } from './Filters'

const user = { id: 'u', company_id: 'c', name: 'Ana', username: 'ana', role: 'admin', is_active: true }
const company = { id: 'c', name: 'Ateliê', currency: 'BRL', timezone: 'America/Sao_Paulo', is_active: true }
const summary = { currency: 'BRL', sales_count: 2, final_total: '184467440737095516.14', cost_total: '0.00', cost_coverage: 1 }
const series = { currency: 'BRL', timezone: company.timezone, points: [{ start: '2026-09-15T00:00:00-03:00', sales_count: 2, final_total: summary.final_total }] }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const baseline = async (url: RequestInfo | URL) => {
  if (String(url).endsWith('/auth/me')) return json(user)
  if (String(url).endsWith('/companies/me')) return json(company)
  if (String(url).includes('/analytics/summary')) return json(summary)
  if (String(url).includes('/analytics/sales-series')) return json(series)
  return json({}, 404)
}
const fetchMock = vi.fn<typeof fetch>()
function mount(path = '/indicadores') { render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>) }
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(baseline)
  vi.stubGlobal('fetch', fetchMock)
  sessionStorage.setItem('leafa.session', JSON.stringify({ access_token: 'token', expires_at: new Date(Date.now() + 60000).toISOString() }))
})

it('exibe agregado acima do limite individual, custo zero e cobertura parcial', async () => {
  mount()
  expect(await screen.findByText('BRL 184.467.440.737.095.516,14')).toBeInTheDocument()
  expect(screen.getByText('BRL 0,00')).toBeInTheDocument()
  expect(screen.getByText(/Custo parcial/)).toBeInTheDocument()
  expect(screen.getByRole('table')).toHaveTextContent('184.467.440.737.095.516,14')
})

it('não exibe resumo desatualizado quando uma das consultas falha; permite repetir', async () => {
  let fail = true
  fetchMock.mockImplementation(async (url) => String(url).includes('/analytics/sales-series') && fail ? json({}, 500) : baseline(url))
  mount()
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.queryByLabelText('Resumo do período')).not.toBeInTheDocument()
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByLabelText('Resumo do período')).toBeInTheDocument()
})

it('distingue período vazio e custo indisponível', async () => {
  fetchMock.mockImplementation(async (url) => String(url).includes('/analytics/summary') ? json({ ...summary, sales_count: 0, final_total: '0.00', cost_total: null, cost_coverage: 0 }) : baseline(url))
  mount()
  expect(await screen.findByText('Nenhuma venda concluída neste período e moeda.')).toBeInTheDocument()
  expect(screen.getByText('Indisponível')).toBeInTheDocument()
})

it('bloqueia consulta de auditoria por operador antes de chamar a API', async () => {
  fetchMock.mockImplementation(async (url) => String(url).endsWith('/auth/me') ? json({ ...user, role: 'operator' }) : baseline(url))
  mount('/auditoria/private-id')
  expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/audit-events'))).toBe(false)
})

it('apresenta evento ausente e opção de retorno', async () => {
  mount('/auditoria/missing')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não encontramos este registro')
  expect(screen.getByRole('link', { name: 'Voltar aos eventos' })).toBeInTheDocument()
})

it('dimensiona barras sem converter valores monetários grandes para ponto flutuante', () => {
  expect(barWidths(['0.00', '92233720368547758.07', '184467440737095516.14'])).toEqual([0, 50, 100])
  expect(barWidths(['0.00', '0.00'])).toEqual([0, 0])
})

it('valida limite de 366 dias e preserva offsets do período', () => {
  const data = new FormData()
  data.set('start', '2024-01-01T00:00:00-03:00'); data.set('end', '2025-01-01T00:00:00-03:00')
  expect(periodParams(data, true).get('start')).toBe('2024-01-01T00:00:00-03:00')
  data.set('end', '2025-01-01T00:00:01-03:00')
  expect(() => periodParams(data, true)).toThrow()
  expect(() => periodParams(data, false)).not.toThrow()
  data.set('end', '2024-01-01T00:00:00-03:00')
  expect(() => periodParams(data, false)).toThrow()
})
