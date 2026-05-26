import type { SystemHealth } from "@atome/shared";
import { create } from "zustand";
import { apiFetch } from "../lib/api";

interface HealthState {
  data: SystemHealth | null;
  lastError: string | null;
  fetchedAt: number;
  fetch: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set) => ({
  data: null,
  lastError: null,
  fetchedAt: 0,
  async fetch() {
    try {
      const res = await apiFetch("/api/farm/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const farm = (await res.json()) as {
        ok?: boolean;
        service?: { name?: string; env?: string; autonomy_disabled?: boolean };
        version?: string;
      };
      const state: SystemHealth["state"] = farm.ok ? "ok" : "down";
      const data: SystemHealth = {
        state,
        generatedAt: new Date().toISOString(),
        uptimeSec: 0,
        services: [
          {
            id: "atome-farm",
            name: farm.service?.name ?? "atome-farm",
            state,
            lastSuccessAt: farm.ok ? new Date().toISOString() : null,
            staleSeconds: farm.ok ? 0 : null,
            circuitOpenSince: farm.ok ? null : new Date().toISOString(),
            detail: farm.service
              ? `${farm.service.env ?? "env"} · autonomy ${farm.service.autonomy_disabled ? "off" : "on"} · ${farm.version ?? "unknown"}`
              : undefined,
          },
        ],
      };
      set({ data, lastError: null, fetchedAt: Date.now() });
    } catch (e) {
      set({ lastError: (e as Error).message, fetchedAt: Date.now() });
    }
  },
}));
