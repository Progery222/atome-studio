import { useEffect } from "react";
import { useHealthStore } from "../stores/health";

const DEFAULT_INTERVAL = 15_000;

export function useFarmHealth(intervalMs = DEFAULT_INTERVAL) {
  const data = useHealthStore((s) => s.data);
  const lastError = useHealthStore((s) => s.lastError);
  const fetchHealth = useHealthStore((s) => s.fetch);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, intervalMs);
    return () => clearInterval(id);
  }, [fetchHealth, intervalMs]);

  return { data, lastError };
}
