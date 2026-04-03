import { EMPTY_FARM_STATS, type FarmStats, type Service } from "@atome/shared";
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { useActivityStore } from "./activity";

const API = "/api";

export interface TooltipData {
  x: number;
  y: number;
  service: Service;
}

interface ServicesState {
  services: Service[];
  farmStats: FarmStats;
  tooltip: TooltipData | null;
  highlightedId: string | null;
  selectedId: string | null;
  loading: boolean;

  setServices: (services: Service[]) => void;
  setFarmStats: (stats: FarmStats) => void;
  setTooltip: (data: TooltipData | null) => void;
  setHighlighted: (id: string | null) => void;
  setSelected: (id: string | null) => void;

  fetchServices: () => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const useServicesStore = create<ServicesState>((set, get) => ({
  services: [],
  farmStats: { ...EMPTY_FARM_STATS },
  tooltip: null,
  highlightedId: null,
  selectedId: null,
  loading: true,

  setServices: (services) => set({ services }),
  setFarmStats: (farmStats) => set({ farmStats }),
  setTooltip: (tooltip) => set({ tooltip }),
  setHighlighted: (highlightedId) => set({ highlightedId }),
  setSelected: (selectedId) => set({ selectedId }),

  fetchServices: async () => {
    try {
      const res = await apiFetch(`${API}/services`);
      const services = (await res.json()) as Service[];

      // Push activity events when service status changes
      const prevServices = get().services;
      if (prevServices.length > 0) {
        const activity = useActivityStore.getState();
        for (const svc of services) {
          const prev = prevServices.find((p: Service) => p.id === svc.id);
          if (prev && prev.status !== svc.status) {
            const isOnline = svc.status === "online";
            const isOffline = svc.status === "offline" || svc.status === "error";
            activity.push({
              id: `poll-svc-${svc.id}-${svc.status}-${Date.now()}`,
              timestamp: new Date().toISOString(),
              service: svc.name,
              type: isOnline ? "service_online" : isOffline ? "service_offline" : "info",
              message: isOnline
                ? `${svc.name} came online`
                : isOffline
                  ? `${svc.name} went offline`
                  : `${svc.name} degraded`,
              severity: isOnline ? "info" : "warning",
            });
          }
        }
      }

      set({ services, loading: false });
    } catch (e) {
      console.warn("Failed to fetch services", e);
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await apiFetch(`${API}/services/stats`);
      const stats = (await res.json()) as FarmStats;
      set({ farmStats: stats });
    } catch (e) {
      console.warn("Failed to fetch farm stats", e);
    }
  },
}));
