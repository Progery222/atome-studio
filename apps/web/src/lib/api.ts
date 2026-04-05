const TOKEN_KEY = "atome_token";

/**
 * Thin wrapper around fetch that automatically attaches
 * the JWT Bearer token from localStorage to every request.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.message || data.error || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }

  return res;
}
