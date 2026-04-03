import type { Phone } from "@atome/shared";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import { useFarmStore } from "../../stores/farm";
import styles from "./PhonesPage.module.css";

const STATUS_COLOR: Record<Phone["status"], string> = {
  active: "#22c55e",
  warmup: "#fbbf24",
  paused: "#60a5fa",
  offline: "#6b7280",
  banned: "#ef4444",
  error: "#ef4444",
};

const STATUS_LABEL: Record<Phone["status"], string> = {
  active: "online",
  warmup: "warmup",
  paused: "paused",
  offline: "offline",
  banned: "banned",
  error: "error",
};

const ALL_STATUSES: Phone["status"][] = [
  "active",
  "warmup",
  "paused",
  "offline",
  "banned",
  "error",
];

function healthColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#fbbf24";
  return "#ef4444";
}

// ─── Phone Card ───────────────────────────────────────────────────────────────

function PhoneCard({ phone }: { phone: Phone }) {
  const pausePhone = useFarmStore((s) => s.pausePhone);
  const resumePhone = useFarmStore((s) => s.resumePhone);
  const role = useAuthStore((s) => s.role);
  const t = useT();
  const col = STATUS_COLOR[phone.status];
  const hc = healthColor(phone.health_score);
  const canControl = role !== "viewer";

  return (
    <div className={styles.card}>
      {/* ADB disconnected warning — FR-4.9 */}
      {!phone.adb_connected && <div className={styles.adbWarning}>{t("phones_adb_warn")}</div>}

      {/* Header row */}
      <div className={styles.cardHeader}>
        <span
          className={styles.statusDot}
          style={{ background: col, boxShadow: `0 0 6px ${col}` }}
        />
        <Link
          to={`/phones/${phone.phone_id}`}
          className={styles.serial}
          onClick={(e) => e.stopPropagation()}
        >
          {phone.serial || phone.phone_id}
        </Link>
        <span className={styles.statusTag} style={{ color: col }}>
          {STATUS_LABEL[phone.status]}
        </span>
      </div>

      {/* Model + group */}
      <div className={styles.model}>
        {phone.model || "—"}
        {phone.group && <span className={styles.groupBadge}>{phone.group}</span>}
      </div>

      {/* Health bar */}
      <div className={styles.healthRow}>
        <span className={styles.healthLabel}>health</span>
        <div className={styles.healthBar}>
          <div
            className={styles.healthFill}
            style={{ width: `${phone.health_score}%`, background: hc }}
          />
        </div>
        <span className={styles.healthVal} style={{ color: hc }}>
          {phone.health_score}%
        </span>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t("phones_posts")}</span>
          <span className={styles.statValue}>{phone.posts_today}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t("phones_accounts")}</span>
          <span className={styles.statValue}>{phone.accounts?.length ?? 0}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t("phones_day")}</span>
          <span className={styles.statValue}>{phone.warmup_day}</span>
        </div>
      </div>

      {/* Actions — hidden for viewer role */}
      {canControl && (
        <div className={styles.actions}>
          {phone.status === "paused" ? (
            <button className={styles.btn} onClick={() => resumePhone(phone.phone_id)}>
              {t("phones_resume")}
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnPause}`}
              onClick={() => pausePhone(phone.phone_id)}
            >
              {t("phones_pause")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PhonesPage() {
  const phones = useFarmStore((s) => s.phones);
  const phonesLoading = useFarmStore((s) => s.phonesLoading);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);
  const t = useT();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Phone["status"] | "all">("all");
  const [groupFilter, setGroupFilter] = useState<string | "all">("all");

  useEffect(() => {
    fetchPhones();
    const id = setInterval(fetchPhones, 30_000);
    return () => clearInterval(id);
  }, [fetchPhones]);

  // Collect unique groups
  const groups = useMemo(
    () => [...new Set(phones.map((p) => p.group).filter(Boolean))].sort(),
    [phones]
  );

  // Status counts
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const st of ALL_STATUSES) m[st] = phones.filter((p) => p.status === st).length;
    return m;
  }, [phones]);

  // Filter
  const filtered = useMemo(() => {
    let list = phones;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (groupFilter !== "all") list = list.filter((p) => p.group === groupFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.phone_id.toLowerCase().includes(q) ||
          p.serial?.toLowerCase().includes(q) ||
          p.accounts?.some((a) => a.username.toLowerCase().includes(q))
      );
    }
    return list;
  }, [phones, statusFilter, groupFilter, search]);

  const online = phones.filter((p) => p.status === "active").length;
  const subtitle = phonesLoading
    ? t("phones_loading")
    : phones.length > 0
      ? `${phones.length} ${t("phones_devices_unit")} · ${online} ${t("phones_online_unit")}`
      : t("phones_no_data");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>{t("phones_title")}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        <button className={styles.syncBtn} onClick={fetchPhones}>
          {t("phones_refresh")}
        </button>
      </header>

      {/* ── Status summary bar ── */}
      <div className={styles.statusBar}>
        <span className={styles.statusCount} style={{ color: "#22c55e" }}>
          ● {statusCounts.active ?? 0} {t("phones_bar_online")}
        </span>
        <span className={styles.statusCount} style={{ color: "#6b7280" }}>
          ○ {statusCounts.offline ?? 0} {t("phones_bar_offline")}
        </span>
        <span className={styles.statusCount} style={{ color: "#fbbf24" }}>
          ⚠ {statusCounts.warmup ?? 0} warmup
        </span>
        <span className={styles.statusCount} style={{ color: "#ef4444" }}>
          ✕ {statusCounts.banned ?? 0} {t("phones_bar_ban")}
        </span>
      </div>

      {/* ── Filters row (FR-4.4, FR-4.5, FR-4.6) ── */}
      <div className={styles.filtersRow}>
        {/* Search */}
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t("phones_search_ph")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Group filter */}
        <select
          className={styles.filterSelect}
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">{t("phones_groups_all")}</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${statusFilter === "all" ? styles.filterTabActive : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            {t("phones_filter_all")}
          </button>
          {ALL_STATUSES.map((st) => (
            <button
              key={st}
              className={`${styles.filterTab} ${statusFilter === st ? styles.filterTabActive : ""}`}
              onClick={() => setStatusFilter(st)}
              style={statusFilter === st ? { color: STATUS_COLOR[st] } : undefined}
            >
              {STATUS_LABEL[st]}
              {(statusCounts[st] ?? 0) > 0 && (
                <span className={styles.filterCount}>{statusCounts[st]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && !phonesLoading ? (
        <div className={styles.empty}>
          {phones.length === 0 ? t("phones_empty") : t("phones_empty_filter")}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((p) => (
            <PhoneCard key={p.phone_id} phone={p} />
          ))}
        </div>
      )}
    </div>
  );
}
