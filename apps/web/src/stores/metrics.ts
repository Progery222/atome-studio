import type { HeroKPI } from "@atome/shared";
import { create } from "zustand";
import { apiFetch } from "../lib/api";

const EMPTY_KPI: HeroKPI = {
  videos_today: 0,
  cost_per_video: 0,
  publish_rate: 0,
  active_accounts: 0,
  uptime_percent: 0,
  trends: {
    videos_today: 0,
    cost_per_video: 0,
    publish_rate: 0,
    active_accounts: 0,
    uptime_percent: 0,
  },
};

const DEMO_BASE: HeroKPI = {
  videos_today: 47,
  cost_per_video: 0.34,
  publish_rate: 89,
  active_accounts: 23,
  uptime_percent: 99.7,
  trends: {
    videos_today: 12.4,
    cost_per_video: -3.1,
    publish_rate: 5.2,
    active_accounts: 8.7,
    uptime_percent: 0.1,
  },
};

function fluctuate(base: HeroKPI): HeroKPI {
  const r = (d: number) => (Math.random() - 0.5) * 2 * d;
  return {
    ...base,
    videos_today: Math.max(0, Math.round(base.videos_today + r(2))),
    cost_per_video: Math.max(0.01, +(base.cost_per_video + r(0.02)).toFixed(2)),
    publish_rate: Math.min(100, Math.max(0, +(base.publish_rate + r(1)).toFixed(1))),
  };
}

interface MetricsState {
  kpis: HeroKPI;
  loading: boolean;
  demoMode: boolean;
  enableDemo: () => void;
  disableDemo: () => void;
  fetchKPIs: () => Promise<void>;
}

let _demoTimer: ReturnType<typeof setInterval> | null = null;

export const useMetricsStore = create<MetricsState>((set, get) => ({
  kpis: EMPTY_KPI,
  loading: false,
  demoMode: false,

  enableDemo: () => {
    set({ demoMode: true, kpis: fluctuate(DEMO_BASE) });
    if (_demoTimer) clearInterval(_demoTimer);
    _demoTimer = setInterval(() => {
      set({ kpis: fluctuate(DEMO_BASE) });
    }, 4000);
  },

  disableDemo: () => {
    if (_demoTimer) {
      clearInterval(_demoTimer);
      _demoTimer = null;
    }
    set({ demoMode: false, kpis: EMPTY_KPI });
  },

  fetchKPIs: async () => {
    if (get().demoMode) return;
    set({ loading: true });
    try {
      const res = await apiFetch("/api/services/kpis");
      if (res.ok) {
        const data: HeroKPI = await res.json();
        set({ kpis: data });
      }
    } catch (e) {
      console.warn("Failed to fetch KPIs", e);
    } finally {
      set({ loading: false });
    }
  },
}));
