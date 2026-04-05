import type { Account } from "@atome/shared";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LOCALE_MAP, useT } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import { useFarmStore } from "../../stores/farm";
import { useLangStore } from "../../stores/lang";
import styles from "./AccountDetailPage.module.css";

const STATUS_COLOR: Record<string, string> = {
  active: "#22c55e",
  warmup: "#fbbf24",
  paused: "#60a5fa",
  banned: "#ef4444",
};

const CONTENT_SOURCES = ["sportzavod", "contentzavod"];

type EditDraft = Pick<
  Account,
  "niche" | "timezone" | "post_frequency_hours" | "heygen_avatar_id" | "content_sources" | "status"
>;

function toDraft(acc: Account): EditDraft {
  return {
    niche: acc.niche ?? "",
    timezone: acc.timezone ?? "UTC",
    post_frequency_hours: acc.post_frequency_hours ?? 12,
    heygen_avatar_id: acc.heygen_avatar_id ?? "",
    content_sources: acc.content_sources ?? [],
    status: acc.status,
  };
}

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accounts = useFarmStore((s) => s.accounts);
  const queue = useFarmStore((s) => s.queue);
  const fetchAccounts = useFarmStore((s) => s.fetchAccounts);
  const fetchQueue = useFarmStore((s) => s.fetchQueue);
  const updateAccount = useFarmStore((s) => s.updateAccount);
  const accountsLoading = useFarmStore((s) => s.accountsLoading);
  const canEdit = useAuthStore((s) => s.role) !== "viewer";
  const navigate = useNavigate();
  const t = useT();
  const lang = useLangStore((s) => s.lang);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts();
    fetchQueue();
  }, [accounts.length, fetchAccounts, fetchQueue]);

  const acc = accounts.find((a) => a.account_id === id);

  const accQueue = queue.filter((item) => item.account_id === id);
  const scheduled = accQueue.filter((item) => item.status === "scheduled");
  const inProgress = accQueue.filter((item) => item.status === "in_progress");

  if (accountsLoading)
    return (
      <div className={styles.page}>
        <div className={styles.empty}>{t("acc_loading")}</div>
      </div>
    );
  if (!acc)
    return (
      <div className={styles.page}>
        <Link to="/accounts" className={styles.back}>
          {t("acc_back")}
        </Link>
        <div className={styles.empty}>
          — {t("acc_not_found")}: {id}
        </div>
      </div>
    );

  const col = STATUS_COLOR[acc.status] ?? "#6b7280";

  const startEdit = () => {
    setDraft(toDraft(acc));
    setSaveError("");
    setSaved(false);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(null);
    setSaveError("");
  };

  const handleSave = async () => {
    if (!draft || !id) return;
    setSaving(true);
    setSaveError("");
    try {
      await updateAccount(id, draft);
      setSaved(true);
      setIsEditing(false);
      setDraft(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setSaveError(e.message || t("acc_save_err"));
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = (src: string) => {
    if (!draft) return;
    const next = draft.content_sources.includes(src)
      ? draft.content_sources.filter((s) => s !== src)
      : [...draft.content_sources, src];
    setDraft({ ...draft, content_sources: next });
  };

  return (
    <div className={styles.page}>
      <Link to="/accounts" className={styles.back}>
        {t("acc_back")}
      </Link>

      {/* Header */}
      <div className={styles.titleRow}>
        <div>
          <div className={styles.title}>@{acc.username}</div>
          <div className={styles.sub}>
            {acc.niche} · {acc.platform}
          </div>
        </div>
        <span className={styles.statusBadge} style={{ color: col, borderColor: col }}>
          {acc.status}
        </span>
      </div>

      {/* Action buttons (FR-8.5) */}
      <div className={styles.actions}>
        <button
          className={styles.btnPrimary}
          onClick={() => navigate(`/generate?account=${acc.account_id}`)}
        >
          {t("acc_start_gen")}
        </button>
        <button className={styles.btnSecondary} onClick={() => navigate("/queue")}>
          {t("acc_to_queue")}
        </button>
      </div>

      {saved && <div className={styles.successBanner}>{t("acc_saved")}</div>}

      {/* Stats grid */}
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Health Score</div>
          <div
            className={styles.cardBig}
            style={{
              color:
                acc.health_score >= 80 ? "#22c55e" : acc.health_score >= 50 ? "#fbbf24" : "#ef4444",
            }}
          >
            {acc.health_score}%
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("acc_posts_today")}</div>
          <div className={styles.cardBig}>{acc.stats?.posts_today ?? 0}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("acc_posts_week")}</div>
          <div className={styles.cardBig}>{acc.stats?.posts_week ?? 0}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t("acc_posts_total")}</div>
          <div className={styles.cardBig}>{acc.stats?.posts_total ?? 0}</div>
        </div>
      </div>

      {/* Editable info card (FR-8.1) */}
      <div className={styles.detailCard}>
        <div className={styles.cardTitleRow}>
          <div className={styles.cardTitle}>{t("acc_info_title")}</div>
          {canEdit && !isEditing && (
            <button className={styles.editBtn} onClick={startEdit}>
              {t("acc_edit_btn")}
            </button>
          )}
          {isEditing && (
            <div className={styles.editActions}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? t("acc_saving") : t("acc_save_btn")}
              </button>
              <button className={styles.cancelBtn} onClick={cancelEdit}>
                {t("acc_cancel")}
              </button>
            </div>
          )}
        </div>

        {saveError && <div className={styles.errorMsg}>{saveError}</div>}

        {/* Read-only fields */}
        <ReadRow label={t("acc_phone_label")} value={acc.phone_id || "—"} />
        <ReadRow label={t("acc_warmup_day")} value={String(acc.warmup_day)} />
        <ReadRow label={t("acc_last_post")} value={acc.stats?.last_post || "—"} />

        {/* Editable fields */}
        {isEditing && draft ? (
          <>
            <EditRow label={t("acc_niche")}>
              <input
                className={styles.fieldInput}
                value={draft.niche}
                onChange={(e) => setDraft({ ...draft, niche: e.target.value })}
              />
            </EditRow>

            <EditRow label={t("acc_status_label")}>
              <select
                className={styles.fieldSelect}
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value as Account["status"] })
                }
              >
                <option value="active">active</option>
                <option value="warmup">warmup</option>
                <option value="paused">paused</option>
                <option value="banned">banned</option>
              </select>
            </EditRow>

            <EditRow label={t("acc_timezone")}>
              <input
                className={styles.fieldInput}
                value={draft.timezone}
                onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
              />
            </EditRow>

            <EditRow label={t("acc_frequency")}>
              <input
                className={styles.fieldInput}
                type="number"
                min={4}
                max={24}
                value={draft.post_frequency_hours}
                onChange={(e) =>
                  setDraft({ ...draft, post_frequency_hours: Number(e.target.value) })
                }
              />
            </EditRow>

            <EditRow label="HeyGen avatar ID">
              <input
                className={styles.fieldInput}
                value={draft.heygen_avatar_id ?? ""}
                onChange={(e) => setDraft({ ...draft, heygen_avatar_id: e.target.value })}
                placeholder="optional"
              />
            </EditRow>

            <EditRow label={t("acc_sources_edit")}>
              <div className={styles.checkboxGroup}>
                {CONTENT_SOURCES.map((src) => (
                  <label key={src} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={draft.content_sources.includes(src)}
                      onChange={() => toggleSource(src)}
                    />
                    {src}
                  </label>
                ))}
              </div>
            </EditRow>
          </>
        ) : (
          <>
            <ReadRow label={t("acc_niche")} value={acc.niche || "—"} />
            <ReadRow label={t("acc_status_label")} value={acc.status} />
            <ReadRow label={t("acc_timezone")} value={acc.timezone || "—"} />
            <ReadRow label={t("acc_frequency")} value={String(acc.post_frequency_hours)} />
            <ReadRow label="HeyGen avatar" value={acc.heygen_avatar_id || "—"} />
            <ReadRow label={t("acc_sources")} value={acc.content_sources?.join(", ") || "—"} />
          </>
        )}
      </div>

      {/* Queue position (FR-8.6) */}
      <div className={styles.detailCard}>
        <div className={styles.cardTitle}>{t("acc_queue_pos")}</div>
        {accQueue.length === 0 ? (
          <div className={styles.emptySmall}>{t("acc_no_queue")}</div>
        ) : (
          <>
            {inProgress.length > 0 && (
              <div className={styles.queueInfo} style={{ color: "#22c55e" }}>
                {t("acc_publishing_now")} ({inProgress.length})
              </div>
            )}
            {scheduled.length > 0 && (
              <div className={styles.queueInfo} style={{ color: "#60a5fa" }}>
                {t("acc_scheduled_count")} {scheduled.length}
              </div>
            )}
            {accQueue.map((task) => (
              <div key={task.task_id} className={styles.row}>
                <span className={styles.rowLabel}>{task.status}</span>
                <span className={styles.rowValue}>
                  {new Date(task.scheduled_at).toLocaleTimeString(LOCALE_MAP[lang], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.editRow}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.editField}>{children}</div>
    </div>
  );
}
