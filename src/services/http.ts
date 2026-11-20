/**
 * HTTP client placeholder for the future Django REST backend.
 * When the backend is ready, set VITE_API_URL (e.g. http://localhost:8000/api) and
 * re-implement the functions in ./api.ts with `http.get/post/patch/delete` calls.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  return (await res.json()) as T
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
