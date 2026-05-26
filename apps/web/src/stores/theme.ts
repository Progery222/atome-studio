import { create } from "zustand";

export type Theme = "dark" | "light";
const KEY = "atome_theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

const initial = ((): Theme => {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return "dark";
})();

applyTheme(initial);

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    set({ theme: next });
  },
  setTheme: (t) => {
    applyTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
    set({ theme: t });
  },
}));
