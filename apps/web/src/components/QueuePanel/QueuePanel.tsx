import type { QueueTask } from "@atome/shared";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useFarmStore } from "../../stores/farm";
import styles from "./QueuePanel.module.css";

type Filter = "all" | "scheduled" | "in_progress" | "published" | "failed";

const STATUS_COLOR: Record<QueueTask["status"], string> = {
  scheduled: "#60a5fa",
  in_progress: "#22c55e",
  published: "rgba(34,197,94,0.5)",
  failed: "#ef4444",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function QueuePanel() {
  const queue = useFarmStore((s) => s.queue);
  const fetchQueue = useFarmStore((s) => s.fetchQueue);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 5_000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const filtered = filter === "all" ? queue : queue.filter((t) => t.status === filter);

  async function act(id: string, path: "retry" | "cancel") {
    setBusy(id);
    try {
      await apiFetch(`/api/farm/jobs/${id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: path === "cancel" ? JSON.stringify({ reason: "operator_cancel" }) : undefined,
      });
      fetchQueue();
    } catch {
      // ignore
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.filters}>
        {(["all", "scheduled", "in_progress", "published", "failed"] as Filter[]).map(
          (f) => (
            <button
              key={f}
              type="button"
              className={`${styles.chip} ${filter === f ? styles.chipActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          )
        )}
      </div>

      <div className={styles.list}>
        {filtered.length === 0 && (
          <div className={styles.empty}>Очередь пуста</div>
        )}
        {filtered.map((task) => (
          <div key={task.task_id} className={styles.row}>
            <span
              className={styles.dot}
              style={{ background: STATUS_COLOR[task.status] }}
            />
            {task.thumbnail_url ? (
              <img src={task.thumbnail_url} alt="" className={styles.thumb} />
            ) : (
              <div className={styles.thumb} />
            )}
            <div className={styles.info}>
              <div className={styles.caption}>
                {task.caption
                  ? task.caption.length > 40
                    ? `${task.caption.slice(0, 40)}…`
                    : task.caption
                  : task.account_id || task.task_id.slice(0, 8)}
              </div>
              <div className={styles.sub}>
                {formatTime(task.scheduled_at)} · {task.status}
              </div>
            </div>
            <div className={styles.actions}>
              {task.status === "failed" && (
                <button
                  type="button"
                  disabled={busy === task.task_id}
                  onClick={() => act(task.task_id, "retry")}
                  className={styles.actionBtn}
                >
                  ↻
                </button>
              )}
              {(task.status === "scheduled" || task.status === "in_progress") && (
                <button
                  type="button"
                  disabled={busy === task.task_id}
                  onClick={() => act(task.task_id, "cancel")}
                  className={styles.actionBtn}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
