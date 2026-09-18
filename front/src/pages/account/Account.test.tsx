import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../auth/AuthProvider'
import { App } from '../../App'

const user = { id: 'admin-id', company_id: 'company-id', name: 'Maria Admin', username: 'maria', email: 'maria@example.com', phone: '', role: 'admin', is_active: true }
const company = { id: 'company-id', name: 'Ateliê Maria', slug: 'atelie-maria', currency: 'BRL', timezone: 'America/Sao_Paulo', is_active: true }
const token = { access_token: 'admin-token', expires_at: new Date(Date.now() + 60_000).toISOString() }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const page = (items: unknown[]) => ({ items, page: 1, page_size: 10, total: items.length, total_pages: items.length ? 1 : 0, has_next: false, has_previous: false })
const fetchMock = vi.fn<typeof fetch>()
const baseline = async (url: RequestInfo | URL) => {
  if (String(url).endsWith('/auth/me')) return json(user)
  if (String(url).endsWith('/companies/me')) return json(company)
  return json(page([]))
}
function mount(path: string) { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>) }
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(baseline)
  vi.stubGlobal('fetch', fetchMock)
  sessionStorage.setItem('leafa.session', JSON.stringify(token))
})

it('preserva formulário em conflito e envia apenas campos alterados da empresa', async () => {
  fetchMock.mockImplementation(async (url, options) => options?.method === 'PATCH' ? json({}, 409) : baseline(url))
  mount('/empresa')
  await userEvent.click(await screen.findByRole('button', { name: 'Editar empresa' }))
  await userEvent.clear(screen.getByLabelText('Identificador da empresa'))
  await userEvent.type(screen.getByLabelText('Identificador da empresa'), 'outra-empresa')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar empresa' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('identificador de empresa já está em uso')
  expect(screen.getByLabelText('Identificador da empresa')).toHaveValue('outra-empresa')
  expect(fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')?.[1]?.body).toBe(JSON.stringify({ slug: 'outra-empresa' }))
})

it('revalidar sessão ao voltar à aba preserva edição de perfil não salva', async () => {
  mount('/perfil')
  const input = await screen.findByLabelText('Nome completo')
  await userEvent.clear(input)
  await userEvent.type(input, 'Edição ainda não salva')
  const count = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/me')).length
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  fireEvent(document, new Event('visibilitychange'))
  await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/me')).length).toBeGreaterThan(count))
  expect(screen.getByLabelText('Nome completo')).toHaveValue('Edição ainda não salva')
})

it('erros de campo do cadastro são associados ao campo sem perder dados', async () => {
  sessionStorage.clear()
  fetchMock.mockResolvedValue(json({ field_errors: [{ field: 'body.company.timezone', code: 'value_error' }] }, 422))
  mount('/cadastro')
  await userEvent.type(await screen.findByLabelText('Nome da empresa'), 'Empresa teste')
  await userEvent.type(screen.getByLabelText('Identificador da empresa'), 'empresa-teste')
  await userEvent.type(screen.getByLabelText('Nome completo'), 'Maria')
  await userEvent.type(screen.getByLabelText('Nome de usuário'), 'maria')
  await userEvent.type(screen.getByLabelText('Email', { exact: true }), 'maria@example.com')
  await userEvent.type(screen.getByLabelText('Senha', { exact: true }), 'password123')
  await userEvent.type(screen.getByLabelText('Confirmar senha', { exact: true }), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Criar minha empresa' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Confira os campos')
  expect(screen.getByLabelText('Fuso horário')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Nome da empresa')).toHaveValue('Empresa teste')
  expect(sessionStorage.length).toBe(0)
})

it('senha atual incorreta mantém sessão; sucesso encerra acesso', async () => {
  let rejected = true
  fetchMock.mockImplementation(async (url) => String(url).endsWith('/users/me/password') ? rejected ? json({}, 403) : new Response(null, { status: 204 }) : baseline(url))
  mount('/perfil/senha')
  await userEvent.type(await screen.findByLabelText('Senha atual'), 'old-password')
  await userEvent.type(screen.getByLabelText('Nova senha', { exact: true }), 'new-password')
  await userEvent.type(screen.getByLabelText('Confirmar nova senha'), 'new-password')
  await userEvent.click(screen.getByRole('button', { name: 'Alterar senha e encerrar sessões' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('senha atual está incorreta')
  expect(sessionStorage.getItem('leafa.session')).not.toBeNull()
  rejected = false
  await userEvent.click(screen.getByRole('button', { name: 'Alterar senha e encerrar sessões' }))
  expect(await screen.findByRole('heading', { name: 'Bom ter você aqui.' })).toBeInTheDocument()
  expect(sessionStorage.getItem('leafa.session')).toBeNull()
})

it('operador não dispara consultas administrativas nem acessa formulário por URL', async () => {
  fetchMock.mockImplementation(async (url) => String(url).endsWith('/auth/me') ? json({ ...user, role: 'operator' }) : baseline(url))
  mount('/usuarios/novo')
  expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Criar usuário' })).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/users'))).toBe(false)
})

it('edição do próprio usuário não oferece alteração de papel, ativação ou redefinição administrativa', async () => {
  fetchMock.mockImplementation(async (url) => String(url).endsWith('/users/admin-id') ? json(user) : baseline(url))
  mount('/usuarios/admin-id')
  expect(await screen.findByRole('heading', { name: 'Esta é a sua conta' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Papel')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Situação')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Redefinir senha' })).not.toBeInTheDocument()
})

it('ignora resposta antiga ao trocar filtros enquanto há consulta em andamento', async () => {
  let resolveOld: (response: Response) => void = () => {}
  fetchMock.mockImplementation(async (url) => {
    const path = String(url)
    if (path.includes('/users?') && !path.includes('search=')) return new Promise<Response>((resolve) => { resolveOld = resolve })
    if (path.includes('/users?')) return json(page([{ ...user, id: 'new', name: 'Novo resultado' }]))
    return baseline(url)
  })
  mount('/usuarios')
  await userEvent.type(await screen.findByLabelText('Buscar usuário'), 'novo')
  await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
  await screen.findByText('Novo resultado')
  await act(async () => resolveOld(json(page([{ ...user, name: 'Resposta antiga' }]))))
  expect(screen.queryByText('Resposta antiga')).not.toBeInTheDocument()
  expect(screen.getByText('Novo resultado')).toBeInTheDocument()
})

it('401 em consulta de usuários elimina a sessão e desmonta dados privados', async () => {
  fetchMock.mockImplementation(async (url) => String(url).includes('/users?') ? json({}, 401) : baseline(url))
  mount('/usuarios')
  expect(await screen.findByRole('heading', { name: 'Bom ter você aqui.' })).toBeInTheDocument()
  expect(sessionStorage.getItem('leafa.session')).toBeNull()
  expect(screen.queryByText(company.name)).not.toBeInTheDocument()
})
