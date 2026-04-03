import { create } from "zustand";

type Role = "super_admin" | "tenant_admin" | "viewer";

interface AuthState {
  token: string | null;
  role: Role;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const TOKEN_KEY = "atome_token";

/** Decode JWT payload without a library */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split(".")[1];
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function roleFromToken(token: string | null): Role {
  if (!token) return "viewer";
  const payload = decodeJwtPayload(token);
  if (
    typeof payload.role === "string" &&
    ["super_admin", "tenant_admin", "viewer"].includes(payload.role)
  ) {
    return payload.role as Role;
  }
  return "tenant_admin"; // default for logged-in users
}

const storedToken = localStorage.getItem(TOKEN_KEY);

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  role: roleFromToken(storedToken),

  login: async (email, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { access_token: string };
      localStorage.setItem(TOKEN_KEY, data.access_token);
      set({ token: data.access_token, role: roleFromToken(data.access_token) });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, role: "viewer" });
  },
}));
