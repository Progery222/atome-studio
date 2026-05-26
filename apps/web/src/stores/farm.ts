import type {
  Account,
  ActivityEvent,
  FarmEvent,
  GenerationJob,
  GenerationJobEvent,
  Phone,
  QueueTask,
  SportZavodTheme,
  VideoFile,
} from "@atome/shared";
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
  jobEventsById: Record<string, GenerationJobEvent[]>;
  videos: VideoFile[];
  phonesLoading: boolean;
  accountsLoading: boolean;
  sportzavodAccountsLoading: boolean;
  sportzavodThemesLoading: boolean;
  queueLoading: boolean;
  videosLoading: boolean;
  wsConnected: boolean;
  lastEvent: FarmEvent | null;
  _socket: WebSocket | null;

  fetchPhones: () => Promise<void>;
  fetchAccounts: () => Promise<void>;
  fetchSportzavodAccounts: () => Promise<void>;
  fetchSportzavodThemes: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  fetchJobEvents: (jobId: string) => Promise<void>;
  fetchVideos: (options?: { silent?: boolean }) => Promise<void>;
  pausePhone: (id: string) => Promise<void>;
  resumePhone: (id: string) => Promise<void>;
  createAccount: (data: Partial<Account>) => Promise<Account | null>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<Account | null>;
  reloadFromSheets: () => Promise<boolean>;
  startGeneration: (data: {
    service: "sportzavod" | "contentzavod" | "agentmusic";
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

function coerceEventJobStatus(event: FarmEvent): GenerationJob["status"] {
  const raw = event.details?.status;
  if (
    raw === "running" ||
    raw === "done" ||
    raw === "error" ||
    raw === "stopped" ||
    raw === "stopping"
  ) {
    return raw;
  }
  if (event.event === "job_complete") return "done";
  if (event.event === "job_error") return "error";
  if (event.event === "job_stopped") return "stopped";
  return "running";
}

function coerceJobEvent(event: FarmEvent): GenerationJobEvent | null {
  if (
    event.event !== "job_started" &&
    event.event !== "job_complete" &&
    event.event !== "job_stopped" &&
    event.event !== "job_progress" &&
    event.event !== "job_log" &&
    event.event !== "job_error"
  ) {
    return null;
  }

  const jobId = typeof event.details?.job_id === "string" ? (event.details.job_id as string) : "";
  const service = event.details?.service;
  if (!jobId || (service !== "sportzavod" && service !== "contentzavod" && service !== "agentmusic")) return null;

  const progress =
    typeof event.details?.progress === "number" ? (event.details.progress as number) : 0;
  const total = typeof event.details?.total === "number" ? (event.details.total as number) : 0;
  const percent =
    typeof event.details?.percent === "number" ? (event.details.percent as number) : undefined;
  const level =
    event.details?.level === "warning" || event.details?.level === "error"
      ? (event.details.level as "warning" | "error")
      : "info";

  return {
    id: `${jobId}-${event.timestamp}-${event.event}`,
    job_id: jobId,
    service,
    seq: Number.MAX_SAFE_INTEGER,
    event_type: event.event,
    phase:
      typeof event.details?.phase === "string"
        ? (event.details.phase as string)
        : coerceEventJobStatus(event),
    message:
      typeof event.details?.message === "string" ? (event.details.message as string) : event.event,
    status: coerceEventJobStatus(event),
    progress,
    total,
    percent,
    level,
    created_at:
      typeof event.details?.created_at === "string"
        ? (event.details.created_at as string)
        : event.timestamp,
  };
}

function mergeJobSnapshot(
  existing: GenerationJob | undefined,
  incoming: GenerationJobEvent
): GenerationJob {
  const base: GenerationJob =
    existing ??
    ({
      job_id: incoming.job_id,
      service: incoming.service,
      account_ids: [],
      videos_per_account: 1,
      status: incoming.status,
      is_auto: false,
      progress: incoming.progress,
      total: incoming.total,
      errors_count: incoming.status === "error" ? 1 : 0,
      created_at: incoming.created_at,
    } as GenerationJob);

  return {
    ...base,
    status: incoming.status,
    progress: incoming.progress,
    total: incoming.total,
    percent:
      incoming.percent ??
      (incoming.total > 0 ? Math.round((incoming.progress / incoming.total) * 100) : base.percent),
    current_phase: incoming.phase,
    current_message: incoming.message,
    latest_log: incoming.message,
    started_at: base.started_at ?? base.created_at ?? incoming.created_at,
    updated_at: incoming.created_at,
    errors_count: incoming.status === "error" ? Math.max(base.errors_count, 1) : base.errors_count,
  };
}

function upsertActiveJob(jobs: GenerationJob[], incoming: GenerationJobEvent): GenerationJob[] {
  const index = jobs.findIndex((job) => job.job_id === incoming.job_id);
  if (index === -1) return [...jobs, mergeJobSnapshot(undefined, incoming)];
  const next = [...jobs];
  next[index] = mergeJobSnapshot(next[index], incoming);
  return next;
}

function appendTimelineEvent(
  current: Record<string, GenerationJobEvent[]>,
  incoming: GenerationJobEvent
): Record<string, GenerationJobEvent[]> {
  const prev = current[incoming.job_id] ?? [];
  if (
    prev.some(
      (event) =>
        event.id === incoming.id ||
        (event.created_at === incoming.created_at &&
          event.event_type === incoming.event_type &&
          event.phase === incoming.phase &&
          event.message === incoming.message)
    )
  ) {
    return current;
  }
  const next = [...prev, incoming].slice(-100);
  return { ...current, [incoming.job_id]: next };
}

// ─────────────────────────────────────────────────────────────────────────────

type FarmList<T> = { items?: T[] };

interface FarmAccountRecord {
  account_id: string;
  phone_id: string;
  platform: string;
  username?: string | null;
  account_group?: string | null;
  niche?: string | null;
  status?: string | null;
  meta_json?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

interface FarmPhoneRecord {
  phone_id: string;
  farm_number?: number | null;
  display_id?: string | null;
  serial_suffix?: string | null;
  display_name?: string | null;
  serial?: string | null;
  node_id?: string | null;
  node_host?: string | null;
  model?: string | null;
  status?: string | null;
  accounts_summary?: FarmAccountRecord[];
  last_seen?: string | null;
  meta_json?: Record<string, unknown>;
}

interface FarmJobRecord {
  job_id: string;
  phone_id?: string | null;
  phone_farm_number?: number | null;
  phone_display_id?: string | null;
  phone_serial_suffix?: string | null;
  phone_display_name?: string | null;
  account_id?: string | null;
  platform?: string | null;
  source?: string | null;
  status?: string | null;
  scheduled_at?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  content_key?: string | null;
  payload?: { metadata?: { caption?: string; hashtags?: string[] }; content?: { content_id?: string } };
  payload_json?: { metadata?: { caption?: string; hashtags?: string[] }; content?: { content_id?: string } };
}

interface FarmContentRecord {
  content_id: string;
  content_key: string;
  bucket?: string;
  key?: string;
  size?: number;
  last_modified?: string;
  preview_url?: string;
  sidecar?: {
    title?: string;
    caption?: string;
    description?: string;
    hashtags?: string[];
    source_service?: string;
    source?: string;
    service?: string;
    generator?: string;
  } | null;
}

interface FarmWsEnvelope {
  event_id?: string;
  type?: string;
  ts?: string;
  scope?: string;
  phone_id?: string | null;
  job_id?: string | null;
  platform?: string | null;
  payload?: Record<string, unknown>;
}

function listItems<T>(data: FarmList<T> | T[]): T[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data.items) ? data.items : [];
}

function normalizePhoneStatus(status?: string | null): Phone["status"] {
  if (status === "online" || status === "active") return "active";
  if (status === "warmup" || status === "paused" || status === "offline" || status === "banned" || status === "error") {
    return status;
  }
  return "offline";
}

function normalizeAccountStatus(status?: string | null): Account["status"] {
  if (status === "active" || status === "warmup" || status === "paused" || status === "banned") {
    return status;
  }
  return "paused";
}

function normalizePlatform(platform?: string | null): Account["platform"] {
  if (platform === "instagram" || platform === "youtube" || platform === "x") return platform;
  return "tiktok";
}

function mapFarmAccount(raw: FarmAccountRecord): Account {
  return {
    account_id: raw.account_id,
    tenant_id: "farm",
    phone_id: raw.phone_id,
    platform: normalizePlatform(raw.platform),
    username: raw.username || raw.account_id,
    account_group: raw.account_group ?? null,
    niche: raw.niche || raw.account_group || String(raw.meta_json?.niche ?? ""),
    content_sources: [],
    heygen_avatar_id: undefined,
    post_frequency_hours: 24,
    timezone: "UTC",
    health_score: normalizeAccountStatus(raw.status) === "active" ? 100 : 0,
    warmup_day: 0,
    status: normalizeAccountStatus(raw.status),
    stats: { posts_today: 0, posts_week: 0, posts_total: 0, last_post: null },
  };
}

function mapFarmPhone(raw: FarmPhoneRecord): Phone {
  const accounts = (raw.accounts_summary ?? [])
    .filter((account) => account.account_id || account.username)
    .map((account, index) =>
      mapFarmAccount({
        ...account,
        account_id: account.account_id || `${raw.phone_id}-${account.platform || "tiktok"}-${index}`,
        phone_id: raw.phone_id,
      })
    );
  const status = normalizePhoneStatus(raw.status);
  return {
    phone_id: raw.phone_id,
    farm_number: raw.farm_number ?? null,
    display_id: raw.display_id ?? null,
    serial_suffix: raw.serial_suffix ?? null,
    display_name: raw.display_name || raw.display_id || raw.serial || raw.phone_id,
    serial: raw.serial || raw.phone_id,
    tenant_id: "farm",
    model: raw.model || raw.node_host || "Android",
    status,
    warmup_day: 0,
    health_score: status === "active" ? 100 : 0,
    adb_connected: status === "active",
    group: String(raw.meta_json?.group ?? ""),
    last_active: raw.last_seen || new Date(0).toISOString(),
    actions_today: 0,
    posts_today: 0,
    accounts,
  };
}

function mapFarmJob(raw: FarmJobRecord): QueueTask {
  const payload = raw.payload ?? raw.payload_json ?? {};
  const metadata = payload.metadata ?? {};
  const statusMap: Record<string, QueueTask["status"]> = {
    queued: "scheduled",
    running: "in_progress",
    done: "published",
    failed: "failed",
    cancelled: "failed",
  };
  return {
    task_id: raw.job_id,
    account_id: raw.account_id || "",
    phone_id: raw.phone_id || "",
    phone_farm_number: raw.phone_farm_number ?? null,
    phone_display_id: raw.phone_display_id ?? null,
    phone_serial_suffix: raw.phone_serial_suffix ?? null,
    phone_display_name: raw.phone_display_name ?? null,
    file_url: raw.content_key || "",
    caption: metadata.caption || raw.content_key || raw.job_id,
    hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags : [],
    platform: normalizePlatform(raw.platform),
    source_service: "contentzavod",
    status: statusMap[String(raw.status || "queued")] ?? "scheduled",
    scheduled_at: raw.scheduled_at || raw.created_at || new Date().toISOString(),
    executed_at: raw.finished_at || raw.started_at || undefined,
    created_at: raw.created_at || new Date().toISOString(),
  };
}

function mapFarmContent(raw: FarmContentRecord): VideoFile {
  const key = raw.content_key || `${raw.bucket ?? "atome-videos"}/${raw.key ?? raw.content_id}`;
  const objectKey = raw.key || stripVideoBucket(key);
  const sidecar = raw.sidecar ?? {};
  const sourceService = inferVideoService(
    objectKey,
    sidecar.source_service,
    sidecar.source,
    sidecar.service,
    sidecar.generator
  );
  return {
    filename: key,
    account_id: inferAccountIdFromKey(objectKey, sourceService),
    tenant_id: sourceService,
    source_service: sourceService,
    url: raw.preview_url || key,
    thumbnail_url: "",
    size_bytes: raw.size ?? 0,
    created_at: raw.last_modified || new Date().toISOString(),
    status: "queued",
    title: sidecar.title || objectKey.split("/").pop(),
    caption: sidecar.caption,
    description: sidecar.description,
    hashtags: Array.isArray(sidecar.hashtags) ? sidecar.hashtags : [],
  };
}

const DEFAULT_VIDEO_BUCKET = "atome-videos";

function stripVideoBucket(filename: string): string {
  const prefix = `${DEFAULT_VIDEO_BUCKET}/`;
  return filename.startsWith(prefix) ? filename.slice(prefix.length) : filename;
}

function publishFilename(filename: string): string {
  return filename.startsWith(`${DEFAULT_VIDEO_BUCKET}/`) ? filename : `${DEFAULT_VIDEO_BUCKET}/${filename}`;
}

function normalizeVideoService(value?: string | null): VideoFile["source_service"] | null {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, "");
  if (!clean) return null;
  if (clean.includes("sportzavod")) return "sportzavod";
  if (clean.includes("streamcut")) return "streamcut";
  if (clean.includes("agentmusic")) return "agentmusic";
  if (clean.includes("contentzavod") || clean.includes("contentzav")) return "contentzavod";
  return null;
}

function inferVideoService(key: string, ...candidates: Array<string | null | undefined>): VideoFile["source_service"] {
  const clean = stripVideoBucket(key);
  if (clean.startsWith("sportzavod/") || clean.includes("/sportzavod/")) return "sportzavod";
  if (clean.startsWith("streamcut/") || clean.includes("/streamcut/")) return "streamcut";
  if (clean.startsWith("agentmusic/") || clean.includes("/agentmusic/")) return "agentmusic";
  if (
    clean.startsWith("contentzavod/") ||
    clean.startsWith("content-zavod/") ||
    clean.includes("/contentzavod/") ||
    clean.includes("/content-zavod/")
  ) {
    return "contentzavod";
  }
  for (const candidate of candidates) {
    const normalized = normalizeVideoService(candidate);
    if (normalized) return normalized;
  }
  return "contentzavod";
}

function inferAccountIdFromKey(key: string, service: VideoFile["source_service"]): string {
  const parts = stripVideoBucket(key).split("/");
  if (service === "sportzavod") return parts[2] ?? "";
  if (service === "contentzavod") return parts[1] ?? "";
  if (service === "streamcut") return "streamcut";
  if (service === "agentmusic") return "agentmusic";
  return "";
}

function normalizeGeneratedVideo(raw: VideoFile): VideoFile {
  const sourceService = inferVideoService(raw.filename, raw.source_service);
  return {
    ...raw,
    filename: publishFilename(raw.filename),
    account_id: inferAccountIdFromKey(raw.filename, sourceService) || raw.account_id || "",
    tenant_id: raw.tenant_id || sourceService,
    source_service: sourceService,
    thumbnail_url: raw.thumbnail_url || "",
    size_bytes: raw.size_bytes ?? 0,
    created_at: raw.created_at || new Date().toISOString(),
    status: raw.status || "published",
  };
}

function mergeVideoLists(farmVideos: VideoFile[], generatedVideos: VideoFile[]): VideoFile[] {
  const byKey = new Map<string, VideoFile>();

  for (const video of farmVideos) {
    byKey.set(stripVideoBucket(video.filename), video);
  }

  for (const generated of generatedVideos) {
    const key = stripVideoBucket(generated.filename);
    const existing = byKey.get(key);
    const sourceService = inferVideoService(key, existing?.source_service, generated.source_service);
    byKey.set(key, {
      ...(existing ?? generated),
      ...generated,
      filename: existing?.filename ?? generated.filename,
      tenant_id: sourceService,
      source_service: sourceService,
      url: generated.url || existing?.url || generated.filename,
      thumbnail_url: generated.thumbnail_url || existing?.thumbnail_url || "",
      size_bytes: generated.size_bytes || existing?.size_bytes || 0,
      created_at: generated.created_at || existing?.created_at || new Date().toISOString(),
      title: generated.title || existing?.title,
      caption: generated.caption || existing?.caption,
      description: generated.description || existing?.description,
      hashtags: generated.hashtags?.length ? generated.hashtags : existing?.hashtags,
      status: generated.status || existing?.status || "published",
    });
  }

  return [...byKey.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

const FARM_WS_JWT_PROTOCOL = "atome.jwt";
const TOKEN_KEY = "atome_token";

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split(".")[1];
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function isUsableLegacyToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (typeof payload.exp !== "number") return true;
  return payload.exp * 1000 > Date.now() + 30_000;
}

function farmWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/farm/events`;
}

function farmWsProtocols(): string[] | undefined {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return undefined;
  if (!isUsableLegacyToken(token)) {
    localStorage.removeItem(TOKEN_KEY);
    return undefined;
  }
  return [FARM_WS_JWT_PROTOCOL, token];
}

function mapWsEnvelope(event: FarmWsEnvelope): FarmEvent {
  const eventName: FarmEvent["event"] =
    event.type === "publish_done"
      ? "published"
      : event.type === "publish_failed"
        ? "failed"
        : event.type === "job_started"
          ? "job_started"
          : event.type === "publish_step" || event.type === "command_progress"
            ? "job_progress"
            : event.type === "alert_created"
              ? "error"
              : "heartbeat";
  return {
    event: eventName,
    phone_id: event.phone_id || "",
    account_id: typeof event.payload?.account_id === "string" ? event.payload.account_id : undefined,
    details: { ...(event.payload ?? {}), farm_event_id: event.event_id, farm_type: event.type, scope: event.scope },
    timestamp: event.ts || new Date().toISOString(),
  };
}

function shouldRefreshQueue(type?: string): boolean {
  return type === "connection_ready" || type === "job_queued" || type === "job_started" || type === "publish_done" || type === "publish_failed";
}

function shouldRefreshPhones(type?: string): boolean {
  return type === "connection_ready" || type === "phone_status_changed" || type === "command_progress" || type === "publish_done";
}

export const useFarmStore = create<FarmState>((set, get) => ({
  phones: [],
  accounts: [],
  sportzavodAccounts: [],
  sportzavodThemes: [],
  queue: [],
  activeJobs: [],
  jobEventsById: {},
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
    if (get().phonesLoading) {
      // dedupe: уже идёт запрос — не дёргать новый, иначе pending-stack
      return;
    }
    set({ phonesLoading: true });
    try {
      const res = await apiFetch("/api/farm/phones");
      const phones = listItems((await res.json()) as FarmList<FarmPhoneRecord>).map(mapFarmPhone);
      set({ phones, phonesLoading: false });
    } catch (e) {
      console.warn("fetchPhones failed", e);
      set({ phonesLoading: false });
    }
  },

  fetchAccounts: async () => {
    if (get().accountsLoading) return;
    set({ accountsLoading: true });
    try {
      const res = await apiFetch("/api/farm/accounts?include_identity=true");
      const accounts = listItems((await res.json()) as FarmList<FarmAccountRecord>).map(mapFarmAccount);
      set({ accounts, accountsLoading: false });
    } catch (e) {
      console.warn("fetchAccounts failed", e);
      set({ accountsLoading: false });
    }
  },

  fetchSportzavodAccounts: async () => {
    set({ sportzavodAccountsLoading: true });
    try {
      const res = await apiFetch("/api/sportzavod/accounts", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as Account[];
      const data = raw.filter((account) => account.tenant_id === "sportzavod");
      set({
        sportzavodAccounts: data,
        sportzavodAccountsLoading: false,
      });
    } catch (e) {
      console.warn("fetchSportzavodAccounts failed:", e);
      set({ sportzavodAccounts: [], sportzavodAccountsLoading: false });
    }
  },

  fetchSportzavodThemes: async () => {
    set({ sportzavodThemesLoading: true });
    try {
      const res = await apiFetch("/api/sportzavod/themes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SportZavodTheme[];
      set({
        sportzavodThemes: data,
        sportzavodThemesLoading: false,
      });
    } catch (e) {
      console.warn("fetchSportzavodThemes failed:", e);
      set({ sportzavodThemes: [], sportzavodThemesLoading: false });
    }
  },

  fetchQueue: async () => {
    set({ queueLoading: true });
    try {
      const res = await apiFetch("/api/farm/jobs?limit=100");
      const queue = listItems((await res.json()) as FarmList<FarmJobRecord>).map(mapFarmJob);
      set({ queue, queueLoading: false });
    } catch (e) {
      console.warn("fetchQueue failed", e);
      set({ queueLoading: false });
    }
  },

  fetchJobs: async () => {
    try {
      const res = await apiFetch("/api/jobs");
      if (!res.ok) throw new Error();
      const jobs = (await res.json()) as GenerationJob[];

      if (!get().wsConnected) {
        const prevJobs = get().activeJobs;
        const activity = useActivityStore.getState();
        for (const job of jobs) {
          const prev = prevJobs.find((j) => j.job_id === job.job_id);
          const svcName =
            job.service === "sportzavod"
              ? "SportZavod"
              : job.service === "agentmusic"
                ? "agentMUSIC"
                : "content-zavod";
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

      set({ activeJobs: jobs });
    } catch {
      if (get().activeJobs.length === 0) set({ activeJobs: MOCK_JOBS });
    }
  },

  fetchJobEvents: async (jobId) => {
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/events`);
      if (!res.ok) throw new Error();
      const events = (await res.json()) as GenerationJobEvent[];
      set((state) => ({
        jobEventsById: { ...state.jobEventsById, [jobId]: events.slice(-100) },
      }));
    } catch (e) {
      console.warn("fetchJobEvents failed", e);
    }
  },

  fetchVideos: async (options) => {
    if (!options?.silent) set({ videosLoading: true });
    try {
      const [generatedResult, farmResult] = await Promise.allSettled([
        apiFetch("/api/videos", { cache: "no-store" }),
        apiFetch("/api/farm/content/videos?limit=200", { cache: "no-store" }),
      ]);

      const generatedVideos =
        generatedResult.status === "fulfilled" && generatedResult.value.ok
          ? ((await generatedResult.value.json()) as VideoFile[]).map(normalizeGeneratedVideo)
          : [];

      const farmVideos =
        farmResult.status === "fulfilled" && farmResult.value.ok
          ? listItems((await farmResult.value.json()) as FarmList<FarmContentRecord>).map(mapFarmContent)
          : [];

      const videos = mergeVideoLists(farmVideos, generatedVideos);
      set({ videos, videosLoading: false });
    } catch (e) {
      console.warn("fetchVideos failed", e);
      set({ videosLoading: false });
    }
  },

  pausePhone: async (id) => {
    await apiFetch(`/api/farm/phones/${id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "stop_current_job", payload: { reason: "operator_pause" } }),
    });
    get().fetchPhones();
  },

  resumePhone: async (id) => {
    await apiFetch(`/api/farm/phones/${id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "adb_reconnect", payload: {} }),
    });
    get().fetchPhones();
  },

  createAccount: async (data) => {
    console.warn("createAccount is disabled in farm MVP", data);
    return null;
  },

  updateAccount: async (id, data) => {
    console.warn("updateAccount is disabled in farm MVP", id, data);
    return null;
  },

  reloadFromSheets: async () => {
    await apiFetch("/api/sportzavod/accounts/reload", { method: "POST" });
    await get().fetchSportzavodAccounts();
    return true;
  },

  startGeneration: async (data) => {
    const res = await apiFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: data.service,
        account_ids: data.account_ids,
        videos_per_account: data.videos_per_account,
        topic: data.topic,
      }),
    });
    const job = (await res.json()) as GenerationJob;
    set((s) => ({
      activeJobs: upsertActiveJob(s.activeJobs, {
        id: `${job.job_id}-local-start`,
        job_id: job.job_id,
        service: job.service,
        seq: 0,
        event_type: "job_started",
        phase: job.current_phase ?? "queued",
        message: job.current_message ?? "Generation queued",
        status: job.status,
        progress: job.progress,
        total: job.total,
        percent: job.percent,
        level: "info",
        created_at: job.updated_at ?? job.created_at,
      }),
      jobEventsById: { ...s.jobEventsById, [job.job_id]: s.jobEventsById[job.job_id] ?? [] },
    }));
    return job;
  },

  startAutoGeneration: async (accountIds) => {
    const body: Record<string, unknown> = { videos_per_account: 1 };
    if (accountIds?.length) body.account_ids = accountIds;
    const res = await apiFetch("/api/generate/auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const job = (await res.json()) as GenerationJob;
    set((s) => ({
      activeJobs: upsertActiveJob(s.activeJobs, {
        id: `${job.job_id}-local-start`,
        job_id: job.job_id,
        service: job.service,
        seq: 0,
        event_type: "job_started",
        phase: job.current_phase ?? "queued",
        message: job.current_message ?? "Generation queued",
        status: job.status,
        progress: job.progress,
        total: job.total,
        percent: job.percent,
        level: "info",
        created_at: job.updated_at ?? job.created_at,
      }),
      jobEventsById: { ...s.jobEventsById, [job.job_id]: s.jobEventsById[job.job_id] ?? [] },
    }));
    return job;
  },

  stopJob: async (jobId) => {
    await apiFetch(`/api/jobs/${jobId}/stop`, { method: "POST" });
    await get().fetchJobs();
  },

  stopAllJobs: async () => {
    const res = await apiFetch("/api/jobs/stop-all", { method: "POST" });
    const data = (await res.json()) as { stopped_count: number };
    await get().fetchJobs();
    return data.stopped_count;
  },

  connectWs: () => {
    const existing = get()._socket;
    if (existing) return; // already connected

    const protocols = farmWsProtocols();
    const socket = protocols ? new WebSocket(farmWsUrl(), protocols) : new WebSocket(farmWsUrl());

    socket.onopen = () => {
      set({ wsConnected: true });
      get().fetchQueue();
      get().fetchPhones();
      get().fetchVideos();
    };

    socket.onclose = () => {
      const shouldReconnect = get()._socket === socket;
      if (shouldReconnect) {
        set({ _socket: null, wsConnected: false });
        window.setTimeout(() => get().connectWs(), 2_000);
      } else {
        set({ wsConnected: false });
      }
    };

    socket.onerror = () => {
      set({ wsConnected: false });
    };

    socket.onmessage = (message) => {
      let envelope: FarmWsEnvelope;
      try {
        envelope = JSON.parse(message.data) as FarmWsEnvelope;
      } catch {
        return;
      }
      const event = mapWsEnvelope(envelope);
      set({ lastEvent: event });

      const svcName = (event.details?.service as string) || event.phone_id || "atome-farm";

      const MESSAGE_MAP: Partial<Record<FarmEvent["event"], string>> = {
        job_started: `Job started · ${svcName}`,
        job_complete: `Job complete · ${svcName} · ${event.details?.progress ?? 0}/${event.details?.total ?? 0} videos`,
        job_progress: `${svcName} · ${event.details?.farm_type ?? "running"}`,
        job_log: `${svcName} · ${event.details?.message ?? "log"}`,
        job_error: `Job error · ${svcName}`,
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
        job_error: "error",
        service_offline: "warning",
        job_stopped: "warning",
      };

      // Push to ActivityFeed
      useActivityStore.getState().push({
        id: String(event.details?.farm_event_id ?? `${event.timestamp}-${event.phone_id}-${event.event}`),
        timestamp: event.timestamp,
        service: svcName,
        type: event.event === "failed" ? "error" : (event.event as ActivityEvent["type"]),
        message: MESSAGE_MAP[event.event] ?? event.event,
        severity: SEVERITY_MAP[event.event] ?? "info",
      });

      if (shouldRefreshQueue(envelope.type)) {
        get().fetchQueue();
      }
      if (shouldRefreshPhones(envelope.type)) {
        get().fetchPhones();
      }
    };

    set({ _socket: socket });
  },

  disconnectWs: () => {
    const socket = get()._socket;
    if (socket) {
      set({ _socket: null, wsConnected: false });
      socket.close();
    }
  },
}));
