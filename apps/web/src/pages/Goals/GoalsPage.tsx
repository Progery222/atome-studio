import type { GoalKind, GoalStatus, PhoneSelector } from "@atome/shared";
import { useEffect, useState } from "react";
import { GoalKindBadge } from "../../components/AutonomyBadge";
import { useT } from "../../i18n";
import { useAutonomyStore } from "../../stores/autonomy";
import { useFarmStore } from "../../stores/farm";
import styles from "./GoalsPage.module.css";

const GOAL_KINDS: GoalKind[] = [
  "browse_fyp",
  "warmup_day_1",
  "publish_video",
  "recover_from_ban",
];

const GOAL_STATUS_COLOR: Record<GoalStatus, string> = {
  pending: "#60a5fa",
  active: "#22c55e",
  completed: "#a78bfa",
  failed: "#ef4444",
  cancelled: "#6b7280",
};

type Tab = "phone" | "global";
type FilterStatus = "all" | GoalStatus;

export function GoalsPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("phone");
  const [filter, setFilter] = useState<FilterStatus>("all");

  const phones = useFarmStore((s) => s.phones);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);

  const phoneGoals = useAutonomyStore((s) => s.phoneGoals);
  const globalGoals = useAutonomyStore((s) => s.globalGoals);
  const fetchPhoneGoals = useAutonomyStore((s) => s.fetchPhoneGoals);
  const fetchGlobalGoals = useAutonomyStore((s) => s.fetchGlobalGoals);
  const createPhoneGoal = useAutonomyStore((s) => s.createPhoneGoal);
  const createGlobalGoal = useAutonomyStore((s) => s.createGlobalGoal);

  // Phone goal form
  const [pgSerial, setPgSerial] = useState<string>("");
  const [pgKind, setPgKind] = useState<GoalKind>("browse_fyp");
  const [pgPriority, setPgPriority] = useState<number>(5);

  // Global goal form
  const [ggKind, setGgKind] = useState<GoalKind>("browse_fyp");
  const [ggSerials, setGgSerials] = useState<string>("");
  const [ggShard, setGgShard] = useState<string>("");
  const [ggCount, setGgCount] = useState<string>("");
  const [ggStatus, setGgStatus] = useState<string>("");

  useEffect(() => {
    fetchPhones();
    fetchPhoneGoals();
    fetchGlobalGoals();
    const id = setInterval(() => {
      if (tab === "phone") fetchPhoneGoals();
      else fetchGlobalGoals();
    }, 10_000);
    return () => clearInterval(id);
  }, [tab, fetchPhones, fetchPhoneGoals, fetchGlobalGoals]);

  const filteredPhoneGoals =
    filter === "all" ? phoneGoals : phoneGoals.filter((g) => g.status === filter);

  async function handleCreatePhoneGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!pgSerial) return;
    const result = await createPhoneGoal({
      serial: pgSerial,
      kind: pgKind,
      priority: pgPriority,
    });
    if (result) {
      setPgSerial("");
      setPgPriority(5);
      fetchPhoneGoals();
    }
  }

  async function handleCreateGlobalGoal(e: React.FormEvent) {
    e.preventDefault();
    const selector: PhoneSelector = {};
    if (ggSerials.trim()) {
      selector.serials = ggSerials
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (ggShard.trim()) selector.shard = ggShard.trim();
    if (ggCount.trim()) {
      const n = Number(ggCount);
      if (Number.isFinite(n)) selector.count = n;
    }
    if (ggStatus.trim()) selector.status = ggStatus.trim();

    const result = await createGlobalGoal({ kind: ggKind, phone_selector: selector });
    if (result) {
      setGgSerials("");
      setGgShard("");
      setGgCount("");
      setGgStatus("");
      fetchGlobalGoals();
      fetchPhoneGoals();
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("goals_title")}</h1>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === "phone" ? styles.tabActive : ""}`}
            onClick={() => setTab("phone")}
          >
            {t("goals_tab_phone")}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "global" ? styles.tabActive : ""}`}
            onClick={() => setTab("global")}
          >
            {t("goals_tab_global")}
          </button>
        </div>
      </header>

      {tab === "phone" && (
        <div className={styles.content}>
          <form className={styles.form} onSubmit={handleCreatePhoneGoal}>
            <h3 className={styles.formTitle}>{t("goal_create_phone")}</h3>
            <div className={styles.formRow}>
              <label className={styles.field}>
                <span>{t("goal_select_phone")}</span>
                <select
                  value={pgSerial}
                  onChange={(e) => setPgSerial(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {phones.map((p: any) => (
                    <option key={p.phone_id || p.serial} value={p.serial || p.phone_id}>
                      {(p.serial || p.phone_id).slice(-10)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>{t("goal_select_kind")}</span>
                <select value={pgKind} onChange={(e) => setPgKind(e.target.value as GoalKind)}>
                  {GOAL_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`goal_kind_${k}` as never)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>{t("goal_priority")}</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={pgPriority}
                  onChange={(e) => setPgPriority(Number(e.target.value))}
                />
              </label>
              <button type="submit" className={styles.submitBtn}>
                {t("goal_btn_create")}
              </button>
            </div>
          </form>

          <div className={styles.filterBar}>
            {(["all", "active", "pending", "completed", "failed"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`${styles.filterChip} ${filter === f ? styles.filterChipActive : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? t("goal_filter_all") : t(`goal_status_${f}` as never)}
              </button>
            ))}
          </div>

          {filteredPhoneGoals.length === 0 ? (
            <div className={styles.empty}>{t("goal_no_goals")}</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>serial</th>
                  <th>{t("goal_select_kind")}</th>
                  <th>status</th>
                  <th>{t("goal_priority")}</th>
                  <th>{t("goal_progress")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhoneGoals.map((g) => (
                  <tr key={g.goal_id}>
                    <td className={styles.mono}>{g.serial.slice(-10)}</td>
                    <td>
                      <GoalKindBadge kind={g.kind} />
                    </td>
                    <td>
                      <span style={{ color: GOAL_STATUS_COLOR[g.status], fontWeight: 600 }}>
                        {t(`goal_status_${g.status}` as never)}
                      </span>
                    </td>
                    <td>{g.priority}</td>
                    <td className={styles.muted}>
                      {g.progress?.actions_done ?? 0}
                      {g.progress?.total ? ` / ${g.progress.total}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "global" && (
        <div className={styles.content}>
          <form className={styles.form} onSubmit={handleCreateGlobalGoal}>
            <h3 className={styles.formTitle}>{t("goal_create_global")}</h3>
            <div className={styles.formRow}>
              <label className={styles.field}>
                <span>{t("goal_select_kind")}</span>
                <select value={ggKind} onChange={(e) => setGgKind(e.target.value as GoalKind)}>
                  {GOAL_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`goal_kind_${k}` as never)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>{t("goal_selector_serials")}</span>
                <input
                  type="text"
                  value={ggSerials}
                  onChange={(e) => setGgSerials(e.target.value)}
                  placeholder="R83YA06Y8MF,R83YA06YFDT"
                />
              </label>
              <label className={styles.field}>
                <span>{t("goal_selector_shard")}</span>
                <input
                  type="text"
                  value={ggShard}
                  onChange={(e) => setGgShard(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>{t("goal_selector_count")}</span>
                <input
                  type="number"
                  value={ggCount}
                  onChange={(e) => setGgCount(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>{t("goal_selector_status")}</span>
                <input
                  type="text"
                  value={ggStatus}
                  onChange={(e) => setGgStatus(e.target.value)}
                  placeholder="active"
                />
              </label>
              <button type="submit" className={styles.submitBtn}>
                {t("goal_btn_create")}
              </button>
            </div>
          </form>

          {globalGoals.length === 0 ? (
            <div className={styles.empty}>{t("goal_no_goals")}</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("goal_select_kind")}</th>
                  <th>selector</th>
                  <th>status</th>
                  <th>created</th>
                </tr>
              </thead>
              <tbody>
                {globalGoals.map((g) => (
                  <tr key={g.goal_id}>
                    <td>
                      <GoalKindBadge kind={g.kind} />
                    </td>
                    <td className={styles.selector}>{JSON.stringify(g.phone_selector)}</td>
                    <td>
                      <span style={{ color: GOAL_STATUS_COLOR[g.status], fontWeight: 600 }}>
                        {t(`goal_status_${g.status}` as never)}
                      </span>
                    </td>
                    <td className={styles.muted}>
                      {new Date(g.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
