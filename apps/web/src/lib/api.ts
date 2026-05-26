const TOKEN_KEY = "atome_token"; // legacy; read-only during transition

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split(".")[1];
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function isUsableLegacyToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (typeof payload.exp !== "number") return true;
  return payload.exp * 1000 > Date.now() + 30_000;
}

function clearLegacyToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Thin wrapper around fetch:
 * - Sends cookies (httpOnly JWT `at` + CSRF cookie) via credentials: include
 * - Attaches X-CSRF-Token header on unsafe methods from `csrf` cookie
 * - Still sends Bearer from legacy localStorage token if present (soft-migration)
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };

  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (legacyToken && !isUsableLegacyToken(legacyToken)) {
    clearLegacyToken();
  } else if (legacyToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${legacyToken}`;
  }

  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrf = getCookie("csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(url, { ...init, headers, credentials: "include" });

  if (!res.ok) {
    if (res.status === 401) {
      clearLegacyToken();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }

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
