import { useEffect, useRef } from "react";
import { useMetricsStore } from "../../stores/metrics";
import { MetricChart } from "../MetricChart";
import styles from "./HeroKPIs.module.css";

interface KPICard {
  key: keyof Omit<ReturnType<typeof useMetricsStore.getState>["kpis"], "trends">;
  label: string;
  format: (v: number) => string;
  color: string;
  sparkData?: number[];
}

const CARDS: KPICard[] = [
  {
    key: "videos_today",
    label: "Videos Today",
    format: (v) => String(Math.round(v)),
    color: "#00D2FF",
  },
  {
    key: "cost_per_video",
    label: "Cost / Video",
    format: (v) => `$${v.toFixed(2)}`,
    color: "#FF0080",
  },
  {
    key: "publish_rate",
    label: "Publish Rate",
    format: (v) => `${Math.round(v)}%`,
    color: "#00d4aa",
  },
  {
    key: "active_accounts",
    label: "Active Accounts",
    format: (v) => String(Math.round(v)),
    color: "#FBBF24",
  },
  { key: "uptime_percent", label: "Uptime", format: (v) => `${v.toFixed(1)}%`, color: "#a78bfa" },
];

function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    const diff = end - start;
    if (diff === 0) return;
    const duration = 600;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const cur = start + diff * ease;
      if (ref.current) ref.current.textContent = format(cur);
      if (t < 1) requestAnimationFrame(tick);
      else prev.current = end;
    };
    requestAnimationFrame(tick);
  }, [value, format]);

  return <span ref={ref}>{format(value)}</span>;
}

export function HeroKPIs() {
  const kpis = useMetricsStore((s) => s.kpis);

  return (
    <div className={styles.root}>
      {CARDS.map(({ key, label, format, color }) => {
        const value = kpis[key] as number;
        const trend = kpis.trends[key] as number;
        const trendUp = trend >= 0;
        return (
          <div
            key={key}
            className={styles.card}
            style={{ "--accent": color } as React.CSSProperties}
          >
            <div className={styles.label}>{label}</div>
            <div className={styles.value}>
              <CountUp value={value} format={format} />
            </div>
            <div className={`${styles.trend} ${trendUp ? styles.trendUp : styles.trendDown}`}>
              {trendUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
            </div>
            <MetricChart
              option={{
                type: "sparkline",
                series: [
                  { data: [value * 0.7, value * 0.8, value * 0.75, value * 0.9, value], color },
                ],
                height: 32,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
