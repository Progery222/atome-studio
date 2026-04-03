import type { QueueTask } from "@atome/shared";
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

export function QueuePage() {
  const queue = useFarmStore((s) => s.queue);
  const queueLoading = useFarmStore((s) => s.queueLoading);
  const fetchQueue = useFarmStore((s) => s.fetchQueue);
  const t = useT();
  const lang = useLangStore((s) => s.lang);

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
    const id = setInterval(fetchQueue, 10_000);
    return () => clearInterval(id);
  }, [fetchQueue]);

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
                    task.status === "in_progress" ? `0 0 8px ${STATUS_COLOR[task.status]}` : "none",
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
                  <span className={styles.statusText} style={{ color: STATUS_COLOR[task.status] }}>
                    <Countdown task={task} />
                  </span>
                )}
              </div>

              {/* Scheduled time */}
              <span className={styles.time}>{formatTime(task.scheduled_at, LOCALE_MAP[lang])}</span>

              {/* Source badge */}
              <span
                className={styles.source}
                style={{
                  color:
                    task.source_service === "sportzavod"
                      ? "rgba(34,197,94,0.5)"
                      : "rgba(56,189,248,0.5)",
                  borderColor:
                    task.source_service === "sportzavod"
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(56,189,248,0.15)",
                }}
              >
                {task.source_service}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
