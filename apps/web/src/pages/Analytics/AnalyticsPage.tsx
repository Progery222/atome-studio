import type { MetricsHistoryPoint, MetricsHistoryResponse } from "@atome/shared";
import { useEffect, useState } from "react";
import { type ChartSeries, MetricChart } from "../../components/MetricChart";
import { apiFetch } from "../../lib/api";
import { useMetricsStore } from "../../stores/metrics";
import styles from "./AnalyticsPage.module.css";

type Period = "7d" | "14d" | "30d";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 days",
  "14d": "14 days",
  "30d": "30 days",
};

async function fetchHistory(period: Period): Promise<MetricsHistoryResponse> {
  const res = await apiFetch(`/api/metrics/history?period=${period}&resolution=1h`);
  if (!res.ok) return { period, resolution: "1h", points: [] };
  return res.json();
}

export function AnalyticsPage() {
  const kpis = useMetricsStore((s) => s.kpis);
  const fetchKPIs = useMetricsStore((s) => s.fetchKPIs);

  const [period, setPeriod] = useState<Period>("30d");
  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  useEffect(() => {
    fetchHistory(period).then((r) => setHistory(r.points));
  }, [period]);

  const labels = history.map((p) =>
    new Date(p.ts).toLocaleDateString("en", { month: "short", day: "numeric" })
  );

  const videosSeries: ChartSeries[] = [
    { name: "Videos", data: history.map((p) => p.videos), color: "var(--accent-cyan)" },
  ];
  const revSeries: ChartSeries[] = [
    { name: "Revenue", data: history.map((p) => p.revenue), color: "var(--color-success)" },
    { name: "Cost", data: history.map((p) => p.cost), color: "var(--accent-red)" },
  ];
  const accountsSeries: ChartSeries[] = [
    {
      name: "Active accounts",
      data: history.map((p) => p.accounts_active),
      color: "var(--accent-amber)",
    },
  ];
  const jobsSeries: ChartSeries[] = [
    {
      name: "Jobs completed",
      data: history.map((p) => p.jobs_completed),
      color: "var(--accent-purple)",
    },
  ];

  const nicheSeries: ChartSeries[] = [
    { name: "Sport", data: [35], color: "var(--accent-cyan)" },
    { name: "Content", data: [28], color: "var(--accent-pink)" },
    { name: "News", data: [22], color: "var(--accent-amber)" },
    { name: "Other", data: [15], color: "var(--color-success)" },
  ];

  const kpiCards = [
    { label: "Videos Today", value: kpis.videos_today, fmt: (v: number) => String(v) },
    {
      label: "Cost / Video",
      value: kpis.cost_per_video,
      fmt: (v: number) => `$${v.toFixed(2)}`,
    },
    {
      label: "Publish Rate",
      value: Math.round(kpis.publish_rate * 100),
      fmt: (v: number) => `${v}%`,
    },
    { label: "Active Accounts", value: kpis.active_accounts, fmt: (v: number) => String(v) },
    {
      label: "Uptime",
      value: kpis.uptime_percent,
      fmt: (v: number) => `${v}%`,
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <div className={styles.periodToggle}>
          {(["7d", "14d", "30d"] as Period[]).map((p) => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ""}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.kpiRow}>
        {kpiCards.map(({ label, value, fmt }) => (
          <div key={label} className={styles.kpiCard}>
            <span className={styles.kpiValue}>{fmt(value)}</span>
            <span className={styles.kpiLabel}>{label}</span>
          </div>
        ))}
      </div>

      <div className={styles.chartFull}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Videos Published</div>
          <MetricChart option={{ type: "area", series: videosSeries, labels, height: 200 }} />
        </div>
      </div>

      <div className={styles.chartRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Revenue vs Cost</div>
          <MetricChart option={{ type: "line", series: revSeries, labels, height: 180 }} />
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Niche Distribution</div>
          <MetricChart option={{ type: "donut", series: nicheSeries, height: 180 }} />
        </div>
      </div>

      <div className={styles.chartRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Active Accounts</div>
          <MetricChart option={{ type: "bar", series: accountsSeries, labels, height: 180 }} />
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Jobs Completed</div>
          <MetricChart option={{ type: "line", series: jobsSeries, labels, height: 180 }} />
        </div>
      </div>
    </div>
  );
}
