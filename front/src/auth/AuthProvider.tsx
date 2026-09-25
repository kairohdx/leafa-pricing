import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, errorMessage, request } from '../api/client'
import type { Company, Identity, Token, User } from './types'

const storageKey = 'leafa.session'
function readToken(): Token | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as Token | null
    return value && typeof value.access_token === 'string' && Date.parse(value.expires_at) > Date.now() ? value : null
  } catch { return null }
}
function saveToken(token: Token | null) {
  try {
    if (token) sessionStorage.setItem(storageKey, JSON.stringify(token))
    else sessionStorage.removeItem(storageKey)
  } catch { /* Restricted storage: session remains in memory until reload. */ }
}

type AuthState = { status: 'loading' | 'anonymous' | 'authenticated' | 'error'; identity: Identity | null; message: string }
type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
  api: <T>(path: string, options?: RequestInit) => Promise<T>
  updateIdentity: (data: Partial<Identity>) => void
  endSession: (message?: string) => void
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useRef<Token | null>(readToken())
  const generation = useRef(0)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<AuthState>({ status: 'loading', identity: null, message: '' })
  const clear = useCallback((message = '') => {
    generation.current++
    token.current = null
    saveToken(null)
    setState({ status: 'anonymous', identity: null, message })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const current = token.current
    const version = ++generation.current
    if (!current) {
      saveToken(null)
      setState({ status: 'anonymous', identity: null, message: '' })
      return () => controller.abort()
    }
    // Background revalidation must not unmount forms or discard unsaved edits.
    setState((previous) => previous.status === 'authenticated' ? previous : { status: 'loading', identity: null, message: '' })
    void Promise.all([
      request<User>('/auth/me', { token: current.access_token, signal: controller.signal }),
      request<Company>('/companies/me', { token: current.access_token, signal: controller.signal }),
    ]).then(([user, company]) => {
      if (!controller.signal.aborted && version === generation.current) setState({ status: 'authenticated', identity: { user, company }, message: '' })
    }).catch((error: unknown) => {
      if (controller.signal.aborted || version !== generation.current) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) clear(error.message)
      else setState((previous) => previous.status === 'authenticated' ? previous : { status: 'error', identity: null, message: errorMessage(error) })
    })
    return () => controller.abort()
  }, [attempt, clear])

  useEffect(() => {
    if (state.status !== 'authenticated' || !token.current) return
    const expire = () => clear('Sua sessão expirou. Entre novamente.')
    // Keep timer below the browser's signed 32-bit limit, even for long server sessions.
    let timer: number
    const schedule = () => {
      if (!token.current) return
      timer = window.setTimeout(() => {
        if (token.current && Date.parse(token.current.expires_at) <= Date.now()) expire()
        else schedule()
      }, Math.min(Math.max(0, Date.parse(token.current.expires_at) - Date.now()), 2_147_000_000))
    }
    schedule()
    const revalidate = () => { if (document.visibilityState === 'visible') setAttempt((value) => value + 1) }
    document.addEventListener('visibilitychange', revalidate)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', revalidate) }
  }, [state.status, clear])

  const api = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const current = token.current
    if (!current) throw new ApiError(401)
    try {
      const data = await request<T>(path, { ...options, token: current.access_token })
      if (token.current !== current) throw new DOMException('Session changed', 'AbortError')
      return data
    } catch (error) {
      if (token.current === current && error instanceof ApiError && error.status === 401) clear(error.message)
      throw error
    }
  }, [clear])

  const updateIdentity = useCallback((data: Partial<Identity>) => {
    // A read started before this mutation must not overwrite its successful response.
    generation.current++
    setState((previous) => {
      if (!previous.identity) return previous
      if (data.user && data.user.id !== previous.identity.user.id) return previous
      if (data.company && data.company.id !== previous.identity.company.id) return previous
      return { ...previous, identity: { ...previous.identity, ...data } }
    })
  }, [])

  async function login(email: string, password: string) {
    const version = ++generation.current
    const result = await request<Token>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (version !== generation.current) return
    token.current = result
    saveToken(result)
    setAttempt((value) => value + 1)
  }
  async function logout() {
    const current = token.current
    try {
      if (current) await request<void>('/auth/logout', { method: 'POST', token: current.access_token })
      clear()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clear()
      else throw error
    }
  }
  return <AuthContext.Provider value={{ ...state, login, logout, api, updateIdentity, endSession: clear, retry: () => setAttempt((value) => value + 1) }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
