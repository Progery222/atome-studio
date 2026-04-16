import { useEffect } from "react";
import { useAutonomyStore } from "../stores/autonomy";

/**
 * Polls autonomy sessions every `intervalMs` milliseconds.
 * Used by PhoneGridPage and AutonomyPage to keep session state fresh.
 */
export function useAutonomyPolling(intervalMs = 3000, activeOnly = false) {
  const fetchAllSessions = useAutonomyStore((s) => s.fetchAllSessions);

  useEffect(() => {
    fetchAllSessions(activeOnly);
    const id = setInterval(() => fetchAllSessions(activeOnly), intervalMs);
    return () => clearInterval(id);
  }, [fetchAllSessions, intervalMs, activeOnly]);
}
