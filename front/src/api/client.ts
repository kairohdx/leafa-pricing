export type FieldError = { field: string; code: string }

export class ApiError extends Error {
  constructor(public status: number, public fields: FieldError[] = [], public requestId?: string, detail?: string) {
    const messages: Record<number, string> = {
      0: 'Não foi possível conectar. Verifique sua conexão e tente novamente.',
      401: 'Sua sessão expirou ou foi revogada. Entre novamente.',
      403: 'Você não tem permissão para realizar esta ação.',
      404: 'Não encontramos este registro.',
      409: 'Os dados entraram em conflito. Atualize a página e tente novamente.',
      422: 'Confira os campos informados e tente novamente.',
    }
    super(detail || messages[status] || 'O serviço está indisponível no momento. Tente novamente.')
  }
}

const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...init } = options
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: 'no-store' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.field_errors || [], body.request_id,
      response.status === 422 && path.startsWith('/pricing-rules') && typeof body.message === 'string' ? body.message : undefined)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir. Tente novamente.'
}
