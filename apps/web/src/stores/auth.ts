import { create } from 'zustand'

interface AuthState {
  token: string | null
  login:  (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const TOKEN_KEY = 'atome_token'

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),

  login: async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      if (!res.ok) return false
      const data = await res.json() as { access_token: string }
      localStorage.setItem(TOKEN_KEY, data.access_token)
      set({ token: data.access_token })
      return true
    } catch {
      return false
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null })
  },
}))
