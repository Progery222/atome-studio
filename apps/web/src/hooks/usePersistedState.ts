import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

/** useState backed by localStorage. Key convention: `<page>.<field>`. */
export function usePersistedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`atome.ui.${key}`);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(`atome.ui.${key}`, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
