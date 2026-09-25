import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../../App'
import { AuthProvider } from '../../auth/AuthProvider'

const user = { id: 'u1', company_id: 'c1', name: 'Carla', username: 'carla', email: 'carla@example.com', phone: '', role: 'admin', is_active: true }
const company = { id: 'c1', name: 'Ateliê Carla', slug: 'carla', currency: 'BRL', timezone: 'America/Sao_Paulo', is_active: true }
const material = { id: 'm1', company_id: 'c1', name: 'Resina', sku: 'RES', notes: 'Antigas', purchase_quantity: '1.000000', purchase_cost: '50.00', purchase_unit_code: 'kg', archived_at: null }
const units = [
  { id: 'kg-id', code: 'kg', name: 'Quilograma', symbol: 'kg', dimension_id: 'mass' },
  { id: 'g-id', code: 'g', name: 'Grama', symbol: 'g', dimension_id: 'mass' },
  { id: 'm-id', code: 'm', name: 'Metro', symbol: 'm', dimension_id: 'length' },
]
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const page = (items: unknown[], has_next = false) => ({ items, page: 1, page_size: 10, total: items.length, total_pages: has_next ? 2 : 1, has_next, has_previous: false })
const baseline = async (url: RequestInfo | URL) => {
  const path = String(url)
  if (path.endsWith('/auth/me')) return json(user)
  if (path.endsWith('/companies/me')) return json(company)
  if (path.includes('/units?')) return json(page(units))
  if (path.endsWith('/materials/m1')) return json(material)
  if (path.endsWith('/cost')) return json({ base_cost: null, reason: 'Custo indisponível.', components: [] })
  return json(page([]))
}
const fetchMock = vi.fn<typeof fetch>()
function mount(path: string) { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>) }
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(baseline)
  vi.stubGlobal('fetch', fetchMock)
  sessionStorage.setItem('leafa.session', JSON.stringify({ access_token: 'token', expires_at: new Date(Date.now() + 60000).toISOString() }))
})

it('preserva decimal no payload, trata conflito e mantém campos do material', async () => {
  fetchMock.mockImplementation(async (url, options) => options?.method === 'POST' ? json({}, 409) : baseline(url))
  mount('/materiais/novo')
  await userEvent.type(await screen.findByLabelText('Nome', { exact: true }), 'Resina')
  await userEvent.selectOptions(screen.getByLabelText('Unidade de compra'), 'kg')
  await userEvent.clear(screen.getByLabelText('Quantidade de compra'))
  await userEvent.type(screen.getByLabelText('Quantidade de compra'), '0,000001')
  await userEvent.clear(screen.getByLabelText('Custo da compra'))
  await userEvent.type(screen.getByLabelText('Custo da compra'), '9007199254740993,01')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar material' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('SKU')
  const body = JSON.parse(fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')![1]!.body as string)
  expect(body.purchase_quantity).toBe('0.000001')
  expect(body.purchase_cost).toBe('9007199254740993.01')
  expect(screen.getByLabelText('Custo da compra')).toHaveValue('9007199254740993,01')
})

it('filtra dimensões na edição e limpa campos opcionais com null', async () => {
  fetchMock.mockImplementation(async (url, options) => options?.method === 'PATCH' ? json({ ...material, sku: null, notes: null }) : baseline(url))
  mount('/materiais/m1')
  await userEvent.click(await screen.findByRole('button', { name: 'Editar material' }))
  expect(screen.queryByRole('option', { name: 'm — Metro' })).not.toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'g — Grama' })).toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText('SKU'))
  await userEvent.clear(screen.getByLabelText('Observações'))
  await userEvent.click(screen.getByRole('button', { name: 'Salvar material' }))
  await screen.findByText('Registro atualizado.')
  const body = JSON.parse(fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')![1]!.body as string)
  expect(body).toEqual({ sku: null, notes: null })
})

it('carrega unidades de todas as páginas do catálogo global', async () => {
  fetchMock.mockImplementation(async (url) => {
    const path = String(url)
    if (path.includes('/units?page=1')) return json(page([units[2]], true))
    if (path.includes('/units?page=2')) return json(page([units[0], units[1]]))
    return baseline(url)
  })
  mount('/materiais/novo')
  expect(await screen.findByRole('option', { name: 'kg — Quilograma' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'm — Metro' })).toBeInTheDocument()
})

it('catálogo de unidades vazio impede gravação e explica como prosseguir', async () => {
  fetchMock.mockImplementation(async (url) => String(url).includes('/units?') ? json(page([])) : baseline(url))
  mount('/materiais/novo')
  expect(await screen.findByText(/Nenhuma unidade compatível disponível/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvar material' })).toBeDisabled()
})

it('operador não recebe formulário de criação por URL direta', async () => {
  fetchMock.mockImplementation(async (url) => String(url).endsWith('/auth/me') ? json({ ...user, role: 'operator' }) : baseline(url))
  mount('/servicos/novo')
  expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Salvar serviço' })).not.toBeInTheDocument()
})

it('material arquivado na composição pode ser removido, mas não editado', async () => {
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith('/materials/m1')) return json({ ...material, archived_at: '2026-09-16T12:00:00Z' })
    if (String(url).endsWith('/products/p1')) return json({ id: 'p1', name: 'Peça', sku: null, description: null, archived_at: null, materials: [{ id: 'part', product_id: 'p1', material_id: 'm1', quantity: '1.000000', unit_code: 'g' }] })
    return baseline(url)
  })
  mount('/produtos/p1')
  expect(await screen.findByText('Material arquivado', { exact: true })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remover componente' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar componente' })).not.toBeInTheDocument()
  expect(screen.getByText(/Custo indisponível/)).toBeInTheDocument()
})

it('URL de embalagem vinculada a outro material não revela seu detalhe', async () => {
  fetchMock.mockImplementation(async (url) => String(url).endsWith('/material-packages/pkg1') ? json({ id: 'pkg1', material_id: 'other', name: 'Embalagem de outro material' }) : baseline(url))
  mount('/materiais/m1/embalagens/pkg1')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não encontramos esta embalagem neste material')
  expect(screen.queryByText('Embalagem de outro material')).not.toBeInTheDocument()
})
