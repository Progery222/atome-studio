import { useFarmHealth } from "../../hooks/useFarmHealth";
import styles from "./SystemBanner.module.css";

function fmtAgo(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} h`;
}

export function SystemBanner() {
  const { data } = useFarmHealth(15_000);
  if (!data) return null;
  if (data.state === "ok") return null;

  const bad = data.services.filter((s) => s.state === "down" || s.state === "degraded");
  if (bad.length === 0) return null;

  const cls = data.state === "down" ? styles.down : styles.degraded;
  const dotCls = data.state === "down" ? styles.down : styles.degraded;

  const summary = bad
    .slice(0, 3)
    .map((s) => `${s.name} (${s.state}${s.staleSeconds !== null ? `, ${fmtAgo(s.staleSeconds)}` : ""})`)
    .join(" · ");
  const more = bad.length > 3 ? `, +${bad.length - 3} more` : "";

  return (
    <div className={`${styles.banner} ${cls}`}>
      <span className={`${styles.dot} ${dotCls}`} />
      <span>
        <strong>System {data.state}.</strong>{" "}
        <span className={styles.detail}>
          {summary}
          {more}
        </span>
      </span>
    </div>
  );
}
