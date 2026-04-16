import type { AnomalySeverity, AutonomyState, GoalKind } from "@atome/shared";
import { useT } from "../../i18n";
import styles from "./AutonomyBadge.module.css";

const STATE_COLOR: Record<AutonomyState, string> = {
  idle: "#6b7280",
  observing: "#60a5fa",
  planning: "#a78bfa",
  acting: "#22c55e",
  validating: "#00d2ff",
  recovering: "#fbbf24",
  paused: "#fbbf24",
  terminated: "#6b7280",
};

const SEVERITY_COLOR: Record<AnomalySeverity, string> = {
  low: "#6b7280",
  medium: "#fbbf24",
  high: "#ff6b6b",
  critical: "#ef4444",
};

type Size = "sm" | "md";

export function StateBadge({ state, size = "sm" }: { state: AutonomyState; size?: Size }) {
  const t = useT();
  const color = STATE_COLOR[state];
  return (
    <span
      className={`${styles.badge} ${size === "md" ? styles.md : styles.sm}`}
      style={{ color, borderColor: color, backgroundColor: `${color}1a` }}
    >
      {t(`autonomy_state_${state}` as never)}
    </span>
  );
}

export function SeverityBadge({
  severity,
  size = "sm",
}: {
  severity: AnomalySeverity;
  size?: Size;
}) {
  const t = useT();
  const color = SEVERITY_COLOR[severity];
  return (
    <span
      className={`${styles.badge} ${size === "md" ? styles.md : styles.sm}`}
      style={{ color, borderColor: color, backgroundColor: `${color}1a` }}
    >
      {t(`anomaly_severity_${severity}` as never)}
    </span>
  );
}

export function GoalKindBadge({ kind, size = "sm" }: { kind: GoalKind; size?: Size }) {
  const t = useT();
  return (
    <span className={`${styles.badge} ${styles.neutral} ${size === "md" ? styles.md : styles.sm}`}>
      {t(`goal_kind_${kind}` as never)}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: AnomalySeverity }) {
  const color = SEVERITY_COLOR[severity];
  return (
    <span
      className={styles.dot}
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}
