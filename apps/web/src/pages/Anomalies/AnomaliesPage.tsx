import type { AnomalySeverity } from "@atome/shared";
import { useEffect, useMemo, useState } from "react";
import { SeverityBadge } from "../../components/AutonomyBadge";
import { useT } from "../../i18n";
import { useAutonomyStore } from "../../stores/autonomy";
import styles from "./AnomaliesPage.module.css";

type TimeRange = "1h" | "24h" | "7d";

const TIME_RANGE_MS: Record<TimeRange, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const SEVERITY_LIST: AnomalySeverity[] = ["low", "medium", "high", "critical"];

export function AnomaliesPage() {
  const t = useT();
  const anomalies = useAutonomyStore((s) => s.anomalies);
  const recoveries = useAutonomyStore((s) => s.recoveries);
  const fetchAnomalies = useAutonomyStore((s) => s.fetchAnomalies);
  const fetchRecoveries = useAutonomyStore((s) => s.fetchRecoveries);

  const [severityFilter, setSeverityFilter] = useState<Set<AnomalySeverity>>(new Set());
  const [signatureFilter, setSignatureFilter] = useState<string>("");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  useEffect(() => {
    const doFetch = () => {
      const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]).toISOString();
      fetchAnomalies(undefined, undefined, since);
      fetchRecoveries();
    };
    doFetch();
    const id = setInterval(doFetch, 10_000);
    return () => clearInterval(id);
  }, [timeRange, fetchAnomalies, fetchRecoveries]);

  const filtered = useMemo(() => {
    let list = anomalies;
    if (severityFilter.size > 0) {
      list = list.filter((a) => severityFilter.has(a.severity));
    }
    if (signatureFilter.trim()) {
      const q = signatureFilter.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.signature_id.toLowerCase().includes(q) ||
          (a.message && a.message.toLowerCase().includes(q))
      );
    }
    return list;
  }, [anomalies, severityFilter, signatureFilter]);

  function toggleSeverity(sev: AnomalySeverity) {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("anomalies_title")}</h1>
      </header>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t("anomalies_filter_severity")}</span>
          <div className={styles.chipRow}>
            {SEVERITY_LIST.map((sev) => (
              <button
                key={sev}
                type="button"
                className={`${styles.chip} ${severityFilter.has(sev) ? styles.chipActive : ""}`}
                onClick={() => toggleSeverity(sev)}
              >
                <SeverityBadge severity={sev} />
              </button>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t("anomalies_filter_signature")}</span>
          <input
            type="text"
            className={styles.searchInput}
            value={signatureFilter}
            onChange={(e) => setSignatureFilter(e.target.value)}
            placeholder="captcha_detected, rate_limited..."
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t("anomalies_filter_time")}</span>
          <div className={styles.chipRow}>
            {(["1h", "24h", "7d"] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`${styles.chip} ${timeRange === r ? styles.chipActive : ""}`}
                onClick={() => setTimeRange(r)}
              >
                {t(`time_filter_${r}` as never)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className={styles.section}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>{t("anomaly_no_events")}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ts</th>
                <th>serial</th>
                <th>severity</th>
                <th>{t("anomaly_signature")}</th>
                <th>{t("anomaly_message")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className={styles.muted}>{new Date(a.ts).toLocaleString()}</td>
                  <td className={styles.mono}>{a.serial.slice(-10)}</td>
                  <td>
                    <SeverityBadge severity={a.severity} />
                  </td>
                  <td className={styles.mono}>{a.signature_id}</td>
                  <td>{a.message}</td>
                  <td>
                    {a.resolved ? (
                      <span style={{ color: "#22c55e", fontSize: 11 }}>
                        ✓ {t("anomaly_resolved")}
                      </span>
                    ) : (
                      <span style={{ color: "#fbbf24", fontSize: 11 }}>
                        {t("anomaly_unresolved")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t("recovery_title")}</h3>
        {recoveries.length === 0 ? (
          <div className={styles.empty}>{t("recovery_no_attempts")}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ts</th>
                <th>serial</th>
                <th>{t("recovery_strategy")}</th>
                <th>result</th>
                <th>details</th>
              </tr>
            </thead>
            <tbody>
              {recoveries.map((r) => (
                <tr key={r.id}>
                  <td className={styles.muted}>{new Date(r.ts).toLocaleString()}</td>
                  <td className={styles.mono}>{r.serial.slice(-10)}</td>
                  <td>{r.strategy}</td>
                  <td>
                    <span
                      style={{
                        color: r.success ? "#22c55e" : "#ef4444",
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    >
                      {r.success ? `✓ ${t("recovery_success")}` : `✗ ${t("recovery_failed")}`}
                    </span>
                  </td>
                  <td className={styles.muted}>{r.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
