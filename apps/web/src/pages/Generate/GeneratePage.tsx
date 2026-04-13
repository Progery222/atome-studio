// agentMUSIC integration v2
import type { Account, GenerationJob, GenerationScope, StreamCutJob } from "@atome/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../../i18n";
import { useFarmStore } from "../../stores/farm";
import { useStreamCutStore } from "../../stores/streamcut";
import styles from "./GeneratePage.module.css";

type Service = "sportzavod" | "contentzavod" | "streamcut" | "agentmusic";
type VideoCount = 1 | 2 | 3 | 5 | 10;

function formatElapsed(iso?: string, nowMs = Date.now()): string {
  if (!iso) return "—";
  const started = Date.parse(iso);
  if (Number.isNaN(started)) return "—";
  const totalSec = Math.max(0, Math.floor((nowMs - started) / 1000));
  if (totalSec > 86400) return "—"; // >24h → started_at is stale/invalid
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) return `${hours}h ${min}m`;
  return `${min}m ${sec}s`;
}

function formatEventClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({
  pct,
  color,
  indeterminate,
  size = 88,
  strokeWidth = 5,
}: {
  pct: number;
  color: string;
  indeterminate: boolean;
  size?: number;
  strokeWidth?: number;
}) {
  const cx = size / 2;
  const r = Math.max(8, (size - strokeWidth - 10) / 2);
  const circumference = 2 * Math.PI * r;
  const offset = indeterminate ? circumference * 0.72 : circumference * (1 - pct / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={indeterminate ? styles.arcIndeterminate : styles.arcDeterminate}
        style={
          indeterminate
            ? { filter: `drop-shadow(0 0 5px ${color})`, transformOrigin: `${cx}px ${cx}px` }
            : {
                filter: `drop-shadow(0 0 5px ${color})`,
                transform: `rotate(-90deg)`,
                transformOrigin: `${cx}px ${cx}px`,
                transition: "stroke-dashoffset 0.6s ease",
              }
        }
      />
    </svg>
  );
}

function getJobStatusColor(job: GenerationJob): string {
  if (job.status === "error") return "#ef4444";
  if (job.status === "stopped") return "#fbbf24";
  if (job.status === "done") return "#22c55e";
  return "rgba(0,210,255,0.85)";
}

const PHASE_KEY_MAP: Record<string, string> = {
  queued: "gen_phase_queued",
  pending: "gen_phase_queued",
  news_fetch: "gen_phase_news_fetch",
  news: "gen_phase_news_fetch",
  stage1_news_fetch: "gen_phase_news_fetch",
  parsing: "gen_phase_parsing",
  parse: "gen_phase_parsing",
  stage2: "gen_phase_parsing",
  script: "gen_phase_script",
  script_writing: "gen_phase_script",
  stage3: "gen_phase_script",
  assets: "gen_phase_assets",
  asset_search: "gen_phase_assets",
  stage4: "gen_phase_assets",
  video_plan: "gen_phase_video_plan",
  stage5: "gen_phase_video_plan",
  meta: "gen_phase_meta",
  metadata: "gen_phase_meta",
  stage6: "gen_phase_meta",
  rendering: "gen_phase_rendering",
  render: "gen_phase_rendering",
  uploading: "gen_phase_uploading",
  upload: "gen_phase_uploading",
  done: "gen_phase_done",
  completed: "gen_phase_done",
  // content-zavod phases
  search: "gen_phase_search",
  relevance: "gen_phase_relevance",
  prompt_saved: "gen_phase_prompt_saved",
  postprocess: "gen_phase_postprocess",
};

function translatePhase(phase: string, t: ReturnType<typeof useT>): string {
  const key = PHASE_KEY_MAP[phase.toLowerCase()];
  if (key) return t(key as Parameters<typeof t>[0]);
  // Unknown phase: return as-is (already clean from sportzavod, etc.)
  return phase;
}

function getJobStatusText(job: GenerationJob, t: ReturnType<typeof useT>): string {
  if (job.status === "running") return t("gen_status_running");
  if (job.status === "stopping") return t("gen_status_stopping");
  if (job.status === "done") return t("gen_status_done");
  if (job.status === "stopped") return t("gen_status_stopped");
  return t("gen_status_error");
}

function getJobStageText(job: GenerationJob, t: ReturnType<typeof useT>): string {
  // For error jobs, show the error message directly
  if (job.status === "error") {
    return (
      job.current_message ??
      job.latest_log
        ?.replace(/<[^>]+>/g, "")
        .trim()
        .split("\n")
        .filter(Boolean)
        .pop() ??
      t("gen_status_error")
    );
  }
  // Prefer translated phase name over raw log messages
  if (job.current_phase) return translatePhase(job.current_phase, t);
  if (job.status === "running") return t("gen_stage_running");
  if (job.status === "done") return t("gen_phase_done");
  return "—";
}

function getJobDisplayPercent(job: GenerationJob, nowMs = Date.now()): number {
  if (job.status === "done") return 100;

  // For stopping/stopped/error — show actual progress, no time-based estimate
  if (job.status === "stopping" || job.status === "stopped" || job.status === "error") {
    return typeof job.percent === "number"
      ? job.percent
      : job.total > 0
        ? Math.round((job.progress / job.total) * 100)
        : 0;
  }

  // Time-based estimate when no sub-video progress and no explicit percent (running only)
  if (
    job.status === "running" &&
    job.total > 0 &&
    job.progress === 0 &&
    typeof job.percent !== "number"
  ) {
    const startMs = job.started_at ? Date.parse(job.started_at) : nowMs;
    const elapsedSec = Number.isNaN(startMs) ? 0 : Math.max(0, (nowMs - startMs) / 1000);
    return Math.min(95, Math.floor(elapsedSec / 3)); // ~1% per 3 sec, cap at 95
  }

  const basePercent =
    typeof job.percent === "number"
      ? job.percent
      : job.total > 0
        ? Math.round((job.progress / job.total) * 100)
        : 0;
  if (job.status === "running" && job.total > 0) {
    return Math.max(0, Math.min(99, basePercent));
  }
  return Math.max(0, Math.min(100, basePercent));
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function GeneratePage() {
  const t = useT();
  const accounts = useFarmStore((s) => s.accounts);
  const accountsLoading = useFarmStore((s) => s.accountsLoading);
  const fetchAccounts = useFarmStore((s) => s.fetchAccounts);
  const sportzavodAccounts = useFarmStore((s) => s.sportzavodAccounts);
  const sportzavodAccountsLoading = useFarmStore((s) => s.sportzavodAccountsLoading);
  const fetchSportzavodAccounts = useFarmStore((s) => s.fetchSportzavodAccounts);
  const sportzavodThemes = useFarmStore((s) => s.sportzavodThemes);
  const fetchSportzavodThemes = useFarmStore((s) => s.fetchSportzavodThemes);
  const startGeneration = useFarmStore((s) => s.startGeneration);
  const startAutoGeneration = useFarmStore((s) => s.startAutoGeneration);
  const reloadFromSheets = useFarmStore((s) => s.reloadFromSheets);
  const activeJobs = useFarmStore((s) => s.activeJobs);
  const jobEventsById = useFarmStore((s) => s.jobEventsById);
  const fetchJobs = useFarmStore((s) => s.fetchJobs);
  const fetchJobEvents = useFarmStore((s) => s.fetchJobEvents);
  const stopJob = useFarmStore((s) => s.stopJob);
  const stopAllJobs = useFarmStore((s) => s.stopAllJobs);

  // StreamCut
  const scJobs = useStreamCutStore((s) => s.jobs);
  const scJobsLoading = useStreamCutStore((s) => s.jobsLoading);
  const scVideoInfo = useStreamCutStore((s) => s.videoInfo);
  const scVideoInfoLoading = useStreamCutStore((s) => s.videoInfoLoading);
  const scCreating = useStreamCutStore((s) => s.creating);
  const scFetchJobs = useStreamCutStore((s) => s.fetchJobs);
  const scCreateJob = useStreamCutStore((s) => s.createJob);
  const scDeleteJob = useStreamCutStore((s) => s.deleteJob);
  const scFetchVideoInfo = useStreamCutStore((s) => s.fetchVideoInfo);
  const scClearVideoInfo = useStreamCutStore((s) => s.clearVideoInfo);
  const scFootageCategories = useStreamCutStore((s) => s.footageCategories);
  const scFetchFootageCategories = useStreamCutStore((s) => s.fetchFootageCategories);

  const [service, setService] = useState<Service>("sportzavod");
  const [scope, setScope] = useState<GenerationScope | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [videosPerAcc, setVideosPerAcc] = useState<VideoCount>(1);
  const [topic, setTopic] = useState("");
  const [nicheFilter, setNicheFilter] = useState<string | null>(null);
  const [nicheOpen, setNicheOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [scopeLabel, setScopeLabel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Account[] | null>(null);
  const [accountInput, setAccountInput] = useState("");
  const [accountError, setAccountError] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  // agentMUSIC form state
  const [amScenario, setAmScenario] = useState<"karaoke" | "streamer">("karaoke");
  const [amOrientation, setAmOrientation] = useState<"portrait" | "landscape">("portrait");
  const [amBgType, setAmBgType] = useState<"footage" | "animated">("footage");
  const [amSpotifyUrl, setAmSpotifyUrl] = useState("");
  const [amSpotifyLoading, setAmSpotifyLoading] = useState(false);
  const [amTracks, setAmTracks] = useState<Array<{ id: string; title: string; artist: string; duration: number }>>([]);
  const [amChoruses, setAmChoruses] = useState<Array<{ id: string; name: string; track_id: string; variant: string }>>([]);
  const [amSelectedChorus, setAmSelectedChorus] = useState<string | null>(null);
  const [amTracksLoading, setAmTracksLoading] = useState(false);

  const amLoadData = useCallback(async () => {
    setAmTracksLoading(true);
    try {
      const [trRes, chRes] = await Promise.all([
        apiFetch("/api/agentmusic/tracks"),
        apiFetch("/api/agentmusic/choruses"),
      ]);
      if (trRes.ok) setAmTracks(await trRes.json());
      if (chRes.ok) setAmChoruses(await chRes.json());
    } catch {}
    setAmTracksLoading(false);
  }, []);

  const amHandleSpotify = useCallback(async () => {
    if (!amSpotifyUrl.trim() || amSpotifyLoading) return;
    setAmSpotifyLoading(true);
    try {
      const res = await apiFetch("/api/agentmusic/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: amSpotifyUrl }),
      });
      if (res.ok) {
        setAmSpotifyUrl("");
        await amLoadData();
      }
    } catch {}
    setAmSpotifyLoading(false);
  }, [amSpotifyUrl, amSpotifyLoading, amLoadData]);

  const amHandleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAmTracksLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch("/api/agentmusic/upload", { method: "POST", body: form });
      if (res.ok) await amLoadData();
    } catch {}
    setAmTracksLoading(false);
    e.target.value = "";
  }, [amLoadData]);

  // StreamCut form state
  const [scUrl, setScUrl] = useState("");
  const [scLanguage, setScLanguage] = useState("auto");
  const [scMaxShorts, setScMaxShorts] = useState(5);
  const [scCaptionStyle, setScCaptionStyle] = useState("karaoke");
  const [scReframeMode, setScReframeMode] = useState("ai");
  const [scAddMusic, setScAddMusic] = useState("auto");
  const [scFootageLayout, setScFootageLayout] = useState("footage_bottom");
  const [scFootageCategory, setScFootageCategory] = useState("");
  const [scCaptionPosition, setScCaptionPosition] = useState("auto");
  const [scMinDuration, setScMinDuration] = useState(15);
  const [scMaxDuration, setScMaxDuration] = useState(60);
  const [scSrtText, setScSrtText] = useState("");
  const nicheRef = useRef<HTMLDivElement>(null);
  const scPollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (service === "sportzavod") {
      fetchSportzavodAccounts();
      fetchSportzavodThemes();
    } else if (service === "agentmusic") {
      amLoadData();
    } else {
      fetchAccounts();
    }
  }, [service, fetchAccounts, fetchSportzavodAccounts, fetchSportzavodThemes, amLoadData]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nicheRef.current && !nicheRef.current.contains(e.target as Node)) setNicheOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // StreamCut polling when selected
  useEffect(() => {
    if (service === "streamcut") {
      scFetchJobs();
      scFetchFootageCategories();
      scPollRef.current = setInterval(() => scFetchJobs(), 5000);
    }
    return () => clearInterval(scPollRef.current);
  }, [service]);

  const activeAccounts = service === "sportzavod" ? sportzavodAccounts : accounts;
  const isLoading = service === "sportzavod" ? sportzavodAccountsLoading : accountsLoading;
  const readyAccounts = activeAccounts.filter((a) => a.heygen_avatar_id);
  const allNiches = [...new Set(activeAccounts.map((a) => a.niche).filter(Boolean))];
  const visibleAccounts = nicheFilter
    ? activeAccounts.filter((a) => a.niche === nicheFilter)
    : activeAccounts;
  const runningJobs = activeJobs.filter((j) => j.status === "running" || j.status === "stopping");
  const visibleJobs = [...activeJobs]
    .sort((a, b) => {
      const rank = (job: GenerationJob) =>
        job.status === "running"
          ? 0
          : job.status === "stopping"
            ? 1
            : job.status === "error"
              ? 2
              : job.status === "done"
                ? 3
                : 4;
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      return Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at);
    })
    .slice(0, 8);
  const withAvatar = activeAccounts.filter((a) => a.heygen_avatar_id).length;
  const withoutAvatar = activeAccounts.length - withAvatar;

  useEffect(() => {
    for (const job of visibleJobs) {
      if (!(job.job_id in jobEventsById)) {
        fetchJobEvents(job.job_id);
      }
    }
  }, [visibleJobs, jobEventsById, fetchJobEvents]);

  const toggleAll = () => {
    const validVisible = visibleAccounts.filter((a) => a.heygen_avatar_id);
    if (selectedIds.size === validVisible.length && validVisible.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(validVisible.map((a) => a.account_id)));
    }
  };

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Scope handlers ──

  const handleScopeAll = useCallback(() => {
    const ids = readyAccounts.map((a) => a.account_id);
    setSelectedIds(new Set(ids));
    setScopeLabel(`${t("gen_scope_all")} (${ids.length})`);
    setScope(null);
    setShowConfirm(true);
  }, [readyAccounts, t]);

  const handleScopeTheme = useCallback(
    (themeKey: string) => {
      const ids = activeAccounts
        .filter((a) => a.niche === themeKey && a.heygen_avatar_id)
        .map((a) => a.account_id);
      setSelectedIds(new Set(ids));
      setScopeLabel(`${themeKey} (${ids.length} ${t("gen_accs_abbr")})`);
      setScope(null);
      setShowConfirm(true);
    },
    [activeAccounts, t]
  );

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const lower = searchQuery.toLowerCase();
    const found = activeAccounts.filter(
      (a) =>
        a.username.toLowerCase().includes(lower) ||
        a.niche.toLowerCase().includes(lower) ||
        a.account_id.toLowerCase().includes(lower)
    );
    setSearchResults(found);
  };

  const handleSearchSelect = (accs: Account[]) => {
    const ids = accs.map((a) => a.account_id);
    setSelectedIds(new Set(ids));
    setScopeLabel(`${t("gen_scope_search")}: ${searchQuery} (${ids.length} ${t("gen_accs_abbr")})`);
    setScope(null);
    setSearchResults(null);
    setSearchQuery("");
    setShowConfirm(true);
  };

  const handleAccountSubmit = useCallback(() => {
    const val = accountInput.trim();
    if (!val) return;
    const acc = activeAccounts.find(
      (a) => a.account_id === val || a.username.toLowerCase() === val.toLowerCase()
    );
    if (!acc) {
      setAccountError(`"${val}" ${t("gen_err_not_found")}`);
      return;
    }
    if (!acc.heygen_avatar_id) {
      setAccountError(`@${acc.username} — ${t("gen_err_no_avatar")}`);
      return;
    }
    setSelectedIds(new Set([acc.account_id]));
    setScopeLabel(`@${acc.username}`);
    setScope(null);
    setAccountInput("");
    setAccountError("");
    setShowConfirm(true);
  }, [accountInput, activeAccounts, t]);

  const handleLaunch = async () => {
    if (launching) return;
    if (service === "contentzavod" && !topic.trim()) return;
    if (service === "sportzavod" && selectedIds.size === 0) return;
    setLaunching(true);
    setLaunchError("");
    try {
      await startGeneration({
        service: service as "sportzavod" | "contentzavod" | "agentmusic",
        account_ids:
          service === "contentzavod" && selectedIds.size === 0 ? ["default"]
            : service === "agentmusic" ? ["telegram"]
            : [...selectedIds],
        videos_per_account: videosPerAcc,
        topic: service === "contentzavod" ? topic
          : service === "agentmusic" ? JSON.stringify({ scenario: amScenario, orientation: amOrientation, bg_type: amBgType })
          : undefined,
      });
      setShowConfirm(false);
    } catch (e: any) {
      setLaunchError(e.message || t("gen_status_error"));
    } finally {
      setLaunching(false);
    }
  };

  const handleAutoMode = async () => {
    setLaunching(true);
    try {
      await startAutoGeneration(selectedIds.size > 0 ? [...selectedIds] : undefined);
    } catch (e: any) {
      alert(e.message || "Failed to start auto generation");
    } finally {
      setLaunching(false);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await reloadFromSheets();
      if (service === "sportzavod") {
        await fetchSportzavodAccounts();
        await fetchSportzavodThemes();
      }
    } catch (e: any) {
      alert(e.message || "Failed to reload accounts");
    } finally {
      setReloading(false);
    }
  };

  // ── Confirmation overlay ──
  if (showConfirm) {
    const total = selectedIds.size * videosPerAcc;
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <div className={styles.title}>
              <button
                className={styles.backBtn}
                onClick={() => {
                  setShowConfirm(false);
                  setSelectedIds(new Set());
                }}
              >
                &larr;
              </button>
              {t("gen_confirm_title")}
            </div>
            <div className={styles.subtitle}>{t("gen_confirm_sub")}</div>
          </div>
        </header>
        <div className={styles.confirmCard}>
          <div className={styles.confirmGrid}>
            <div className={styles.confirmCell}>
              <span className={styles.confirmCellLabel}>{t("gen_confirm_scope")}</span>
              <span className={styles.confirmCellValue}>{scopeLabel}</span>
            </div>
            <div className={styles.confirmCell}>
              <span className={styles.confirmCellLabel}>{t("gen_confirm_vpa")}</span>
              <span className={styles.confirmCellValue}>{videosPerAcc}</span>
            </div>
            <div className={styles.confirmCell}>
              <span className={styles.confirmCellLabel}>{t("gen_confirm_accounts")}</span>
              <span className={styles.confirmCellValue}>{selectedIds.size}</span>
            </div>
            <div className={`${styles.confirmCell} ${styles.confirmCellHighlight}`}>
              <span className={styles.confirmCellLabel}>{t("gen_confirm_total")}</span>
              <span className={styles.confirmCellBig}>{total}</span>
            </div>
          </div>
          {launchError && (
            <div className={styles.errorText} style={{ textAlign: "center", marginBottom: "16px" }}>
              {launchError}
            </div>
          )}
          <div className={styles.confirmActions}>
            <button className={styles.launchBtn} onClick={handleLaunch} disabled={launching}>
              {launching ? t("gen_launching") : t("generate_run")}
            </button>
            <button
              className={styles.btnGhost}
              onClick={() => {
                setShowConfirm(false);
                setSelectedIds(new Set());
              }}
            >
              {t("generate_cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ──
  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div>
          <div className={styles.title}>{t("generate_title")}</div>
          <div className={styles.subtitle}>{t("gen_subtitle")}</div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnGhost} onClick={handleReload} disabled={reloading}>
            {reloading ? t("gen_reloading") : t("gen_reload")}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* ════════════ LEFT COLUMN ════════════ */}
        <div className={styles.colMain}>
          {/* ── 1. Service toggle ── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>{t("gen_service_card")}</div>
            <div className={styles.serviceTabs}>
              {(["sportzavod", "contentzavod", "streamcut", "agentmusic"] as Service[]).map((svc) => {
                const label =
                  svc === "sportzavod"
                    ? "SportZavod"
                    : svc === "contentzavod"
                      ? "content-zavod"
                      : svc === "agentmusic"
                        ? "agentMUSIC"
                        : "StreamCut";
                const dot =
                  svc === "sportzavod" ? "#d4af37" : svc === "contentzavod" ? "#b496ff" : svc === "agentmusic" ? "#00c8dc" : "#00d2ff";
                return (
                  <button
                    key={svc}
                    className={`${styles.serviceTab} ${service === svc ? styles.serviceTabActive : ""}`}
                    onClick={() => {
                      setService(svc);
                      setSelectedIds(new Set());
                      setNicheFilter(null);
                      setScope(null);
                    }}
                  >
                    <span className={styles.serviceTabDot} style={{ background: dot }} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Stats bar */}
            {service === "sportzavod" && activeAccounts.length > 0 && (
              <div className={styles.statsBar}>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{activeAccounts.length}</span>
                  <span className={styles.statLabel}>{t("gen_stat_accounts")}</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statNum} style={{ color: "#22c55e" }}>
                    {withAvatar}
                  </span>
                  <span className={styles.statLabel}>{t("gen_stat_with_avatar")}</span>
                </div>
                {withoutAvatar > 0 && (
                  <>
                    <div className={styles.statDivider} />
                    <div className={styles.stat}>
                      <span className={styles.statNum} style={{ color: "#fbbf24" }}>
                        {withoutAvatar}
                      </span>
                      <span className={styles.statLabel}>{t("gen_stat_no_avatar")}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── 2. Scope selection (SportZavod) ── */}
          {service === "sportzavod" && !scope && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>{t("gen_scope_title")}</div>
              <div className={styles.scopeGrid}>
                <button className={styles.scopeCard} onClick={handleScopeAll}>
                  <span className={styles.scopeCardIcon}>*</span>
                  <div className={styles.scopeCardText}>
                    <span className={styles.scopeCardTitle}>{t("gen_scope_all")}</span>
                    <span className={styles.scopeCardSub}>
                      {readyAccounts.length} {t("gen_scope_ready")}
                    </span>
                  </div>
                </button>
                <button className={styles.scopeCard} onClick={() => setScope("theme")}>
                  <span className={styles.scopeCardIcon}>#</span>
                  <div className={styles.scopeCardText}>
                    <span className={styles.scopeCardTitle}>{t("gen_scope_theme")}</span>
                    <span className={styles.scopeCardSub}>
                      {sportzavodThemes.length} {t("gen_scope_themes_count")}
                    </span>
                  </div>
                </button>
                <button className={styles.scopeCard} onClick={() => setScope("account")}>
                  <span className={styles.scopeCardIcon}>@</span>
                  <div className={styles.scopeCardText}>
                    <span className={styles.scopeCardTitle}>{t("gen_scope_account")}</span>
                    <span className={styles.scopeCardSub}>{t("gen_scope_by_id")}</span>
                  </div>
                </button>
                <button className={styles.scopeCard} onClick={() => setScope("query")}>
                  <span className={styles.scopeCardIcon}>?</span>
                  <div className={styles.scopeCardText}>
                    <span className={styles.scopeCardTitle}>{t("gen_scope_search")}</span>
                    <span className={styles.scopeCardSub}>NBA, MMA, F1...</span>
                  </div>
                </button>
              </div>
              <button className={styles.autoBtn} onClick={handleAutoMode} disabled={launching}>
                {launching ? t("gen_launching") : t("gen_auto_btn")}
              </button>
            </div>
          )}

          {/* ── 2a. Theme picker ── */}
          {scope === "theme" && (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <button className={styles.backBtnSmall} onClick={() => setScope(null)}>
                  &larr;
                </button>
                <div className={styles.cardTitle}>{t("gen_theme_picker")}</div>
              </div>
              <div className={styles.themeGrid}>
                {sportzavodThemes.map((theme) => (
                  <button
                    key={theme.theme_key}
                    className={styles.themeChip}
                    onClick={() => handleScopeTheme(theme.theme_key)}
                  >
                    {theme.theme_key}
                    <span className={styles.themeChipCount}>{theme.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 2b. Search ── */}
          {scope === "query" && (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <button
                  className={styles.backBtnSmall}
                  onClick={() => {
                    setScope(null);
                    setSearchResults(null);
                    setSearchQuery("");
                  }}
                >
                  &larr;
                </button>
                <div className={styles.cardTitle}>{t("gen_search_title")}</div>
              </div>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  placeholder="NBA, NFL, soccer, MMA, F1, boxing..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button className={styles.btnPrimary} onClick={handleSearch}>
                  {t("gen_search_btn")}
                </button>
              </div>
              {searchResults !== null && searchResults.length === 0 && (
                <div className={styles.emptySmall}>{t("gen_no_results")}</div>
              )}
              {searchResults && searchResults.length > 0 && (
                <div className={styles.searchResult}>
                  <span>
                    {searchResults.length} {t("gen_stat_accounts")}:{" "}
                    {[...new Set(searchResults.map((a) => a.niche))].join(", ")}
                  </span>
                  <button
                    className={styles.btnPrimary}
                    onClick={() => handleSearchSelect(searchResults)}
                  >
                    {t("gen_account_btn")} ({searchResults.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── 2c. Account ID input ── */}
          {scope === "account" && (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <button
                  className={styles.backBtnSmall}
                  onClick={() => {
                    setScope(null);
                    setAccountInput("");
                    setAccountError("");
                  }}
                >
                  &larr;
                </button>
                <div className={styles.cardTitle}>{t("gen_account_title")}</div>
              </div>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  placeholder="ID / @username"
                  value={accountInput}
                  onChange={(e) => {
                    setAccountInput(e.target.value);
                    setAccountError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleAccountSubmit()}
                />
                <button className={styles.btnPrimary} onClick={handleAccountSubmit}>
                  {t("gen_account_btn")}
                </button>
              </div>
              {accountError && <div className={styles.errorText}>{accountError}</div>}
            </div>
          )}

          {/* ── 3. Settings row (sportzavod / contentzavod only) ── */}
          {service !== "streamcut" && (
            <div className={styles.settingsRow}>
              <div className={styles.cardSmall}>
                <div className={styles.cardTitle}>{t("gen_vpa_card")}</div>
                <div className={styles.countGroup}>
                  {([1, 2, 3, 5] as VideoCount[]).map((n) => (
                    <button
                      key={n}
                      className={`${styles.countBtn} ${videosPerAcc === n ? styles.countBtnActive : ""}`}
                      onClick={() => setVideosPerAcc(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {service === "contentzavod" && (
                <div className={styles.cardSmall} style={{ flex: 1 }}>
                  <div className={styles.cardTitle}>{t("generate_topic")}</div>
                  <input
                    className={styles.input}
                    placeholder={t("gen_topic_ph")}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── 3b. StreamCut form ── */}
          {service === "streamcut" && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>StreamCut — {t("streamcut_subtitle")}</div>

              {/* URL input */}
              <div className={styles.scUrlRow}>
                <input
                  className={styles.scUrlInput}
                  type="text"
                  value={scUrl}
                  onChange={(e) => setScUrl(e.target.value)}
                  placeholder={t("gen_sc_url_ph")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && scUrl.trim()) scFetchVideoInfo(scUrl.trim());
                  }}
                />
                <button
                  type="button"
                  className={styles.scInfoBtn}
                  onClick={() => scUrl.trim() && scFetchVideoInfo(scUrl.trim())}
                  disabled={scVideoInfoLoading || !scUrl.trim()}
                >
                  {scVideoInfoLoading ? "..." : t("gen_sc_fetch_info")}
                </button>
              </div>

              {/* Video preview */}
              {scVideoInfo && (
                <div className={styles.scVideoPreview}>
                  {scVideoInfo.thumbnail && (
                    <img src={scVideoInfo.thumbnail} alt="" className={styles.scThumbnail} />
                  )}
                  <div className={styles.scVideoMeta}>
                    <div className={styles.scVideoTitle}>{scVideoInfo.title || "—"}</div>
                    <div className={styles.scVideoDuration}>
                      {t("gen_sc_duration")}:{" "}
                      {scVideoInfo.duration
                        ? `${Math.floor(scVideoInfo.duration / 60)}:${String(Math.round(scVideoInfo.duration % 60)).padStart(2, "0")}`
                        : "—"}
                      {scVideoInfo.uploader && ` · ${scVideoInfo.uploader}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Options */}
              <div className={styles.scOptions}>
                {/* Row 1: Language, Max shorts, Captions, Reframe */}
                <div className={styles.scField}>
                  <label>{t("gen_sc_language")}</label>
                  <select value={scLanguage} onChange={(e) => setScLanguage(e.target.value)}>
                    <option value="auto">Auto</option>
                    <option value="ru">Russian</option>
                    <option value="en">English</option>
                    <option value="zh">Chinese</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>
                <div className={styles.scField}>
                  <label>{t("gen_sc_max_shorts")}</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={scMaxShorts}
                    onChange={(e) => setScMaxShorts(Number(e.target.value))}
                  />
                </div>
                <div className={styles.scField}>
                  <label>{t("gen_sc_caption_style")}</label>
                  <select
                    value={scCaptionStyle}
                    onChange={(e) => setScCaptionStyle(e.target.value)}
                  >
                    {["default", "karaoke", "glow", "bold", "highlight", "minimal"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.scField}>
                  <label>{t("gen_sc_reframe")}</label>
                  <select value={scReframeMode} onChange={(e) => setScReframeMode(e.target.value)}>
                    <option value="center">center</option>
                    <option value="ai">AI-tracking</option>
                  </select>
                </div>

                {/* Row 2: Music, Footage layout, Footage category, Caption position */}
                <div className={styles.scField}>
                  <label>{t("gen_sc_music")}</label>
                  <select value={scAddMusic} onChange={(e) => setScAddMusic(e.target.value)}>
                    <option value="auto">{t("gen_sc_music_auto")}</option>
                    <option value="none">none</option>
                    <option value="upbeat">upbeat</option>
                    <option value="calm">calm</option>
                    <option value="motivation">motivation</option>
                  </select>
                </div>
                <div className={styles.scField}>
                  <label>{t("gen_sc_footage_layout")}</label>
                  <select
                    value={scFootageLayout}
                    onChange={(e) => setScFootageLayout(e.target.value)}
                  >
                    <option value="none">{t("gen_sc_footage_none")}</option>
                    <option value="background">{t("gen_sc_footage_bg")}</option>
                    <option value="footage_top">{t("gen_sc_footage_top")}</option>
                    <option value="footage_bottom">{t("gen_sc_footage_bottom")}</option>
                  </select>
                </div>
                <div className={styles.scField}>
                  <label>{t("gen_sc_footage_category")}</label>
                  <select
                    value={scFootageCategory}
                    onChange={(e) => setScFootageCategory(e.target.value)}
                    disabled={scFootageLayout === "none"}
                  >
                    <option value="">{t("gen_sc_footage_cat_any")}</option>
                    {scFootageCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.scField}>
                  <label>{t("gen_sc_caption_pos")}</label>
                  <select
                    value={scCaptionPosition}
                    onChange={(e) => setScCaptionPosition(e.target.value)}
                  >
                    <option value="auto">{t("gen_sc_caption_pos_auto")}</option>
                    <option value="fixed_bottom">{t("gen_sc_caption_pos_bottom")}</option>
                  </select>
                </div>

                {/* Row 3: Min/Max duration */}
                <div className={styles.scField}>
                  <label>{t("gen_sc_min_dur")}</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={scMinDuration}
                    onChange={(e) => setScMinDuration(Number(e.target.value))}
                  />
                </div>
                <div className={styles.scField}>
                  <label>{t("gen_sc_max_dur")}</label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={scMaxDuration}
                    onChange={(e) => setScMaxDuration(Number(e.target.value))}
                  />
                </div>

                {/* Row 4: SRT timecodes (full width) */}
                <div className={`${styles.scField} ${styles.scFieldFull}`}>
                  <label>{t("gen_sc_srt_label")}</label>
                  <textarea
                    className={styles.scTextarea}
                    placeholder={t("gen_sc_srt_ph")}
                    value={scSrtText}
                    onChange={(e) => setScSrtText(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Launch */}
              <div className={styles.cardFooter}>
                <button
                  className={styles.launchBtn}
                  disabled={scCreating || !scUrl.trim()}
                  onClick={async () => {
                    if (!scUrl.trim()) return;
                    const dto: Record<string, unknown> = {
                      url: scUrl.trim(),
                      language: scLanguage,
                      max_shorts: scMaxShorts,
                      caption_style: scCaptionStyle,
                      reframe_mode: scReframeMode,
                      add_music: scAddMusic,
                      footage_layout: scFootageLayout,
                      caption_position: scCaptionPosition,
                      min_duration: scMinDuration,
                      max_duration: scMaxDuration,
                    };
                    if (scFootageLayout !== "none" && scFootageCategory) {
                      dto.footage_category = scFootageCategory;
                    }
                    if (scSrtText.trim()) {
                      const timecodes = scSrtText
                        .trim()
                        .split("\n")
                        .map((line) => {
                          const [start, end, ...rest] = line.split(",");
                          return {
                            start: Number.parseFloat(start),
                            end: Number.parseFloat(end),
                            title: rest.join(",").trim() || undefined,
                          };
                        })
                        .filter((tc) => !Number.isNaN(tc.start) && !Number.isNaN(tc.end));
                      if (timecodes.length > 0) dto.srt_timecodes = timecodes;
                    }
                    await scCreateJob(dto);
                    setScUrl("");
                    scClearVideoInfo();
                  }}
                >
                  {scCreating ? t("gen_sc_launching") : t("gen_sc_launch")}
                </button>
              </div>
            </div>
          )}

          {/* ── 4. Account list (SportZavod) / Launch button (content-zavod) ── */}
          {service === "contentzavod" && (
            <div className={styles.card}>
              <div className={styles.cardFooter}>
                <button
                  className={styles.launchBtn}
                  disabled={!topic.trim() || launching}
                  onClick={() => {
                    setScopeLabel(topic.trim());
                    setShowConfirm(true);
                  }}
                >
                  {launching ? t("gen_launching") : t("gen_launch_btn")}
                </button>
              </div>
            </div>
          )}
          {service === "agentmusic" && (
            <>
              {/* Сценарий */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Сценарий</div>
                <div className={styles.serviceTabs}>
                  {(["karaoke", "streamer"] as const).map((sc) => (
                    <button
                      key={sc}
                      className={`${styles.serviceTab} ${amScenario === sc ? styles.serviceTabActive : ""}`}
                      onClick={() => setAmScenario(sc)}
                    >
                      <span className={styles.serviceTabDot} style={{ background: sc === "karaoke" ? "#00c8dc" : "#ff7850" }} />
                      {sc === "karaoke" ? "🎤 Караоке" : "🎮 Стример + Футаж"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Трек: загрузка или Spotify */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Трек {amTracksLoading && <span className={styles.loading}> загрузка...</span>}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    className={styles.input}
                    placeholder="Spotify ссылка (трек или артист)..."
                    value={amSpotifyUrl}
                    onChange={(e) => setAmSpotifyUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && amHandleSpotify()}
                    style={{ flex: 1 }}
                  />
                  <button
                    className={styles.launchBtn}
                    disabled={!amSpotifyUrl.trim() || amSpotifyLoading}
                    onClick={amHandleSpotify}
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    {amSpotifyLoading ? "..." : "Загрузить"}
                  </button>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#999", fontSize: 13 }}>
                  <input type="file" accept="audio/*" onChange={amHandleUpload} style={{ display: "none" }} />
                  📁 Или загрузить файл
                </label>
                {amTracks.length > 0 && (
                  <div style={{ marginTop: 12, maxHeight: 150, overflowY: "auto" }}>
                    {amTracks.slice(0, 20).map((tr) => (
                      <div key={tr.id} style={{ padding: "6px 0", borderBottom: "1px solid #222", fontSize: 13, color: "#ccc" }}>
                        🎵 {tr.artist ? `${tr.artist} — ` : ""}{tr.title}
                        <span style={{ color: "#666", marginLeft: 8 }}>{tr.duration ? `${Math.round(tr.duration)}s` : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Выбор припева */}
              {amChoruses.length > 0 && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>Припев ({amChoruses.length})</div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {amChoruses.map((ch) => (
                      <button
                        key={ch.id}
                        className={`${styles.serviceTab} ${amSelectedChorus === ch.id ? styles.serviceTabActive : ""}`}
                        onClick={() => setAmSelectedChorus(amSelectedChorus === ch.id ? null : ch.id)}
                        style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }}
                      >
                        🎤 {ch.name}
                        <span style={{ color: "#666", fontSize: 11, marginLeft: 8 }}>{ch.variant}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Фон (только караоке) */}
              {amScenario === "karaoke" && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>Фон</div>
                  <div className={styles.serviceTabs}>
                    {(["footage", "animated"] as const).map((bg) => (
                      <button
                        key={bg}
                        className={`${styles.serviceTab} ${amBgType === bg ? styles.serviceTabActive : ""}`}
                        onClick={() => setAmBgType(bg)}
                      >
                        {bg === "footage" ? "🎬 Видео-футаж" : "✨ Анимированный"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Количество видео */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Количество видео</div>
                <div className={styles.countGroup}>
                  {([1, 2, 3, 5, 10] as number[]).map((n) => (
                    <button
                      key={n}
                      className={`${styles.countBtn} ${videosPerAcc === n ? styles.countBtnActive : ""}`}
                      onClick={() => setVideosPerAcc(n as VideoCount)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ориентация */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Ориентация</div>
                <div className={styles.serviceTabs}>
                  {(["portrait", "landscape"] as const).map((o) => (
                    <button
                      key={o}
                      className={`${styles.serviceTab} ${amOrientation === o ? styles.serviceTabActive : ""}`}
                      onClick={() => setAmOrientation(o)}
                    >
                      {o === "portrait" ? "📱 Портрет (1080×1920)" : "🖥 Альбом (1920×1080)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Запуск */}
              <div className={styles.card}>
                <div className={styles.cardFooter}>
                  <button
                    className={styles.launchBtn}
                    disabled={launching}
                    onClick={() => {
                      setScopeLabel(`agentMUSIC · ${amScenario} · ${amOrientation}`);
                      setShowConfirm(true);
                    }}
                  >
                    {launching ? t("gen_launching") : `Запустить ${amScenario === "karaoke" ? "караоке" : "стример"}`}
                  </button>
                </div>
              </div>
            </>
          )}
          {service === "sportzavod" && (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>
                  {t("gen_accs_title")}
                  {isLoading && <span className={styles.loading}> {t("gen_loading_sm")}</span>}
                </div>
                <span className={styles.selBadge}>
                  {selectedIds.size} {t("gen_selected")}
                </span>
              </div>

              <div className={styles.filterRow}>
                <button
                  className={`${styles.filterChip} ${nicheFilter === null ? styles.filterChipActive : ""}`}
                  onClick={() => {
                    setNicheFilter(null);
                    setNicheOpen(false);
                  }}
                >
                  {t("gen_all_filter")}
                </button>
                <div className={styles.nicheDropdown} ref={nicheRef}>
                  <button
                    className={`${styles.filterChip} ${nicheFilter !== null ? styles.filterChipActive : ""}`}
                    onClick={() => setNicheOpen((o) => !o)}
                  >
                    {nicheFilter || t("gen_niche_filter")}
                  </button>
                  {nicheOpen && allNiches.length > 0 && (
                    <div className={styles.nicheMenu}>
                      {allNiches.map((n) => (
                        <button
                          key={n}
                          className={styles.nicheItem}
                          onClick={() => {
                            setNicheFilter(n);
                            setNicheOpen(false);
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className={styles.filterChip} onClick={toggleAll}>
                  {selectedIds.size === visibleAccounts.length && visibleAccounts.length > 0
                    ? t("gen_deselect_all")
                    : t("gen_select_all")}
                </button>
              </div>

              <div className={styles.accountList}>
                {visibleAccounts.length === 0 && !isLoading && (
                  <div className={styles.emptySmall}>{t("gen_no_accounts")}</div>
                )}
                {visibleAccounts.map((acc) => (
                  <label key={acc.account_id} className={styles.accRow}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(acc.account_id)}
                      onChange={() => toggleAccount(acc.account_id)}
                      disabled={!acc.heygen_avatar_id}
                      className={styles.checkbox}
                    />
                    <span
                      className={`${styles.accAvatarBadge} ${acc.heygen_avatar_id ? styles.accAvatarOk : styles.accAvatarNo}`}
                    >
                      {acc.heygen_avatar_id ? "A" : "-"}
                    </span>
                    <span className={styles.accName}>@{acc.username}</span>
                    <span className={styles.accNiche}>{acc.niche}</span>
                    <span
                      className={styles.accStatus}
                      style={{
                        color:
                          acc.status === "active"
                            ? "#22c55e"
                            : acc.status === "banned"
                              ? "#ef4444"
                              : "#fbbf24",
                      }}
                    >
                      {acc.status}
                    </span>
                  </label>
                ))}
              </div>

              {/* Launch from manual selection */}
              <div className={styles.cardFooter}>
                <button
                  className={styles.launchBtn}
                  disabled={selectedIds.size === 0 || launching}
                  onClick={() => {
                    if (selectedIds.size === 0) return;
                    setScopeLabel(`${t("gen_scope_manual")} (${selectedIds.size})`);
                    setShowConfirm(true);
                  }}
                >
                  {launching ? t("gen_launching") : `${t("gen_launch_btn")} (${selectedIds.size})`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ════════════ RIGHT COLUMN ════════════ */}
        <div className={styles.colSide}>
          {/* ── StreamCut Jobs ── */}
          {service === "streamcut" ? (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>{t("streamcut_jobs")}</div>
              </div>
              {scJobs.length === 0 && !scJobsLoading ? (
                <div className={styles.emptySmall}>{t("gen_sc_no_jobs")}</div>
              ) : (
                <div className={styles.jobList}>
                  {scJobs.map((job) => (
                    <StreamCutJobCard key={job.job_id} job={job} onDelete={scDeleteJob} t={t} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Generation Jobs ── */
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>{t("gen_jobs_title")}</div>
                {runningJobs.length > 1 && (
                  <button
                    className={styles.btnDangerSmall}
                    onClick={() => stopAllJobs().catch((e) => alert(e.message))}
                  >
                    {t("gen_stop_all")}
                  </button>
                )}
              </div>

              {activeJobs.length === 0 ? (
                <div className={styles.emptySmall}>{t("gen_no_jobs")}</div>
              ) : (
                <div className={styles.jobList}>
                  {visibleJobs.map((j) => {
                    const jColor = getJobStatusColor(j);
                    const jPct = getJobDisplayPercent(j, nowMs);
                    const latestEvent = (jobEventsById[j.job_id] ?? []).at(-1);
                    const indeterminate = j.status === "running" && j.total === 0;
                    return (
                      <div key={j.job_id} className={styles.jobItem}>
                        <div className={styles.jobItemHead}>
                          <div className={styles.jobItemRing}>
                            <ProgressRing
                              pct={jPct}
                              color={jColor}
                              indeterminate={indeterminate}
                              size={58}
                              strokeWidth={4}
                            />
                            <div className={styles.jobItemRingCenter}>
                              <span className={styles.jobItemPct} style={{ color: jColor }}>
                                {indeterminate ? "—" : `${jPct}%`}
                              </span>
                            </div>
                          </div>

                          <div className={styles.jobItemContent}>
                            <div className={styles.jobItemTop}>
                              <span className={styles.dot} style={{ background: jColor }} />
                              <span className={styles.jobItemId}>{j.job_id.slice(0, 8)}</span>
                              {j.is_auto && (
                                <span className={styles.tagAuto}>{t("gen_tag_auto")}</span>
                              )}
                              <span className={styles.jobItemStatus} style={{ color: jColor }}>
                                {getJobStatusText(j, t)}
                              </span>
                              {j.status === "running" && (
                                <button
                                  className={styles.btnDangerSmall}
                                  onClick={() => {
                                    stopJob(j.job_id).catch((e) => alert(e.message));
                                  }}
                                >
                                  {t("gen_stop_job")}
                                </button>
                              )}
                            </div>

                            <div className={styles.jobItemBottom}>
                              <span>
                                {j.progress}/{j.total}
                              </span>
                              {j.current_phase && <span>{j.current_phase}</span>}
                              {(j.status === "running" || j.status === "stopping") && (
                                <span>{formatElapsed(j.started_at ?? j.created_at, nowMs)}</span>
                              )}
                              <span>{j.service}</span>
                              {j.errors_count > 0 && (
                                <span style={{ color: "#ef4444" }}>
                                  {j.errors_count} {t("gen_errors_abbr")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {latestEvent && (
                          <div className={styles.jobTimelinePreview}>
                            <div className={styles.jobTimelineRow}>
                              <span className={styles.jobTimelineTime}>
                                {formatEventClock(latestEvent.created_at)}
                              </span>
                              <div className={styles.jobTimelineBody}>
                                <span className={styles.jobTimelinePhase}>
                                  {translatePhase(latestEvent.phase, t)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── StreamCut helpers ──────────────────────────────────────────────────────

/** Convert StreamCut relative URL (/storage/jobId/file.mp4) to API proxy URL */
function scProxyUrl(url: string | undefined): string | null {
  if (!url) return null;
  // Already a full URL (MinIO/R2) — use as-is
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Relative /storage/jobId/file.mp4 → /api/streamcut/storage/jobId/file.mp4
  const match = url.match(/^\/?storage\/(.+)$/);
  if (match) return `/api/streamcut/storage/${match[1]}`;
  return url;
}

// ─── StreamCut Job Card (for right column) ──────────────────────────────────

function scStatusClass(status: string) {
  if (status === "done") return styles.scJobStatusDone;
  if (status === "error") return styles.scJobStatusError;
  if (status === "pending") return styles.scJobStatusPending;
  return styles.scJobStatusRunning;
}

function scStepDotClass(status: string) {
  if (status === "done") return styles.scStepDotDone;
  if (status === "error") return styles.scStepDotError;
  if (status === "active") return styles.scStepDotActive;
  return "";
}

function StreamCutJobCard({
  job,
  onDelete,
  t,
}: {
  job: StreamCutJob;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className={styles.scJobItem}>
      <div className={styles.scJobHeader}>
        <span className={styles.scJobId}>{job.job_id.slice(0, 8)}</span>
        <span className={`${styles.scJobStatus} ${scStatusClass(job.status)}`}>{job.status}</span>
      </div>

      <div className={styles.scProgressBar}>
        <div className={styles.scProgressFill} style={{ width: `${job.progress}%` }} />
      </div>

      {job.steps && job.steps.length > 0 && (
        <div className={styles.scSteps}>
          {job.steps.map((step) => (
            <div key={step.id} className={styles.scStep}>
              <span className={`${styles.scStepDot} ${scStepDotClass(step.status)}`} />
              <span>
                {step.label}
                {step.detail && ` — ${step.detail}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {job.message && !job.error && <div className={styles.scJobMessage}>{job.message}</div>}
      {job.error && <div className={styles.scJobError}>{job.error}</div>}

      {job.shorts && job.shorts.length > 0 && (
        <div className={styles.scJobMessage} style={{ color: "#22c55e" }}>
          {job.shorts.length} {t("gen_sc_shorts_ready")}
        </div>
      )}

      {(job.status === "done" || job.status === "error") && (
        <div className={styles.scJobActions}>
          <button
            type="button"
            className={styles.btnDangerSmall}
            onClick={() => onDelete(job.job_id)}
          >
            {t("streamcut_delete")}
          </button>
        </div>
      )}
    </div>
  );
}
