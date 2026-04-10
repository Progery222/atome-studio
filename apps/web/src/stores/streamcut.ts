import type { StreamCutJob, StreamCutVideoInfo } from "@atome/shared";
import { create } from "zustand";
import { apiFetch } from "../lib/api";

interface StreamCutState {
  jobs: StreamCutJob[];
  jobsLoading: boolean;
  videoInfo: StreamCutVideoInfo | null;
  videoInfoLoading: boolean;
  footageCategories: string[];
  creating: boolean;

  fetchJobs: () => Promise<void>;
  fetchJob: (id: string) => Promise<StreamCutJob | null>;
  createJob: (dto: Record<string, unknown>) => Promise<StreamCutJob | null>;
  deleteJob: (id: string) => Promise<void>;
  fetchVideoInfo: (url: string) => Promise<void>;
  fetchFootageCategories: () => Promise<void>;
  clearVideoInfo: () => void;
}

export const useStreamCutStore = create<StreamCutState>((set, get) => ({
  jobs: [],
  jobsLoading: false,
  videoInfo: null,
  videoInfoLoading: false,
  footageCategories: [],
  creating: false,

  fetchJobs: async () => {
    set({ jobsLoading: true });
    try {
      const res = await apiFetch("/api/streamcut/jobs");
      const data = await res.json();
      if (Array.isArray(data)) set({ jobs: data });
    } catch {
      // keep previous
    } finally {
      set({ jobsLoading: false });
    }
  },

  fetchJob: async (id) => {
    try {
      const res = await apiFetch(`/api/streamcut/jobs/${id}`);
      const job = (await res.json()) as StreamCutJob;
      // update in list
      set((s) => ({
        jobs: s.jobs.map((j) => (j.job_id === id ? job : j)),
      }));
      return job;
    } catch {
      return null;
    }
  },

  createJob: async (dto) => {
    set({ creating: true });
    try {
      const res = await apiFetch("/api/streamcut/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });
      const job = (await res.json()) as StreamCutJob;
      set((s) => ({ jobs: [job, ...s.jobs] }));
      return job;
    } catch {
      return null;
    } finally {
      set({ creating: false });
    }
  },

  deleteJob: async (id) => {
    try {
      await apiFetch(`/api/streamcut/jobs/${id}`, { method: "DELETE" });
      set((s) => ({ jobs: s.jobs.filter((j) => j.job_id !== id) }));
    } catch {
      // ignore
    }
  },

  fetchVideoInfo: async (url) => {
    set({ videoInfoLoading: true, videoInfo: null });
    try {
      const res = await apiFetch(`/api/streamcut/video-info?url=${encodeURIComponent(url)}`);
      const info = (await res.json()) as StreamCutVideoInfo;
      set({ videoInfo: info });
    } catch {
      set({ videoInfo: null });
    } finally {
      set({ videoInfoLoading: false });
    }
  },

  fetchFootageCategories: async () => {
    try {
      const res = await apiFetch("/api/streamcut/footage-categories");
      const data = (await res.json()) as { categories: string[] };
      set({ footageCategories: data.categories });
    } catch {
      // ignore
    }
  },

  clearVideoInfo: () => set({ videoInfo: null }),
}));
