import type { Phone } from "@atome/shared";
import { useState } from "react";
import { useT } from "../../i18n";
import { useFarmStore } from "../../stores/farm";
import styles from "./CreateAccountModal.module.css";

interface Props {
  phones: Phone[];
  onClose: () => void;
}

export function CreateAccountModal({ phones, onClose }: Props) {
  const createAccount = useFarmStore((s) => s.createAccount);
  const t = useT();

  const [username, setUsername] = useState("");
  const [niche, setNiche] = useState("");
  const [phoneId, setPhoneId] = useState(phones[0]?.phone_id ?? "");
  const [freq, setFreq] = useState("24");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!username.trim()) {
      setError(t("modal_err_username"));
      return;
    }
    if (!niche.trim()) {
      setError(t("modal_err_niche"));
      return;
    }

    setLoading(true);
    setError("");

    const result = await createAccount({
      username: username.trim(),
      niche: niche.trim(),
      phone_id: phoneId,
      post_frequency_hours: Number(freq),
      platform: "tiktok",
    });

    setLoading(false);

    if (!result) {
      setError(t("modal_err_offline"));
    } else {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{t("modal_create_title")}</div>

        <div className={styles.field}>
          <label className={styles.label}>Username</label>
          <input
            className={styles.input}
            placeholder="@username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t("modal_niche_label")}</label>
          <input
            className={styles.input}
            placeholder="fitness, travel, food..."
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t("modal_phone_label")}</label>
          <select
            className={styles.select}
            value={phoneId}
            onChange={(e) => setPhoneId(e.target.value)}
          >
            {phones.length === 0 ? (
              <option value="">{t("modal_no_phones")}</option>
            ) : (
              phones.map((p) => (
                <option key={p.phone_id} value={p.phone_id}>
                  {p.serial || p.phone_id}
                </option>
              ))
            )}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t("modal_freq_label")}</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={168}
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
          />
        </div>

        {error && <div className={styles.error}>✕ {error}</div>}

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose}>
            {t("modal_cancel")}
          </button>
          <button className={styles.btnCreate} onClick={handleCreate} disabled={loading}>
            {loading ? t("modal_creating") : t("modal_create_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
