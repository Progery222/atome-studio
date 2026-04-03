import { create } from "zustand";

export type Lang = "ru" | "en" | "zh" | "es";

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: (localStorage.getItem("atome_lang") as Lang) ?? "ru",
  setLang: (lang) => {
    localStorage.setItem("atome_lang", lang);
    set({ lang });
  },
}));
