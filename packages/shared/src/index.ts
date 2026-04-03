// ─── Service types ────────────────────────────────────────────────────────────

export type ServiceStatus = "online" | "degraded" | "offline" | "error";

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  uptime?: number; // 0–100 %
  activeJobs?: number;
  /** RGB color — computed from status by adapter */
  col: [number, number, number];
  /** Orbit index: 0=SportZavod, 1=content-zavod, 2=Orchestrator */
  oi: number;
  /** Initial angle on orbit (radians) */
  a: number;
  /** Angular speed (rad/frame), sign = direction */
  spd: number;
}

// ─── Status → RGB color ───────────────────────────────────────────────────────

export const STATUS_COLORS: Record<ServiceStatus, [number, number, number]> = {
  online: [22, 168, 78], // deep emerald green
  degraded: [200, 150, 8], // deep amber
  offline: [210, 52, 52], // deep crimson
  error: [210, 52, 52],
};

// ─── Orbit configs ────────────────────────────────────────────────────────────

export interface OrbitConfig {
  /** Semi-major axis */
  a: number;
  /** Semi-minor axis */
  b: number;
  /** Tilt angle in radians */
  tilt: number;
  /** RGB string e.g. '34,197,94' */
  rgb: string;
}

export const ORBIT_CONFIGS: OrbitConfig[] = [
  { a: 380, b: 120, tilt: -0.1, rgb: "210,175,55" }, // 0 — SportZavod (golden)
  { a: 320, b: 150, tilt: 0.45, rgb: "180,150,255" }, // 1 — content-zavod (lavender)
  { a: 420, b: 100, tilt: 0.22, rgb: "150,130,230" }, // 2 — Orchestrator (purple)
];

// ─── Farm stats (returned by GET /api/services/stats) ─────────────────────────

export interface FarmStats {
  phones_online: number;
  phones_total: number;
  accounts_active: number;
  accounts_total: number;
  posts_today: number;
  active_jobs: number;
  last_event?: string;
}

export const EMPTY_FARM_STATS: FarmStats = {
  phones_online: 0,
  phones_total: 0,
  accounts_active: 0,
  accounts_total: 0,
  posts_today: 0,
  active_jobs: 0,
};

// ─── Domain models ────────────────────────────────────────────────────────────

export interface Phone {
  phone_id: string;
  serial: string;
  tenant_id: string;
  model: string;
  status: "active" | "warmup" | "paused" | "offline" | "banned" | "error";
  warmup_day: number;
  health_score: number;
  adb_connected: boolean;
  group: string;
  last_active: string;
  actions_today: number;
  posts_today: number;
  accounts: Account[];
}

export interface Account {
  account_id: string;
  tenant_id: string;
  phone_id: string;
  platform: "tiktok";
  username: string;
  niche: string;
  content_sources: string[];
  heygen_avatar_id?: string;
  post_frequency_hours: number;
  timezone: string;
  health_score: number;
  warmup_day: number;
  status: "active" | "warmup" | "paused" | "banned";
  stats: {
    posts_today: number;
    posts_week: number;
    posts_total: number;
    last_post: string | null;
  };
}

export interface QueueTask {
  task_id: string;
  account_id: string;
  phone_id: string;
  file_url: string;
  caption: string;
  hashtags: string[];
  platform: "tiktok";
  source_service: "sportzavod" | "contentzavod";
  status: "scheduled" | "in_progress" | "published" | "failed";
  scheduled_at: string;
  executed_at?: string;
  created_at: string;
  thumbnail_url?: string;
}

export interface VideoFile {
  filename: string;
  account_id: string;
  tenant_id: string;
  source_service: "sportzavod" | "contentzavod";
  url: string;
  thumbnail_url: string;
  size_bytes: number;
  created_at: string;
  status: "queued" | "published" | "rejected";
}

export interface GenerationJob {
  job_id: string;
  service: "sportzavod" | "contentzavod";
  account_ids: string[];
  topic?: string;
  videos_per_account: number;
  status: "running" | "done" | "error" | "stopped" | "stopping";
  is_auto: boolean;
  progress: number;
  total: number;
  errors_count: number;
  created_at: string;
  results?: { account_id: string; video_url: string }[];
}

// ─── SportZavod types ────────────────────────────────────────────────────────

export interface SportZavodTheme {
  theme_key: string;
  theme_name: string;
  count: number;
}

export type GenerationScope = "all" | "theme" | "account" | "query";

// ─── WebSocket events (Phase 3) ───────────────────────────────────────────────

export interface FarmEvent {
  event: "published" | "banned" | "error" | "failed" | "heartbeat" | "job_complete";
  phone_id: string;
  account_id?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// ─── Sparkline (generic chart utility) ───────────────────────────────────────

export interface SparklinePoint {
  value: number;
  ts: number;
}

// ─── Dashboard analytics types (Phase 6+) ────────────────────────────────────

export interface ServiceMetricsPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  rps: number;
  error_rate: number;
  latency_p50: number;
  latency_p95: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  service: string;
  type: "published" | "banned" | "error" | "job_complete" | "heartbeat" | "info";
  message: string;
  severity: "info" | "warning" | "error";
}

export interface HeroKPI {
  videos_today: number;
  cost_per_video: number;
  publish_rate: number;
  active_accounts: number;
  uptime_percent: number;
  trends: {
    videos_today: number;
    cost_per_video: number;
    publish_rate: number;
    active_accounts: number;
    uptime_percent: number;
  };
}

export interface BotStatus {
  service: string;
  enabled: boolean;
  uptime_seconds: number;
}

export interface MetricsHistoryPoint {
  ts: number;
  videos: number;
  revenue: number;
  cost: number;
  accounts_active: number;
  jobs_completed: number;
}

export interface MetricsHistoryResponse {
  period: string;
  resolution: string;
  points: MetricsHistoryPoint[];
}

// ─── Client (super_admin — Phase 5) ───────────────────────────────────────────

export interface Client {
  client_id: string;
  tenant_id: string;
  name: string;
  email: string;
  plan: "basic" | "pro" | "enterprise";
  phones_limit: number;
  phones_assigned: number;
  accounts_count: number;
  status: "active" | "inactive";
  created_at: string;
}
