import type { HeroKPI } from "@atome/shared";
import { create } from "zustand";

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

interface MetricsState {
  kpis: HeroKPI;
  loading: boolean;
  fetchKPIs: () => Promise<void>;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  kpis: EMPTY_KPI,
  loading: false,

  fetchKPIs: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/services/kpis");
      if (res.ok) {
        const data: HeroKPI = await res.json();
        set({ kpis: data });
      }
    } catch {
      // keep existing values
    } finally {
      set({ loading: false });
    }
  },
}));
