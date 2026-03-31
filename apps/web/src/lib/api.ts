const TOKEN_KEY = 'atome_token'

/**
 * Thin wrapper around fetch that automatically attaches
 * the JWT Bearer token from localStorage to every request.
 */
export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY)

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, { ...init, headers })
}
