import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useT } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import { useFarmStore } from "../../stores/farm";
import styles from "./PhoneDetailPage.module.css";

const STATUS_COLOR: Record<string, string> = {
  active: "#22c55e",
  warmup: "#fbbf24",
  paused: "#60a5fa",
  offline: "#6b7280",
  banned: "#ef4444",
  error: "#ef4444",
};

function healthColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#fbbf24";
  return "#ef4444";
}

export function PhoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const phones = useFarmStore((s) => s.phones);
  const queue = useFarmStore((s) => s.queue);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);
  const fetchQueue = useFarmStore((s) => s.fetchQueue);
  const pausePhone = useFarmStore((s) => s.pausePhone);
  const resumePhone = useFarmStore((s) => s.resumePhone);
  const phonesLoading = useFarmStore((s) => s.phonesLoading);
  const canControl = useAuthStore((s) => s.role) !== "viewer";
  const navigate = useNavigate();

  useEffect(() => {
    if (phones.length === 0) fetchPhones();
    fetchQueue();
  }, [phones.length, fetchPhones, fetchQueue]);

  const t = useT();

  const phone = phones.find((p) => p.phone_id === id);

  // Queue filtered for this phone (FR-5.4)
  const phoneQueue = queue.filter((task) => task.phone_id === id);

  if (phonesLoading)
    return (
      <div className={styles.page}>
        <div className={styles.empty}>{t("phone_loading")}</div>
      </div>
    );
  if (!phone)
    return (
      <div className={styles.page}>
        <Link to="/phones" className={styles.back}>
          {t("phone_back")}
        </Link>
        <div className={styles.empty}>
          — {t("phone_not_found")}: {id}
        </div>
      </div>
    );

  const col = STATUS_COLOR[phone.status] ?? "#6b7280";
  const hc = healthColor(phone.health_score);

  return (
    <div className={styles.page}>
      <Link to="/phones" className={styles.back}>
        {t("phone_back")}
      </Link>

      {/* Title row */}
      <div className={styles.titleRow}>
        <div>
          <div className={styles.title}>{phone.display_name || phone.display_id || phone.serial || phone.phone_id}</div>
          <div className={styles.sub}>{phone.model}</div>
        </div>
        <span className={styles.statusBadge} style={{ color: col, borderColor: col }}>
          {phone.status}
        </span>
      </div>

      {/* ADB warning */}
      {!phone.adb_connected && <div className={styles.adbWarn}>{t("phone_adb_warn")}</div>}

      {/* Action buttons (FR-5.6) — hidden for viewer */}
      {canControl && (
        <div className={styles.actions}>
          {phone.status === "paused" ? (
            <button
              className={styles.btnGreen}
              onClick={() => resumePhone(phone.phone_id).catch((e) => alert(e.message))}
            >
              {t("phones_resume")}
            </button>
          ) : (
            <button
              className={styles.btnAmber}
              onClick={() => pausePhone(phone.phone_id).catch((e) => alert(e.message))}
            >
              {t("phones_pause")}
            </button>
          )}
          <button className={styles.btnDanger}>{t("phone_stop")}</button>
        </div>
      )}

      {/* Info cards grid */}
      <div className={styles.grid}>
        {/* Health */}
        <div className={styles.card}>
          <div className={styles.cardLabel}>Health Score</div>
          <div className={styles.healthBig} style={{ color: hc }}>
            {phone.health_score}%
          </div>
          <div className={styles.healthBar}>
            <div
              className={styles.healthFill}
              style={{ width: `${phone.health_score}%`, background: hc }}
            />
          </div>
        </div>

        {/* Posts today */}
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("phone_posts_today")}</div>
          <div className={styles.cardBig}>{phone.posts_today}</div>
        </div>

        {/* Actions today */}
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("phone_actions_today")}</div>
          <div className={styles.cardBig}>{phone.actions_today}</div>
        </div>

        {/* Warmup day */}
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("phone_warmup_day")}</div>
          <div className={styles.cardBig}>{phone.warmup_day}</div>
        </div>
      </div>

      {/* Detail rows */}
      <div className={styles.detailCard}>
        <div className={styles.cardTitle}>{t("phone_info_title")}</div>
        {(
          [
            ["ADB Serial", phone.serial || "—"],
            [t("phone_group"), phone.group || "—"],
            ["ADB", phone.adb_connected ? t("phone_adb_connected") : t("phone_adb_disconnected")],
            [t("phone_last_active"), phone.last_active || "—"],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className={styles.row}>
            <span className={styles.rowLabel}>{label}</span>
            <span className={styles.rowValue}>{value}</span>
          </div>
        ))}
      </div>

      {/* Accounts on phone */}
      {phone.accounts && phone.accounts.length > 0 && (
        <div className={styles.detailCard}>
          <div className={styles.cardTitle}>
            {t("phone_accounts_title")} ({phone.accounts.length})
          </div>
          {phone.accounts.map((acc) => (
            <div
              key={acc.account_id}
              className={styles.accRow}
              onClick={() => navigate(`/accounts/${acc.account_id}`)}
            >
              <span className={styles.accName}>{acc.username}</span>
              <span className={styles.accNiche}>{acc.niche}</span>
              <span
                style={{
                  color: STATUS_COLOR[acc.status] ?? "#6b7280",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {acc.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Queue for this phone (FR-5.4) */}
      <div className={styles.detailCard}>
        <div className={styles.cardTitle}>
          {t("phone_queue_title")} ({phoneQueue.length})
        </div>
        {phoneQueue.length === 0 ? (
          <div className={styles.emptySmall}>{t("phone_no_tasks")}</div>
        ) : (
          phoneQueue.slice(0, 10).map((task) => (
            <div key={task.task_id} className={styles.row}>
              <span className={styles.rowLabel}>{task.account_id}</span>
              <span
                className={styles.rowValue}
                style={{
                  color:
                    STATUS_COLOR[
                      task.status === "in_progress"
                        ? "active"
                        : task.status === "failed"
                          ? "error"
                          : "paused"
                    ],
                }}
              >
                {task.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
