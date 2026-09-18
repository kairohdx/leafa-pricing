import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ApiError, errorMessage } from './client'

export type Page<T> = {
  items: T[]; total: number; page: number; page_size: number
  total_pages: number; has_next: boolean; has_previous: boolean
}

export function useResource<T>(path: string, load?: (path: string, signal: AbortSignal) => Promise<T>) {
  const { api, identity } = useAuth()
  const [revision, setRevision] = useState(0)
  const key = `${identity?.company.id}:${identity?.user.id}:${path}:${revision}`
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  useEffect(() => {
    const controller = new AbortController()
    void (load ? load(path, controller.signal) : api<T>(path, { signal: controller.signal })).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, error: errorMessage(error) })
    })
    return () => controller.abort()
  }, [api, path, key, load])
  const current = result.key === key ? result : undefined
  return {
    data: current?.data, error: current?.error,
    loading: !current?.data && !current?.error,
    reload: useCallback(() => setRevision((value) => value + 1), []),
  }
}

export function useFormAction() {
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState('')
  async function run(action: () => Promise<void>, messages: { conflict?: string; forbidden?: string; success?: string } = {}) {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true); setError(''); setFields({}); setSuccess('')
    try {
      await action()
      setSuccess(messages.success || '')
      return true
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return false
      let message = errorMessage(cause)
      if (cause instanceof ApiError) {
        if (cause.status === 409 && messages.conflict) message = messages.conflict
        if (cause.status === 403 && messages.forbidden) message = messages.forbidden
        setFields(Object.fromEntries(cause.fields.map(({ field }) => [field.replace(/^body\./, ''), 'Confira o valor informado.'])))
      }
      setError(message)
      return false
    } finally { inFlight.current = false; setBusy(false) }
  }
  return { busy, error, fields, success, run }
}

export function changes<T extends object>(initial: T, draft: T): Partial<T> {
  return Object.fromEntries(Object.entries(draft).filter(([key, value]) => initial[key as keyof T] !== value)) as Partial<T>
}
