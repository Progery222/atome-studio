import { useActivityStore } from "../../stores/activity";
import styles from "./ActivityFeed.module.css";

const ICONS: Record<string, string> = {
  published: "✓",
  banned: "✗",
  error: "!",
  job_complete: "●",
  heartbeat: "♥",
  info: "·",
};

const SEVERITY_CLASS: Record<string, string> = {
  info: "",
  warning: "warn",
  error: "err",
};

export function ActivityFeed() {
  const events = useActivityStore((s) => s.events);

  if (events.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>Activity</div>
        <div className={styles.empty}>No events yet</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>Activity</div>
      <div className={styles.list}>
        {events.map((ev) => (
          <div
            key={ev.id}
            className={`${styles.item} ${styles[SEVERITY_CLASS[ev.severity] ?? ""]}`}
          >
            <span className={styles.icon}>{ICONS[ev.type] ?? "·"}</span>
            <div className={styles.body}>
              <span className={styles.service}>{ev.service}</span>
              <span className={styles.msg}>{ev.message}</span>
            </div>
            <span className={styles.time}>
              {new Date(ev.timestamp).toLocaleTimeString("en", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
