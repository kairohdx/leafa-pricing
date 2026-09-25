import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { AuthProvider } from './AuthProvider'

const user = { id: 'user-one', company_id: 'company-one', name: 'Ana Silva', username: 'ana', email: 'ana@example.com', phone: '', role: 'admin', is_active: true }
const company = { id: 'company-one', name: 'Ateliê da Ana', slug: 'atelie', currency: 'BRL', timezone: 'America/Sao_Paulo', is_active: true }
const token = { access_token: 'test-token', token_type: 'bearer', expires_at: new Date(Date.now() + 60_000).toISOString() }
const fetchMock = vi.fn<typeof fetch>()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function mount(path = '/') { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>) }

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith('/auth/login')) return json(token)
    if (String(url).endsWith('/auth/me')) return json(user)
    if (String(url).endsWith('/companies/me')) return json(company)
    return new Response(null, { status: 204 })
  })
})

describe('Sessão e navegação', () => {
  it('protege URL direta e volta ao destino depois do login', async () => {
    mount('/empresa')
    const events = userEvent.setup()
    await events.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await events.type(screen.getByLabelText('Senha', { exact: true }), 'password123')
    await events.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))
    expect(await screen.findByRole('heading', { name: 'Minha empresa' })).toBeInTheDocument()
    const login = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/login'))!
    expect(JSON.parse(login[1]!.body as string)).toEqual({ email: 'ana@example.com', password: 'password123' })
    const me = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/me'))!
    expect(new Headers(me[1]!.headers).get('Authorization')).toBe('Bearer test-token')
  })

  it('restaura a sessão consultando a API e limpa os dados ao sair', async () => {
    sessionStorage.setItem('leafa.session', JSON.stringify(token))
    mount()
    expect(await screen.findByRole('heading', { name: /Olá, Ana/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(await screen.findByRole('button', { name: 'Entrar na minha conta' })).toBeInTheDocument()
    expect(sessionStorage.getItem('leafa.session')).toBeNull()
    expect(screen.queryByText(company.name)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/auth/logout') && options?.method === 'POST')).toBe(true)
  })

  it('remove sessão revogada e não apresenta dados da empresa', async () => {
    sessionStorage.setItem('leafa.session', JSON.stringify(token))
    fetchMock.mockResolvedValue(json({}, 401))
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sua sessão expirou ou foi revogada')
    expect(sessionStorage.getItem('leafa.session')).toBeNull()
    expect(screen.queryByText(company.name)).not.toBeInTheDocument()
  })

  it('permite tentar novamente quando a API está indisponível durante restauração', async () => {
    sessionStorage.setItem('leafa.session', JSON.stringify(token))
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    mount()
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: /Olá, Ana/ })).toBeInTheDocument()
  })

  it('mantém email e mostra erro de credenciais sem armazenar senha', async () => {
    fetchMock.mockResolvedValue(json({}, 401))
    mount('/login')
    await userEvent.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await userEvent.type(screen.getByLabelText('Senha', { exact: true }), 'incorrect')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha incorretos')
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    expect(sessionStorage.length).toBe(0)
  })

  it('não afirma logout se a revogação falhar; permite nova tentativa', async () => {
    sessionStorage.setItem('leafa.session', JSON.stringify(token))
    mount()
    await screen.findByRole('heading', { name: /Olá, Ana/ })
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível encerrar a sessão')
    expect(sessionStorage.getItem('leafa.session')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    await screen.findByRole('button', { name: 'Entrar na minha conta' })
  })

  it('expira a sessão durante uso e remove informações da tela', async () => {
    vi.useFakeTimers()
    try {
      sessionStorage.setItem('leafa.session', JSON.stringify({ ...token, expires_at: new Date(Date.now() + 1000).toISOString() }))
      mount()
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(screen.getByRole('heading', { name: /Olá, Ana/ })).toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(1100) })
      expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou')
      expect(sessionStorage.getItem('leafa.session')).toBeNull()
    } finally { vi.useRealTimers() }
  })

  it('expira também sessões maiores que o limite de um temporizador do navegador', async () => {
    vi.useFakeTimers()
    try {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      sessionStorage.setItem('leafa.session', JSON.stringify({ ...token, expires_at: new Date(Date.now() + thirtyDays).toISOString() }))
      mount()
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      await act(async () => { await vi.advanceTimersByTimeAsync(thirtyDays - 1) })
      expect(screen.getByRole('heading', { name: /Olá, Ana/ })).toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(2) })
      expect(sessionStorage.getItem('leafa.session')).toBeNull()
      expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou')
    } finally { vi.useRealTimers() }
  })

  it('oculta módulos administrativos para operador e atende rota desconhecida', async () => {
    sessionStorage.setItem('leafa.session', JSON.stringify(token))
    fetchMock.mockImplementation(async (url) => String(url).endsWith('/auth/me') ? json({ ...user, role: 'operator' }) : json(company))
    mount('/nao-existe')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Este caminho não existe.' })).toBeInTheDocument())
    expect(screen.queryByText('Auditoria')).not.toBeInTheDocument()
    expect(screen.queryByText('Usuários')).not.toBeInTheDocument()
  })
})
