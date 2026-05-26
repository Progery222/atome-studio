import { useCallback, useEffect, useRef, useState } from "react";
import { GoalKindBadge, SeverityDot, StateBadge } from "../../components/AutonomyBadge";
import { PhoneStream } from "../../components/PhoneStream/PhoneStream";
import { useAutonomyPolling } from "../../hooks/useAutonomyPolling";
import { useAutonomyStore } from "../../stores/autonomy";
import { useFarmStore } from "../../stores/farm";
import styles from "./PhoneGridPage.module.css";

const ANOMALY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function phoneDisplayName(phone: {
  display_name?: string | null;
  display_id?: string | null;
  serial?: string | null;
  phone_id: string;
}) {
  return phone.display_name || phone.display_id || phone.serial || phone.phone_id;
}

function isRecentAnomaly(ts?: string): boolean {
  if (!ts) return false;
  const age = Date.now() - new Date(ts).getTime();
  return age >= 0 && age < ANOMALY_WINDOW_MS;
}

export function PhoneGridPage() {
  const phones = useFarmStore((s) => s.phones);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);
  const sessionsBySerial = useAutonomyStore((s) => s.sessionsBySerial);
  const [focusedSerial, setFocusedSerial] = useState<string | null>(null);
  const streamingSetRef = useRef(new Set<string>());
  const [streamingCount, setStreamingCount] = useState(0);

  useAutonomyPolling(3000);

  useEffect(() => {
    fetchPhones();
    const id = setInterval(fetchPhones, 15_000);
    return () => clearInterval(id);
  }, [fetchPhones]);

  const handleStatus = useCallback(
    (serial: string, s: "connecting" | "connected" | "streaming" | "error" | "closed") => {
      const set = streamingSetRef.current;
      if (s === "streaming") {
        if (!set.has(serial)) {
          set.add(serial);
          setStreamingCount(set.size);
        }
      } else if (s === "closed" || s === "error") {
        if (set.has(serial)) {
          set.delete(serial);
          setStreamingCount(set.size);
        }
      }
    },
    [],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Phone Grid</h1>
          <div className={styles.subtitle}>
            {phones.length} devices • {streamingCount} streaming
          </div>
        </div>
        <span
          className={`${styles.statusDot} ${streamingCount > 0 ? styles.online : styles.offline}`}
        />
      </header>

      <div className={styles.grid}>
        {phones.map((phone: any) => {
          const serial = phone.serial || phone.phone_id;
          const displayName = phoneDisplayName(phone);
          const detail = sessionsBySerial[serial];
          const session = detail?.session;
          const lastAnomaly = detail?.last_anomaly;
          const showAnomaly = lastAnomaly && isRecentAnomaly(lastAnomaly.ts);

          return (
            <div
              key={serial}
              className={`${styles.phoneCard} ${focusedSerial === serial ? styles.focused : ""}`}
              onClick={() => setFocusedSerial(serial)}
            >
              <PhoneStream
                serial={serial}
                className={styles.screenImage}
                onStatus={(s) => handleStatus(serial, s)}
              />

              {session && (
                <div className={styles.cardAutonomy}>
                  <StateBadge state={session.state} />
                  {showAnomaly && (
                    <span className={styles.cardAnomalyDot}>
                      <SeverityDot severity={lastAnomaly.severity} />
                    </span>
                  )}
                </div>
              )}

              <div className={styles.cardOverlay}>
                <span className={styles.cardSerial}>{displayName}</span>
                <span
                  className={`${styles.cardStatus} ${
                    phone.status === "paused"
                      ? styles.paused
                      : phone.status === "offline"
                        ? styles.offline
                        : ""
                  }`}
                >
                  {phone.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {focusedSerial && (
        <div
          className={styles.focusOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFocusedSerial(null);
          }}
        >
          <div className={styles.focusContainer}>
            <span className={styles.focusSerial}>{focusedSerial}</span>
            <button className={styles.focusClose} onClick={() => setFocusedSerial(null)}>
              ✕ Close
            </button>
            {(() => {
              const detail = sessionsBySerial[focusedSerial];
              const goal = detail?.session?.active_goal_id;
              const state = detail?.session?.state;
              if (!state) return null;
              return (
                <div
                  style={{
                    position: "absolute",
                    top: -40,
                    left: 180,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <StateBadge state={state} size="md" />
                  {goal && (
                    <GoalKindBadge
                      kind={(detail?.last_action?.action_type as never) ?? "browse_fyp"}
                      size="md"
                    />
                  )}
                </div>
              );
            })()}
            <PhoneStream serial={focusedSerial} className={styles.focusScreen} />
          </div>
        </div>
      )}
    </div>
  );
}
