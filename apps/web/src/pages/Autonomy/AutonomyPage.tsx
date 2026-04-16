import type { PhoneActionExecution, PhoneObservation } from "@atome/shared";
import { useEffect, useState } from "react";
import { SeverityBadge, StateBadge } from "../../components/AutonomyBadge";
import { useAutonomyPolling } from "../../hooks/useAutonomyPolling";
import { useT } from "../../i18n";
import { useAutonomyStore } from "../../stores/autonomy";
import styles from "./AutonomyPage.module.css";

function fmtTime(ts?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.toLocaleTimeString()}`;
}

function fmtDuration(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AutonomyPage() {
  const t = useT();
  const sessionsList = useAutonomyStore((s) => s.sessionsList);
  const sessionsBySerial = useAutonomyStore((s) => s.sessionsBySerial);
  const fetchSession = useAutonomyStore((s) => s.fetchSession);
  const pauseSession = useAutonomyStore((s) => s.pauseSession);
  const resumeSession = useAutonomyStore((s) => s.resumeSession);
  const terminateSession = useAutonomyStore((s) => s.terminateSession);
  const fetchActions = useAutonomyStore((s) => s.fetchActions);
  const fetchObservations = useAutonomyStore((s) => s.fetchObservations);

  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [actions, setActions] = useState<PhoneActionExecution[]>([]);
  const [observations, setObservations] = useState<PhoneObservation[]>([]);

  useAutonomyPolling(3000);

  // Auto-select first session
  useEffect(() => {
    if (!selectedSerial && sessionsList.length > 0) {
      setSelectedSerial(sessionsList[0].serial);
    }
  }, [selectedSerial, sessionsList]);

  // Refresh detail of selected serial
  useEffect(() => {
    if (!selectedSerial) return;
    const doFetch = async () => {
      await fetchSession(selectedSerial);
      const [a, o] = await Promise.all([
        fetchActions(selectedSerial, 50),
        fetchObservations(selectedSerial, 20),
      ]);
      setActions(a);
      setObservations(o);
    };
    doFetch();
    const id = setInterval(doFetch, 3000);
    return () => clearInterval(id);
  }, [selectedSerial, fetchSession, fetchActions, fetchObservations]);

  const selectedDetail = selectedSerial ? sessionsBySerial[selectedSerial] : undefined;
  const selectedSession = selectedDetail?.session;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("autonomy_title")}</h1>
        <div className={styles.subtitle}>{t("autonomy_subtitle")}</div>
      </header>

      <div className={styles.layout}>
        {/* Sessions list */}
        <div className={styles.listPane}>
          {sessionsList.length === 0 ? (
            <div className={styles.empty}>{t("autonomy_no_sessions")}</div>
          ) : (
            <table className={styles.table}>
              <tbody>
                {sessionsList.map((session) => {
                  const detail = sessionsBySerial[session.serial];
                  const isSelected = selectedSerial === session.serial;
                  const anomaly = detail?.last_anomaly;
                  return (
                    <tr
                      key={session.serial}
                      className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                      onClick={() => setSelectedSerial(session.serial)}
                    >
                      <td>
                        <div className={styles.serial}>{session.serial.slice(-8)}</div>
                      </td>
                      <td>
                        <StateBadge state={session.state} />
                      </td>
                      <td>
                        {detail?.last_action ? (
                          <span
                            className={
                              detail.last_action.ok ? styles.actionOk : styles.actionFail
                            }
                          >
                            {detail.last_action.ok ? "✓" : "✗"}{" "}
                            {detail.last_action.action_type}
                          </span>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                      <td>{anomaly && <SeverityBadge severity={anomaly.severity} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail pane */}
        <div className={styles.detailPane}>
          {!selectedSession ? (
            <div className={styles.empty}>{t("autonomy_select_session")}</div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailSerial}>{selectedSession.serial}</div>
                  <div className={styles.detailRow}>
                    <StateBadge state={selectedSession.state} size="md" />
                    {selectedSession.pause_reason && (
                      <span className={styles.pauseReason}>
                        {t("autonomy_pause_reason")}:{" "}
                        {t(
                          `autonomy_pause_reason_${selectedSession.pause_reason}` as never
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={selectedSession.state === "paused"}
                    onClick={() => pauseSession(selectedSession.serial)}
                  >
                    {t("autonomy_btn_pause")}
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={selectedSession.state !== "paused"}
                    onClick={() => resumeSession(selectedSession.serial)}
                  >
                    {t("autonomy_btn_resume")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    disabled={selectedSession.state === "terminated"}
                    onClick={() => terminateSession(selectedSession.serial)}
                  >
                    {t("autonomy_btn_terminate")}
                  </button>
                </div>
              </div>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{t("autonomy_recent_actions")}</h3>
                {actions.length === 0 ? (
                  <div className={styles.muted}>{t("autonomy_no_actions")}</div>
                ) : (
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>ts</th>
                        <th>{t("autonomy_action_type")}</th>
                        <th>{t("autonomy_action_status")}</th>
                        <th>{t("autonomy_action_duration")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map((a) => (
                        <tr key={a.id}>
                          <td className={styles.muted}>{fmtTime(a.ts)}</td>
                          <td>{a.action_type}</td>
                          <td className={a.ok ? styles.actionOk : styles.actionFail}>
                            {a.ok ? t("autonomy_action_ok") : t("autonomy_action_fail")}
                            {a.error && ` — ${a.error}`}
                          </td>
                          <td className={styles.muted}>{fmtDuration(a.duration_ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  {t("autonomy_recent_observations")}
                </h3>
                {observations.length === 0 ? (
                  <div className={styles.muted}>{t("autonomy_no_observations")}</div>
                ) : (
                  <ul className={styles.obsList}>
                    {observations.map((o) => (
                      <li key={o.id} className={styles.obsItem}>
                        <span className={styles.muted}>{fmtTime(o.ts)}</span>
                        <span>{o.screen_summary ?? ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
