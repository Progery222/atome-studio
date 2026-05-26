import { create } from "zustand";
import { apiFetch } from "../lib/api";

type Role = "super_admin" | "tenant_admin" | "viewer";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  token: string | null; // legacy; kept so components that read `token` don't crash during migration
  role: Role;
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const TOKEN_KEY = "atome_token";

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split(".")[1];
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function roleFromPayload(payload: Record<string, unknown> | null): Role {
  if (!payload) return "viewer";
  if (
    typeof payload.role === "string" &&
    ["super_admin", "tenant_admin", "viewer"].includes(payload.role)
  ) {
    return payload.role as Role;
  }
  return "tenant_admin";
}

function isExpiredPayload(payload: Record<string, unknown>): boolean {
  if (typeof payload.exp !== "number") return false;
  return payload.exp * 1000 <= Date.now() + 30_000;
}

function readStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (isExpiredPayload(payload)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

const storedToken = readStoredToken();

export const useAuthStore = create<AuthState>((set, get) => ({
  token: storedToken,
  role: roleFromPayload(storedToken ? decodeJwtPayload(storedToken) : null),
  user: null,
  ready: false,

  login: async (email, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { access_token: string; user: AuthUser };
      // Keep legacy localStorage during transition; can be removed next release.
      localStorage.setItem(TOKEN_KEY, data.access_token);
      set({
        token: data.access_token,
        role: roleFromPayload(decodeJwtPayload(data.access_token)),
        user: data.user ?? null,
        ready: true,
      });
      return true;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, role: "viewer", user: null, ready: true });
  },

  hydrate: async () => {
    if (get().ready) return;
    try {
      const res = await apiFetch("/api/auth/me");
      if (!res.ok) {
        set({ ready: true });
        return;
      }
      const data = (await res.json()) as { user: (AuthUser & { role?: string }) | null };
      if (data.user) {
        const role = roleFromPayload(data.user as unknown as Record<string, unknown>);
        set({
          user: { id: data.user.id, email: data.user.email, name: data.user.name },
          role,
          ready: true,
        });
      } else {
        set({ ready: true });
      }
    } catch {
      set({ ready: true });
    }
  },
}));
