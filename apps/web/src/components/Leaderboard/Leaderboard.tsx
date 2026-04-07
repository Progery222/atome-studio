import styles from "./Leaderboard.module.css";

export interface LeaderboardItem {
  label: string;
  sublabel?: string;
  value: number;
}

interface Props {
  items: LeaderboardItem[];
  formatValue?: (n: number) => string;
  color?: string;
  max?: number;
}

function defaultFormat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function Leaderboard({ items, formatValue = defaultFormat, color, max = 10 }: Props) {
  const shown = items.slice(0, max);
  const topValue = shown[0]?.value || 1;

  return (
    <div className={styles.root}>
      {shown.map((item, i) => (
        <div key={item.label} className={styles.row}>
          <span className={styles.rank}>{i + 1}</span>
          <div className={styles.label}>
            {item.label}
            {item.sublabel && <span className={styles.sublabel}> {item.sublabel}</span>}
          </div>
          <div className={styles.barWrap}>
            <div
              className={styles.bar}
              style={{
                width: `${(item.value / topValue) * 100}%`,
                background: color ?? "var(--accent-cyan)",
              }}
            />
          </div>
          <span className={styles.value}>{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}
