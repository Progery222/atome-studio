import type {
  Account,
  ActivityEvent,
  FarmEvent,
  GenerationJob,
  Phone,
  QueueTask,
  SportZavodTheme,
  VideoFile,
} from "@atome/shared";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { useActivityStore } from "./activity";

interface FarmState {
  phones: Phone[];
  accounts: Account[];
  sportzavodAccounts: Account[];
  sportzavodThemes: SportZavodTheme[];
  queue: QueueTask[];
  activeJobs: GenerationJob[];
  videos: VideoFile[];
  phonesLoading: boolean;
  accountsLoading: boolean;
  sportzavodAccountsLoading: boolean;
  sportzavodThemesLoading: boolean;
  queueLoading: boolean;
  videosLoading: boolean;
  wsConnected: boolean;
  lastEvent: FarmEvent | null;
  _socket: Socket | null;

  fetchPhones: () => Promise<void>;
  fetchAccounts: () => Promise<void>;
  fetchSportzavodAccounts: () => Promise<void>;
  fetchSportzavodThemes: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  fetchVideos: () => Promise<void>;
  pausePhone: (id: string) => Promise<void>;
  resumePhone: (id: string) => Promise<void>;
  createAccount: (data: Partial<Account>) => Promise<Account | null>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<Account | null>;
  reloadFromSheets: () => Promise<boolean>;
  startGeneration: (data: {
    service: "sportzavod" | "contentzavod";
    account_ids: string[];
    videos_per_account: number;
    topic?: string;
  }) => Promise<GenerationJob | null>;
  startAutoGeneration: (accountIds?: string[]) => Promise<GenerationJob | null>;
  stopJob: (jobId: string) => Promise<void>;
  stopAllJobs: () => Promise<number>;
  connectWs: () => void;
  disconnectWs: () => void;
}

// ── Mock data (shown when API is unavailable) ────────────────────────────────

const MOCK_SZ_ACCOUNTS: Account[] = [
  {
    account_id: "1",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "nfl_tactics_01",
    niche: "NFL",
    content_sources: ["ESPN"],
    heygen_avatar_id: "av_001",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 95,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 2, posts_week: 12, posts_total: 84, last_post: "2026-04-01T10:00:00Z" },
  },
  {
    account_id: "2",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "nfl_fan_zone",
    niche: "NFL",
    content_sources: ["NFL.com"],
    heygen_avatar_id: "av_002",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 88,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 1, posts_week: 8, posts_total: 61, last_post: "2026-04-01T08:30:00Z" },
  },
  {
    account_id: "3",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "nba_drama_daily",
    niche: "NBA",
    content_sources: ["ESPN"],
    heygen_avatar_id: "av_003",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 92,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 3, posts_week: 15, posts_total: 120, last_post: "2026-04-01T11:00:00Z" },
  },
  {
    account_id: "4",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "nba_stats_king",
    niche: "NBA",
    content_sources: ["NBA.com"],
    heygen_avatar_id: "av_004",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 78,
    warmup_day: 0,
    status: "warmup",
    stats: { posts_today: 0, posts_week: 3, posts_total: 22, last_post: "2026-03-30T15:00:00Z" },
  },
  {
    account_id: "5",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "soccer_transfers",
    niche: "SOCCER",
    content_sources: ["Transfermarkt"],
    heygen_avatar_id: "av_005",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 97,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 2, posts_week: 14, posts_total: 95, last_post: "2026-04-01T09:15:00Z" },
  },
  {
    account_id: "6",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "soccer_daily_news",
    niche: "SOCCER",
    content_sources: ["BBC Sport"],
    heygen_avatar_id: "av_006",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 90,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 1, posts_week: 10, posts_total: 73, last_post: "2026-04-01T07:45:00Z" },
  },
  {
    account_id: "7",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "mma_octagon_news",
    niche: "MMA",
    content_sources: ["MMAFighting"],
    heygen_avatar_id: "av_007",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 85,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 1, posts_week: 7, posts_total: 55, last_post: "2026-04-01T06:30:00Z" },
  },
  {
    account_id: "8",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "f1_speed_talk",
    niche: "F1",
    content_sources: ["Formula1.com"],
    heygen_avatar_id: "av_008",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 91,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 2, posts_week: 11, posts_total: 68, last_post: "2026-04-01T10:30:00Z" },
  },
  {
    account_id: "9",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "boxing_highlights",
    niche: "BOXING",
    content_sources: ["BoxingScene"],
    heygen_avatar_id: "av_009",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 82,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 0, posts_week: 5, posts_total: 41, last_post: "2026-03-31T22:00:00Z" },
  },
  {
    account_id: "10",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "esports_arena",
    niche: "ESPORTS",
    content_sources: ["HLTV"],
    heygen_avatar_id: "av_010",
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 88,
    warmup_day: 0,
    status: "active",
    stats: { posts_today: 1, posts_week: 9, posts_total: 52, last_post: "2026-04-01T05:00:00Z" },
  },
  {
    account_id: "11",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "nfl_draft_watch",
    niche: "NFL",
    content_sources: ["ESPN"],
    heygen_avatar_id: undefined,
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 60,
    warmup_day: 3,
    status: "warmup",
    stats: { posts_today: 0, posts_week: 0, posts_total: 0, last_post: null },
  },
  {
    account_id: "12",
    tenant_id: "sz",
    phone_id: "",
    platform: "tiktok",
    username: "nba_legacy",
    niche: "NBA",
    content_sources: ["NBA.com"],
    heygen_avatar_id: undefined,
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: 55,
    warmup_day: 1,
    status: "warmup",
    stats: { posts_today: 0, posts_week: 0, posts_total: 0, last_post: null },
  },
];

const MOCK_SZ_THEMES: SportZavodTheme[] = [
  { theme_key: "NFL", theme_name: "NFL & American Football", count: 3 },
  { theme_key: "NBA", theme_name: "NBA Basketball", count: 3 },
  { theme_key: "SOCCER", theme_name: "Soccer & Football", count: 2 },
  { theme_key: "MMA", theme_name: "MMA & UFC", count: 1 },
  { theme_key: "F1", theme_name: "Formula 1", count: 1 },
  { theme_key: "BOXING", theme_name: "Boxing", count: 1 },
  { theme_key: "ESPORTS", theme_name: "Esports & Gaming", count: 1 },
];

const MOCK_JOBS: GenerationJob[] = [
  {
    job_id: "a1b2c3d4",
    service: "sportzavod",
    account_ids: ["1", "2", "3"],
    videos_per_account: 2,
    status: "running",
    is_auto: false,
    progress: 3,
    total: 6,
    errors_count: 0,
    created_at: "2026-04-01T10:00:00Z",
  },
  {
    job_id: "e5f6g7h8",
    service: "sportzavod",
    account_ids: ["5", "6", "7", "8", "9", "10"],
    videos_per_account: 1,
    status: "done",
    is_auto: true,
    progress: 6,
    total: 6,
    errors_count: 1,
    created_at: "2026-04-01T08:00:00Z",
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export const useFarmStore = create<FarmState>((set, get) => ({
  phones: [],
  accounts: [],
  sportzavodAccounts: [],
  sportzavodThemes: [],
  queue: [],
  activeJobs: [],
  videos: [],
  phonesLoading: false,
  accountsLoading: false,
  sportzavodAccountsLoading: false,
  sportzavodThemesLoading: false,
  queueLoading: false,
  videosLoading: false,
  wsConnected: false,
  lastEvent: null,
  _socket: null,

  fetchPhones: async () => {
    set({ phonesLoading: true });
    try {
      const res = await apiFetch("/api/phones");
      const phones = (await res.json()) as Phone[];
      set({ phones, phonesLoading: false });
    } catch {
      set({ phonesLoading: false });
    }
  },

  fetchAccounts: async () => {
    set({ accountsLoading: true });
    try {
      const res = await apiFetch("/api/accounts");
      const accounts = (await res.json()) as Account[];
      set({ accounts, accountsLoading: false });
    } catch {
      set({ accountsLoading: false });
    }
  },

  fetchSportzavodAccounts: async () => {
    set({ sportzavodAccountsLoading: true });
    try {
      const res = await apiFetch("/api/sportzavod/accounts");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Account[];
      set({
        sportzavodAccounts: data.length > 0 ? data : MOCK_SZ_ACCOUNTS,
        sportzavodAccountsLoading: false,
      });
    } catch {
      set({ sportzavodAccounts: MOCK_SZ_ACCOUNTS, sportzavodAccountsLoading: false });
    }
  },

  fetchSportzavodThemes: async () => {
    set({ sportzavodThemesLoading: true });
    try {
      const res = await apiFetch("/api/sportzavod/themes");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SportZavodTheme[];
      set({
        sportzavodThemes: data.length > 0 ? data : MOCK_SZ_THEMES,
        sportzavodThemesLoading: false,
      });
    } catch {
      set({ sportzavodThemes: MOCK_SZ_THEMES, sportzavodThemesLoading: false });
    }
  },

  fetchQueue: async () => {
    set({ queueLoading: true });
    try {
      const res = await apiFetch("/api/queue");
      const queue = (await res.json()) as QueueTask[];
      set({ queue, queueLoading: false });
    } catch {
      set({ queueLoading: false });
    }
  },

  fetchJobs: async () => {
    try {
      const res = await apiFetch("/api/jobs");
      if (!res.ok) throw new Error();
      const jobs = (await res.json()) as GenerationJob[];
      const newJobs = jobs.length > 0 ? jobs : MOCK_JOBS;

      // Synthetic activity events when WS is not connected (no orchestrator)
      if (!get().wsConnected) {
        const prevJobs = get().activeJobs;
        const activity = useActivityStore.getState();
        for (const job of newJobs) {
          const prev = prevJobs.find((j) => j.job_id === job.job_id);
          const svcName = job.service === "sportzavod" ? "SportZavod" : "content-zavod";
          if (!prev && (job.status === "running" || job.status === "done")) {
            activity.push({
              id: `poll-job-start-${job.job_id}`,
              timestamp: new Date().toISOString(),
              service: svcName,
              type: "job_started",
              message: `Job started · ${svcName}${job.total ? ` · ${job.total} videos` : ""}`,
              severity: "info",
            });
          } else if (prev && prev.status !== job.status) {
            if (job.status === "done") {
              activity.push({
                id: `poll-job-done-${job.job_id}`,
                timestamp: new Date().toISOString(),
                service: svcName,
                type: "job_complete",
                message: `Job complete · ${svcName} · ${job.progress}/${job.total}`,
                severity: "info",
              });
            } else if (job.status === "error") {
              activity.push({
                id: `poll-job-err-${job.job_id}`,
                timestamp: new Date().toISOString(),
                service: svcName,
                type: "error",
                message: `Job error · ${svcName}`,
                severity: "error",
              });
            } else if (job.status === "stopped") {
              activity.push({
                id: `poll-job-stop-${job.job_id}`,
                timestamp: new Date().toISOString(),
                service: svcName,
                type: "job_stopped",
                message: `Job stopped · ${svcName}`,
                severity: "warning",
              });
            }
          } else if (prev?.status === "running" && job.status === "running" && job.total > 0) {
            const prevPct = Math.floor((prev.progress / prev.total) * 100);
            const newPct = Math.floor((job.progress / job.total) * 100);
            for (const milestone of [25, 50, 75]) {
              if (prevPct < milestone && newPct >= milestone) {
                activity.push({
                  id: `poll-job-prog-${job.job_id}-${milestone}`,
                  timestamp: new Date().toISOString(),
                  service: svcName,
                  type: "info",
                  message: `${milestone}% · ${job.progress}/${job.total} · ${svcName}`,
                  severity: "info",
                });
              }
            }
          }
        }
      }

      set({ activeJobs: newJobs });
    } catch {
      if (get().activeJobs.length === 0) set({ activeJobs: MOCK_JOBS });
    }
  },

  fetchVideos: async () => {
    set({ videosLoading: true });
    try {
      const res = await apiFetch("/api/videos");
      const videos = (await res.json()) as VideoFile[];
      set({ videos, videosLoading: false });
    } catch {
      set({ videosLoading: false });
    }
  },

  pausePhone: async (id) => {
    await apiFetch(`/api/phones/${id}/pause`, { method: "POST" });
    get().fetchPhones();
  },

  resumePhone: async (id) => {
    await apiFetch(`/api/phones/${id}/resume`, { method: "POST" });
    get().fetchPhones();
  },

  createAccount: async (data) => {
    try {
      const res = await apiFetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const account = (await res.json()) as Account;
      set((s) => ({ accounts: [...s.accounts, account] }));
      return account;
    } catch {
      return null;
    }
  },

  updateAccount: async (id, data) => {
    try {
      const res = await apiFetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const account = (await res.json()) as Account;
      set((s) => ({
        accounts: s.accounts.map((a) => (a.account_id === id ? account : a)),
      }));
      return account;
    } catch {
      return null;
    }
  },

  reloadFromSheets: async () => {
    try {
      const res = await apiFetch("/api/sportzavod/accounts/reload", { method: "POST" });
      if (!res.ok) return false;
      await get().fetchAccounts();
      return true;
    } catch {
      return false;
    }
  },

  startGeneration: async (data) => {
    try {
      const res = await apiFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_ids: data.account_ids,
          videos_per_account: data.videos_per_account,
          topic: data.topic,
        }),
      });
      const job = (await res.json()) as GenerationJob;
      set((s) => ({ activeJobs: [...s.activeJobs, job] }));
      return job;
    } catch {
      return null;
    }
  },

  startAutoGeneration: async (accountIds) => {
    try {
      const body: Record<string, unknown> = { videos_per_account: 1 };
      if (accountIds?.length) body.account_ids = accountIds;
      const res = await apiFetch("/api/generate/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const job = (await res.json()) as GenerationJob;
      set((s) => ({ activeJobs: [...s.activeJobs, job] }));
      return job;
    } catch {
      return null;
    }
  },

  stopJob: async (jobId) => {
    try {
      await apiFetch(`/api/jobs/${jobId}/stop`, { method: "POST" });
      await get().fetchJobs();
    } catch {
      // silently ignore
    }
  },

  stopAllJobs: async () => {
    try {
      const res = await apiFetch("/api/jobs/stop-all", { method: "POST" });
      const data = (await res.json()) as { stopped_count: number };
      await get().fetchJobs();
      return data.stopped_count;
    } catch {
      return 0;
    }
  },

  connectWs: () => {
    const existing = get()._socket;
    if (existing) return; // already connected

    // Connect via Vite proxy to NestJS /ws namespace
    const socket = io("/ws", { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      set({ wsConnected: true });
      get().fetchQueue();
      get().fetchJobs();
    });

    socket.on("disconnect", () => {
      set({ wsConnected: false });
    });

    socket.on("farm_event", (event: FarmEvent) => {
      set({ lastEvent: event });

      const svcName = (event.details?.service as string) || event.phone_id || "orchestrator";

      const MESSAGE_MAP: Partial<Record<FarmEvent["event"], string>> = {
        job_started: `Job started · ${svcName}${event.details?.total ? ` · ${event.details.total as number} videos` : ""}`,
        job_complete: `Job complete · ${svcName} · ${event.details?.progress ?? 0}/${event.details?.total ?? 0} videos`,
        job_stopped: `Job stopped · ${svcName}`,
        service_online: `${svcName} came online`,
        service_offline: `${svcName} went offline`,
        published: event.account_id ? `Published · ${event.account_id}` : "Published",
        banned: event.account_id ? `Account banned · ${event.account_id}` : "Account banned",
        error: event.account_id ? `Error · ${event.account_id}` : "Error",
        failed: event.account_id ? `Failed · ${event.account_id}` : "Failed",
        heartbeat: "Heartbeat",
      };

      const SEVERITY_MAP: Partial<Record<FarmEvent["event"], "info" | "warning" | "error">> = {
        banned: "error",
        error: "error",
        failed: "error",
        service_offline: "warning",
        job_stopped: "warning",
      };

      // Push to ActivityFeed
      useActivityStore.getState().push({
        id: `${event.timestamp}-${event.phone_id}-${event.event}`,
        timestamp: event.timestamp,
        service: svcName,
        type: event.event === "failed" ? "error" : (event.event as ActivityEvent["type"]),
        message: MESSAGE_MAP[event.event] ?? event.event,
        severity: SEVERITY_MAP[event.event] ?? "info",
      });

      switch (event.event) {
        case "published":
          get().fetchQueue();
          get().fetchPhones(); // update post counts
          break;
        case "failed":
        case "error":
          get().fetchQueue();
          break;
        case "job_complete":
          get().fetchJobs();
          get().fetchVideos();
          break;
        case "banned":
          get().fetchPhones();
          break;
        case "heartbeat":
          // Update phone status from heartbeat payload (FR-16.4)
          if (event.phone_id && event.details) {
            set((s) => ({
              phones: s.phones.map((p) =>
                p.phone_id === event.phone_id
                  ? { ...p, ...(event.details as Partial<Phone>), last_active: event.timestamp }
                  : p
              ),
            }));
          }
          break;
        case "job_started":
          get().fetchJobs();
          break;
      }
    });

    set({ _socket: socket });
  },

  disconnectWs: () => {
    const socket = get()._socket;
    if (socket) {
      socket.disconnect();
      set({ _socket: null, wsConnected: false });
    }
  },
}));
