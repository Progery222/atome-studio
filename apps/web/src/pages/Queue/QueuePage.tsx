import type { GenerationJob, QueueTask } from "@atome/shared";
import { useEffect, useState } from "react";
import { LOCALE_MAP, useT } from "../../i18n";
import { useFarmStore } from "../../stores/farm";
import { useLangStore } from "../../stores/lang";
import styles from "./QueuePage.module.css";

type Filter = "all" | "in_progress" | "scheduled" | "published" | "failed";

const STATUS_COLOR: Record<QueueTask["status"], string> = {
  scheduled: "#60a5fa",
  in_progress: "#22c55e",
  published: "rgba(34,197,94,0.45)",
  failed: "#ef4444",
};

type TFunc = ReturnType<typeof useT>;

function formatCountdown(scheduledAt: string, t: TFunc): string {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return t("queue_countdown_now");
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0)
    return `${t("queue_in_prefix")} ${h}${t("queue_hours_suffix")} ${m}${t("queue_minutes_suffix")}`;
  return `${t("queue_in_prefix")} ${m}${t("queue_minutes_suffix")}`;
}

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ─── Countdown cell ──────────────────────────────────────────────────────────

function Countdown({ task }: { task: QueueTask }) {
  const t = useT();
  const [countdown, setCountdown] = useState(() => formatCountdown(task.scheduled_at, t));

  useEffect(() => {
    if (task.status !== "scheduled") return;
    const id = setInterval(() => {
      setCountdown(formatCountdown(task.scheduled_at, t));
    }, 30_000);
    return () => clearInterval(id);
  }, [task.status, task.scheduled_at, t]);

  if (task.status === "in_progress") return <span>{t("queue_status_in_progress")}</span>;
  if (task.status === "published") return <span>{t("queue_status_published")}</span>;
  if (task.status === "failed") return <span>{t("queue_status_failed")}</span>;
  return <span>{countdown}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function formatJobElapsed(job: GenerationJob): string {
  const started = job.started_at ?? job.created_at;
  if (!started) return "";
  const ms = Date.now() - new Date(started).getTime();
  if (ms < 0 || Number.isNaN(ms)) return "";
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const JOB_STATUS_COLOR: Record<string, string> = {
  running: "#00c8dc",
  done: "#22c55e",
  error: "#ef4444",
  stopped: "#888",
};

export function QueuePage() {
  const queue = useFarmStore((s) => s.queue);
  const queueLoading = useFarmStore((s) => s.queueLoading);
  const fetchQueue = useFarmStore((s) => s.fetchQueue);
  const activeJobs = useFarmStore((s) => s.activeJobs);
  const fetchJobs = useFarmStore((s) => s.fetchJobs);
  const stopJob = useFarmStore((s) => s.stopJob);
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const agentmusicJobs = activeJobs.filter((j) => j.service === "agentmusic");

  const FILTER_LABELS: Record<Filter, string> = {
    all: t("queue_all"),
    in_progress: t("queue_active"),
    scheduled: t("queue_scheduled"),
    published: t("queue_published"),
    failed: t("queue_failed"),
  };

  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetchQueue();
    fetchJobs();
    const id = setInterval(() => { fetchQueue(); fetchJobs(); }, 5_000);
    return () => clearInterval(id);
  }, [fetchQueue, fetchJobs]);

  const filtered = filter === "all" ? queue : queue.filter((item) => item.status === filter);

  const counts = {
    scheduled: queue.filter((item) => item.status === "scheduled").length,
    in_progress: queue.filter((item) => item.status === "in_progress").length,
    published: queue.filter((item) => item.status === "published").length,
    failed: queue.filter((item) => item.status === "failed").length,
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>{t("queue_title")}</div>
          <div className={styles.subtitle}>
            {queueLoading ? (
              t("queue_loading")
            ) : (
              <>
                <span className={styles.cnt}>
                  {counts.scheduled} {t("queue_sub_scheduled")}
                </span>
                {" · "}
                <span className={styles.cntGreen}>
                  {counts.published} {t("queue_sub_published")}
                </span>
                {counts.failed > 0 && (
                  <>
                    {" · "}
                    <span className={styles.cntRed}>
                      {counts.failed} {t("queue_sub_errors")}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <button className={styles.syncBtn} onClick={fetchQueue}>
          {t("queue_refresh")}
        </button>
      </header>

      {/* agentMUSIC Generation Jobs */}
      {agentmusicJobs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#00c8dc", fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            agentMUSIC
          </div>
          {agentmusicJobs.map((job) => (
            <div
              key={job.job_id}
              style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: JOB_STATUS_COLOR[job.status] ?? "#888",
                  boxShadow: job.status === "running" ? `0 0 8px ${JOB_STATUS_COLOR.running}` : "none",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#ccc", fontSize: 13 }}>
                  {job.job_id.slice(0, 8)} — {job.current_message || job.current_phase || job.status}
                </div>
                <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
                  {job.progress}/{job.total} videos — {formatJobElapsed(job)}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: JOB_STATUS_COLOR[job.status] ?? "#888", minWidth: 40, textAlign: "right" }}>
                {job.percent ?? 0}%
              </div>
              {job.status === "running" && (
                <button
                  onClick={() => stopJob(job.job_id)}
                  style={{
                    background: "transparent", border: "1px solid #444",
                    color: "#ef4444", borderRadius: 4, padding: "4px 10px",
                    fontSize: 11, cursor: "pointer",
                  }}
                >
                  STOP
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
            {f !== "all" && (
              <span className={styles.filterCount}>
                {queue.filter((item) => item.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 && !queueLoading ? (
        <div className={styles.empty}>{t("queue_empty")}</div>
      ) : (
        <div className={styles.listWrapper}>
          <div className={styles.list}>
            {filtered.map((task) => (
              <div
                key={task.task_id}
                className={`${styles.row} ${task.status === "in_progress" ? styles.rowActive : ""}`}
              >
                {/* Status dot */}
                <span
                  className={styles.dot}
                  style={{
                    background: STATUS_COLOR[task.status],
                    boxShadow:
                      task.status === "in_progress"
                        ? `0 0 8px ${STATUS_COLOR[task.status]}`
                        : "none",
                  }}
                />

                {/* Thumbnail (FR-12.1) */}
                <div className={styles.thumb}>
                  {task.thumbnail_url ? (
                    <img src={task.thumbnail_url} alt="" />
                  ) : (
                    <span className={styles.thumbPlaceholder}>[vid]</span>
                  )}
                </div>

                {/* Account */}
                <span className={styles.accountId}>{task.account_id}</span>

                {/* Caption + hashtags (FR-12.2) */}
                <div className={styles.captionBlock}>
                  {task.caption && (
                    <div className={styles.captionText}>
                      {task.caption.length > 80 ? `${task.caption.slice(0, 80)}…` : task.caption}
                    </div>
                  )}
                  {task.hashtags && task.hashtags.length > 0 && (
                    <div className={styles.hashtags}>
                      {task.hashtags.map((h) => `#${h}`).join(" ")}
                    </div>
                  )}
                  {!task.caption && (
                    <span
                      className={styles.statusText}
                      style={{ color: STATUS_COLOR[task.status] }}
                    >
                      <Countdown task={task} />
                    </span>
                  )}
                </div>

                {/* Scheduled time */}
                <span className={styles.time}>
                  {formatTime(task.scheduled_at, LOCALE_MAP[lang])}
                </span>

                {/* Source badge */}
                <span
                  className={styles.source}
                  style={{
                    color:
                      task.source_service === "sportzavod"
                        ? "rgba(34,197,94,0.5)"
                        : task.source_service === "agentmusic"
                          ? "rgba(0,200,220,0.5)"
                          : "rgba(56,189,248,0.5)",
                    borderColor:
                      task.source_service === "sportzavod"
                        ? "rgba(34,197,94,0.15)"
                        : task.source_service === "agentmusic"
                          ? "rgba(0,200,220,0.15)"
                          : "rgba(56,189,248,0.15)",
                  }}
                >
                  {task.source_service}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
