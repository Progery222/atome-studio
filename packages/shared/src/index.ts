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
  /** Orbit index: 0=SportZavod, 1=content-zavod, 2=atome-farm, 3=StreamCut, 4=agentMUSIC */
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
  { a: 420, b: 100, tilt: 0.22, rgb: "34,211,238" }, // 2 — atome-farm (cyan)
  { a: 460, b: 90, tilt: -0.35, rgb: "255,120,80" }, // 3 — StreamCut (coral)
  { a: 340, b: 130, tilt: -0.25, rgb: "0,200,220" }, // 4 — agentMUSIC (cyan)
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

export type SocialPlatform = "tiktok" | "instagram" | "youtube" | "x";

export type VhaPolicy = "off" | "manual" | "auto";

export interface VhaInfo {
  vha_id: string;
  status?: string | null;
  policy?: VhaPolicy | null;
  current_job_id?: string | null;
}

export interface VhaPersona {
  first_name?: string | null;
  last_name?: string | null;
  niche?: string | null;
  city?: string | null;
  age?: number | null;
  sleep_start?: string | null;
  sleep_end?: string | null;
}

export interface VhaProject {
  project_id: string;
  slug?: string | null;
  name?: string | null;
  niche?: string | null;
}

export interface VhaAccountLite {
  account_id: string;
  platform: string;
  username?: string | null;
  status?: string | null;
  health_status?: string | null;
  plan_id?: string | null;
  plan_state?: string | null;
  theme_key?: string | null;
}

export interface VhaLastDecision {
  ts?: string | null;
  action?: string | null;
  reason?: string | null;
  task_id?: string | null;
}

export interface Phone {
  phone_id: string;
  farm_number?: number | null;
  display_id?: string | null;
  serial_suffix?: string | null;
  display_name?: string | null;
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
  // VHA enrichment (from /api/dashboard/fleet)
  vha?: VhaInfo | null;
  persona?: VhaPersona | null;
  project?: VhaProject | null;
  vha_accounts?: VhaAccountLite[] | null;
  last_decision?: VhaLastDecision | null;
}

export interface FleetGroup {
  project_id: string;
  name?: string | null;
  niche?: string | null;
  vha_count?: number;
  phone_count?: number;
}

export type AccountPlanState =
  | "planned"
  | "bound"
  | "linked"
  | "created"
  | "failed"
  | "archived";

export interface AccountPlan {
  plan_id: string;
  source: string;
  source_external_id?: string | null;
  platform: string;
  username: string;
  email?: string | null;
  theme_key?: string | null;
  theme_name?: string | null;
  state: AccountPlanState;
  bound_phone_id?: string | null;
  bound_vha_id?: string | null;
  bound_account_id?: string | null;
  persona_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  bound_at?: string | null;
  last_synced_at?: string | null;
}

export interface FleetResponse {
  items: Phone[];
  groups?: FleetGroup[];
  total_phones?: number;
  autonomy_enabled?: boolean;
}

export interface AutonomyStatus {
  enabled: boolean;
  interval_sec?: number;
  enabled_serials?: string[];
  running_loop?: boolean;
}

export interface Account {
  account_id: string;
  tenant_id: string;
  phone_id: string;
  platform: SocialPlatform;
  username: string;
  account_group?: string | null;
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
  phone_farm_number?: number | null;
  phone_display_id?: string | null;
  phone_serial_suffix?: string | null;
  phone_display_name?: string | null;
  file_url: string;
  caption: string;
  hashtags: string[];
  platform: SocialPlatform;
  source_service: "sportzavod" | "contentzavod" | "streamcut" | "agentmusic";
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
  source_service: "sportzavod" | "contentzavod" | "streamcut" | "agentmusic";
  url: string;
  thumbnail_url: string;
  size_bytes: number;
  created_at: string;
  status: "queued" | "published" | "rejected";
  /** Populated from companion JSON in MinIO */
  title?: string;
  caption?: string;
  description?: string;
  hashtags?: string[];
}

export interface GenerationJob {
  job_id: string;
  service: "sportzavod" | "contentzavod" | "agentmusic";
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
  latest_log?: string;
  cost_usd?: number; // реальная стоимость пайплайна из сервиса-генератора
  current_phase?: string;
  current_message?: string;
  percent?: number;
  started_at?: string;
  updated_at?: string;
}

export interface GenerationJobEvent {
  id: string;
  job_id: string;
  service: "sportzavod" | "contentzavod" | "agentmusic";
  seq: number;
  event_type:
    | "job_started"
    | "job_complete"
    | "job_stopped"
    | "job_progress"
    | "job_log"
    | "job_error";
  phase: string;
  message: string;
  status: GenerationJob["status"];
  progress: number;
  total: number;
  percent?: number;
  level: "info" | "warning" | "error";
  created_at: string;
  payload?: Record<string, unknown>;
}

// ─── SportZavod types ────────────────────────────────────────────────────────

export interface SportZavodTheme {
  theme_key: string;
  theme_name: string;
  count: number;
}

export type GenerationScope = "all" | "theme" | "account" | "query";

export interface GenerationServiceStats {
  avg_sec: number;
  count: number;
  last_updated: string;
}
export type GenerationStats = Record<string, GenerationServiceStats>;

export interface GenerationCostServiceStats {
  total_usd: number;
  avg_usd_per_video: number;
  videos_count: number;
  jobs_count: number;
}

export interface GenerationCostReport {
  services: Record<string, GenerationCostServiceStats>;
  total: GenerationCostServiceStats;
}

// ─── WebSocket events (Phase 3) ───────────────────────────────────────────────

export interface FarmEvent {
  event:
    | "published"
    | "banned"
    | "error"
    | "failed"
    | "heartbeat"
    | "job_complete"
    | "job_error"
    | "job_log"
    | "job_progress"
    | "job_started"
    | "job_stopped"
    | "service_online"
    | "service_offline";
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
  type:
    | "published"
    | "banned"
    | "error"
    | "job_complete"
    | "job_error"
    | "job_log"
    | "job_progress"
    | "job_started"
    | "job_stopped"
    | "heartbeat"
    | "service_online"
    | "service_offline"
    | "info";
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

// ─── Performance analytics ──────────────────────────────────────────────────

export interface AccountAnalytics {
  account_id: string;
  username: string;
  platform: string;
  total_views: number;
  total_likes: number;
  link_clicks: number;
  avg_views_per_video: number;
}

export interface VideoAnalytics {
  video_id: string;
  title: string;
  account_id: string;
  views: number;
  likes: number;
  link_clicks: number;
  completion_rate: number;
  published_at: string;
}

export interface TrafficSource {
  source: string;
  views: number;
  percentage: number;
}

export interface ConversionPoint {
  ts: number;
  views: number;
  link_clicks: number;
  conversion_rate: number;
}

// ─── StreamCut types ─────────────────────────────────────────────────────────

export type StreamCutJobStatus =
  | "pending"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "cutting"
  | "rendering"
  | "publishing"
  | "done"
  | "error";

export interface StreamCutStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
}

export interface StreamCutShort {
  filename: string;
  url: string;
  title?: string;
  duration?: number;
  score?: number;
}

export interface StreamCutJob {
  job_id: string;
  status: StreamCutJobStatus;
  message: string;
  progress: number;
  steps?: StreamCutStep[];
  shorts?: StreamCutShort[];
  error?: string;
  source_url?: string;
  created_at?: string;
}

export interface StreamCutVideoInfo {
  title: string | null;
  duration: number | null;
  thumbnail: string | null;
  uploader: string | null;
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
  bound_plans_count?: number;
  status: "active" | "inactive";
  created_at: string;
}

// ─── Phone Autonomy ───────────────────────────────────────────────────────────

export type AutonomyState =
  | "idle"
  | "observing"
  | "planning"
  | "acting"
  | "validating"
  | "recovering"
  | "paused"
  | "terminated";

export type AutonomyPauseReason = "human" | "anomaly" | "manual" | null;

export type GoalKind = "browse_fyp" | "warmup_day_1" | "publish_video" | "recover_from_ban";

export type GoalStatus = "pending" | "active" | "completed" | "failed" | "cancelled";

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface PhoneAutonomySession {
  serial: string;
  state: AutonomyState;
  active_goal_id: string | null;
  pause_reason: AutonomyPauseReason;
  started_at: string;
  updated_at: string;
}

export interface PhoneObservation {
  id: string;
  serial: string;
  ts: string;
  screen_summary?: string;
  raw?: Record<string, unknown>;
}

export interface PhoneActionExecution {
  id: string;
  serial: string;
  ts: string;
  action_type: string;
  ok: boolean;
  error?: string;
  duration_ms?: number;
}

export interface PhoneAnomalyEvent {
  id: string;
  serial: string;
  ts: string;
  signature_id: string;
  severity: AnomalySeverity;
  message?: string;
  resolved: boolean;
}

export interface PhoneRecoveryAttempt {
  id: string;
  serial: string;
  ts: string;
  strategy: string;
  anomaly_id?: string;
  success: boolean;
  details?: string;
}

export interface PhoneGoal {
  goal_id: string;
  serial: string;
  kind: GoalKind;
  status: GoalStatus;
  priority: number;
  params?: Record<string, unknown>;
  progress?: { actions_done?: number; total?: number };
  created_at: string;
  updated_at: string;
}

export interface PhoneSelector {
  serials?: string[];
  shard?: string;
  count?: number;
  status?: string;
}

export interface GlobalGoal {
  goal_id: string;
  kind: GoalKind;
  phone_selector: PhoneSelector;
  params?: Record<string, unknown>;
  status: GoalStatus;
  created_at: string;
}

export interface AutonomySessionDetail {
  session: PhoneAutonomySession;
  last_observation?: PhoneObservation;
  last_action?: PhoneActionExecution;
  last_anomaly?: PhoneAnomalyEvent;
}

// ─── System health (per backend) ──────────────────────────────────────────────

export type SystemHealthState = "ok" | "degraded" | "down" | "unknown";

export interface SystemServiceHealth {
  id: string;
  name: string;
  state: SystemHealthState;
  /** ISO timestamp of last successful contact, or null */
  lastSuccessAt: string | null;
  /** seconds since last success, or null if never */
  staleSeconds: number | null;
  /** open circuit since (ISO) when state==="down" or "degraded" */
  circuitOpenSince: string | null;
  /** human note: "5 fails", "circuit open" */
  detail?: string;
}

export interface SystemHealth {
  state: SystemHealthState;
  generatedAt: string;
  uptimeSec: number;
  services: SystemServiceHealth[];
}
// ─── Account creation wizard / jobs ───────────────────────────────────────────

export type ServiceId =
  | "sportzavod"
  | "agentmusic"
  | "streamcut"
  | "content-zavod"
  | string;
export type PlatformId =
  | "google"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "facebook";

export interface ServiceRegistryItem {
  id: ServiceId;
  title: string;
  themes: string[];
}

export interface ServicesRegistryResponse {
  services: ServiceRegistryItem[];
  platforms: PlatformId[];
}

export interface AvailablePhone {
  phone_id: string;
  serial: string;
  phone_status: string;
  accounts_count: number;
  bound_plans_count?: number;
  display_name?: string | null;
  persona_name?: string | null;
  vha_id?: string | null;
  persona_first_name?: string | null;
  persona_last_name?: string | null;
  persona_niche?: string | null;
  last_seen?: string | null;
}

export interface CreateJobBody {
  services: ServiceId[];
  themes: string[];
  platforms: PlatformId[];
  phone_ids?: string[];
  auto_phones_count?: number;
  count_per_phone?: number;
  policy?: Record<string, unknown>;
}

export type JobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled"
  | "partial";

export type StepState =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped"
  | "pending_manual"
  | "cancelled";

export interface JobRow {
  job_id: string;
  status: JobStatus;
  requested_services: string[];
  requested_themes: string[];
  requested_platforms: string[];
  total_steps: number;
  completed_steps: number;
  failed_steps: number;
  pending_manual_steps: number;
  created_at: string;
  finished_at?: string | null;
}

export interface JobDetail extends JobRow {
  phone_ids: string[];
  policy_json?: Record<string, unknown>;
  error_message?: string | null;
  started_at?: string | null;
}

export interface StepRow {
  step_id: string;
  job_id: string;
  phone_id?: string | null;
  serial?: string | null;
  plan_id?: string | null;
  theme_key?: string | null;
  platform: string;
  action: string;
  state: StepState;
  started_at?: string | null;
  finished_at?: string | null;
  duration_sec?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  alex_task_id?: string | null;
}
