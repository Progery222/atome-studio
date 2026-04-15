import { useEffect, useState } from "react";
import { useFarmStore } from "../../stores/farm";
import { PhoneStream } from "../../components/PhoneStream/PhoneStream";
import styles from "./PhoneGridPage.module.css";

export function PhoneGridPage() {
  const phones = useFarmStore((s) => s.phones);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);
  const [focusedSerial, setFocusedSerial] = useState<string | null>(null);
  const [streamingCount, setStreamingCount] = useState(0);

  useEffect(() => {
    fetchPhones();
    const id = setInterval(fetchPhones, 15_000);
    return () => clearInterval(id);
  }, [fetchPhones]);

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
          return (
            <div
              key={serial}
              className={`${styles.phoneCard} ${focusedSerial === serial ? styles.focused : ""}`}
              onClick={() => setFocusedSerial(serial)}
            >
              <PhoneStream
                serial={serial}
                className={styles.screenImage}
                onStatus={(s) => {
                  if (s === "streaming") setStreamingCount((c) => c + 1);
                  else if (s === "closed" || s === "error")
                    setStreamingCount((c) => Math.max(0, c - 1));
                }}
              />
              <div className={styles.cardOverlay}>
                <span className={styles.cardSerial}>{serial.slice(-6)}</span>
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
            <PhoneStream serial={focusedSerial} className={styles.focusScreen} />
          </div>
        </div>
      )}
    </div>
  );
}
