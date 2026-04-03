import type { ActivityEvent } from "@atome/shared";
import { create } from "zustand";

const MAX_EVENTS = 50;

interface ActivityState {
  events: ActivityEvent[];
  push: (event: ActivityEvent) => void;
  clear: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],

  push: (event) =>
    set((s) => ({
      events: [event, ...s.events].slice(0, MAX_EVENTS),
    })),

  clear: () => set({ events: [] }),
}));
