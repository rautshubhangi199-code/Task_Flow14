/**
 * Taskflow Django REST client.
 * Envelope: { success, status, message, data } | { success:false, errors }
 */
import { API_ENDPOINTS } from '../Network/apiEndpoints'

export const API_BASE_URL: string = API_ENDPOINTS.BASE_URL.replace(/\/$/, '') || '/api'

const TOKEN_KEY = 'taskflow_access_token'

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAccessToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function queryString(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return ''
  const u = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    u.set(key, String(value))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

export class ApiError extends Error {
  status: number
  errors: unknown
  constructor(message: string, status: number, errors?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

type Envelope<T> = {
  success?: boolean
  status?: number
  message?: string
  data?: T
  errors?: unknown
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const url = `${API_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let json: Envelope<T> | T | null = null
  const text = await res.text()
  if (text) {
    try {
      json = JSON.parse(text) as Envelope<T>
    } catch {
      json = null
    }
  }

  if (json && typeof json === 'object' && 'success' in json) {
    const env = json as Envelope<T>
    if (env.success === false || (!res.ok && env.success !== true)) {
      throw new ApiError(env.message || `${method} ${path} failed`, env.status ?? res.status, env.errors)
    }
    return (env.data !== undefined ? env.data : (env as unknown as T)) as T
  }

  if (!res.ok) {
    throw new ApiError(`${method} ${path} failed: ${res.status}`, res.status, json)
  }
  return json as T
}

export const http = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | null | undefined>) =>
    request<T>('GET', `${path}${queryString(params)}`),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, params?: Record<string, string | number | boolean | null | undefined>) =>
    request<T>('DELETE', `${path}${queryString(params)}`),
}

export function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>
    for (const key of ['results', 'items', 'users', 'projects', 'data', 'records', 'organizations', 'sprints', 'notifications', 'filters']) {
      if (Array.isArray(rec[key])) return rec[key] as T[]
    }
  }
  return []
}

export function asRecord(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>
  return {}
}
