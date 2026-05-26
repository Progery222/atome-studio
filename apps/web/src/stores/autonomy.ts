import type {
  AnomalySeverity,
  AutonomySessionDetail,
  GlobalGoal,
  GoalKind,
  GoalStatus,
  PhoneActionExecution,
  PhoneAnomalyEvent,
  PhoneAutonomySession,
  PhoneGoal,
  PhoneObservation,
  PhoneRecoveryAttempt,
  PhoneSelector,
} from "@atome/shared";
import { create } from "zustand";
import { apiFetch } from "../lib/api";

interface AutonomyState {
  // Sessions indexed by serial for quick lookup on PhoneGridPage
  sessionsBySerial: Record<string, AutonomySessionDetail>;
  sessionsList: PhoneAutonomySession[];
  sessionsLoading: boolean;

  // Goals
  phoneGoals: PhoneGoal[];
  globalGoals: GlobalGoal[];
  goalsLoading: boolean;

  // Anomalies (last 100, client-side filtering)
  anomalies: PhoneAnomalyEvent[];
  recoveries: PhoneRecoveryAttempt[];
  anomaliesLoading: boolean;

  // Actions
  fetchSession: (serial: string) => Promise<void>;
  fetchAllSessions: (activeOnly?: boolean) => Promise<void>;
  pauseSession: (serial: string) => Promise<void>;
  resumeSession: (serial: string) => Promise<void>;
  terminateSession: (serial: string) => Promise<void>;
  fetchActions: (serial: string, limit?: number) => Promise<PhoneActionExecution[]>;
  fetchObservations: (serial: string, limit?: number) => Promise<PhoneObservation[]>;

  fetchPhoneGoals: (status?: GoalStatus, serial?: string) => Promise<void>;
  fetchGlobalGoals: () => Promise<void>;
  createPhoneGoal: (dto: {
    serial: string;
    kind: GoalKind;
    params?: Record<string, unknown>;
    priority?: number;
  }) => Promise<PhoneGoal | null>;
  createGlobalGoal: (dto: {
    kind: GoalKind;
    phone_selector: PhoneSelector;
    params?: Record<string, unknown>;
  }) => Promise<GlobalGoal | null>;

  fetchAnomalies: (severity?: AnomalySeverity, signatureId?: string, since?: string) => Promise<void>;
  fetchRecoveries: () => Promise<void>;

  /** Apply a sessions snapshot received via WS (autonomy:sessions channel). */
  applySessionsSnapshot: (list: PhoneAutonomySession[]) => void;
}

export const useAutonomyStore = create<AutonomyState>((set, get) => ({
  sessionsBySerial: {},
  sessionsList: [],
  sessionsLoading: false,

  phoneGoals: [],
  globalGoals: [],
  goalsLoading: false,

  anomalies: [],
  recoveries: [],
  anomaliesLoading: false,

  fetchSession: async (serial) => {
    try {
      const res = await apiFetch(`/api/autonomy/sessions/${serial}`);
      const detail = (await res.json()) as AutonomySessionDetail;
      if (detail?.session) {
        set((s) => ({
          sessionsBySerial: { ...s.sessionsBySerial, [serial]: detail },
        }));
      }
    } catch {
      // keep previous
    }
  },

  fetchAllSessions: async (activeOnly) => {
    set({ sessionsLoading: true });
    try {
      const qs = activeOnly ? "?active_only=true" : "";
      const res = await apiFetch(`/api/autonomy/sessions${qs}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const list = data as PhoneAutonomySession[];
        get().applySessionsSnapshot(list);
      }
    } catch {
      // keep previous
    } finally {
      set({ sessionsLoading: false });
    }
  },

  applySessionsSnapshot: (list) => {
    const bySerial: Record<string, AutonomySessionDetail> = { ...get().sessionsBySerial };
    for (const session of list) {
      const existing = bySerial[session.serial];
      bySerial[session.serial] = {
        session,
        last_observation: existing?.last_observation,
        last_action: existing?.last_action,
        last_anomaly: existing?.last_anomaly,
      };
    }
    set({ sessionsList: list, sessionsBySerial: bySerial });
  },

  pauseSession: async (serial) => {
    try {
      await apiFetch(`/api/autonomy/sessions/${serial}/pause`, { method: "POST" });
      await get().fetchSession(serial);
    } catch {
      // ignore
    }
  },

  resumeSession: async (serial) => {
    try {
      await apiFetch(`/api/autonomy/sessions/${serial}/resume`, { method: "POST" });
      await get().fetchSession(serial);
    } catch {
      // ignore
    }
  },

  terminateSession: async (serial) => {
    try {
      await apiFetch(`/api/autonomy/sessions/${serial}/terminate`, { method: "POST" });
      await get().fetchSession(serial);
    } catch {
      // ignore
    }
  },

  fetchActions: async (serial, limit = 50) => {
    try {
      const res = await apiFetch(`/api/autonomy/actions/${serial}/recent?limit=${limit}`);
      const data = await res.json();
      return Array.isArray(data) ? (data as PhoneActionExecution[]) : [];
    } catch {
      return [];
    }
  },

  fetchObservations: async (serial, limit = 20) => {
    try {
      const res = await apiFetch(`/api/autonomy/observations/${serial}/recent?limit=${limit}`);
      const data = await res.json();
      return Array.isArray(data) ? (data as PhoneObservation[]) : [];
    } catch {
      return [];
    }
  },

  fetchPhoneGoals: async (status, serial) => {
    set({ goalsLoading: true });
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (serial) params.set("serial", serial);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await apiFetch(`/api/goals${qs}`);
      const data = await res.json();
      if (Array.isArray(data)) set({ phoneGoals: data as PhoneGoal[] });
    } catch {
      // keep
    } finally {
      set({ goalsLoading: false });
    }
  },

  fetchGlobalGoals: async () => {
    try {
      const res = await apiFetch("/api/global_goals");
      const data = await res.json();
      if (Array.isArray(data)) set({ globalGoals: data as GlobalGoal[] });
    } catch {
      // keep
    }
  },

  createPhoneGoal: async (dto) => {
    try {
      const res = await apiFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });
      const goal = (await res.json()) as PhoneGoal;
      set((s) => ({ phoneGoals: [goal, ...s.phoneGoals] }));
      return goal;
    } catch {
      return null;
    }
  },

  createGlobalGoal: async (dto) => {
    try {
      const res = await apiFetch("/api/global_goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });
      const goal = (await res.json()) as GlobalGoal;
      set((s) => ({ globalGoals: [goal, ...s.globalGoals] }));
      return goal;
    } catch {
      return null;
    }
  },

  fetchAnomalies: async (severity, signatureId, since) => {
    set({ anomaliesLoading: true });
    try {
      const params = new URLSearchParams();
      if (severity) params.set("severity", severity);
      if (signatureId) params.set("signature_id", signatureId);
      if (since) params.set("since", since);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await apiFetch(`/api/autonomy/anomaly/events${qs}`);
      const data = await res.json();
      if (Array.isArray(data)) set({ anomalies: data as PhoneAnomalyEvent[] });
    } catch {
      // keep
    } finally {
      set({ anomaliesLoading: false });
    }
  },

  fetchRecoveries: async () => {
    try {
      const res = await apiFetch("/api/autonomy/recoveries/recent");
      const data = await res.json();
      if (Array.isArray(data)) set({ recoveries: data as PhoneRecoveryAttempt[] });
    } catch {
      // keep
    }
  },
}));
