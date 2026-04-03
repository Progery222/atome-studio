import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const t = useT();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);

  // Decode name/email from JWT payload
  const payload = token
    ? (() => {
        try {
          const b64 = token.split(".")[1];
          const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
          return JSON.parse(json) as Record<string, string>;
        } catch {
          return {};
        }
      })()
    : {};

  const [name, setName] = useState((payload.name as string) ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In MVP — display-only save (no backend endpoint yet)
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.title}>{t("settings_title")}</div>
      </header>

      <div className={styles.sections}>
        {/* Profile */}
        <section className={styles.section}>
          <div className={styles.sectionTitle}>{t("settings_profile")}</div>
          <form className={styles.form} onSubmit={handleSave}>
            <div className={styles.field}>
              <label className={styles.label}>{t("settings_display_name")}</label>
              <input
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t("settings_email")}</label>
              <input
                className={styles.input}
                type="email"
                value={(payload.email as string) ?? ""}
                readOnly
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Роль</label>
              <div className={styles.roleBadge}>{role}</div>
            </div>
            <button type="submit" className={styles.saveBtn}>
              {saved ? `✓ ${t("settings_saved")}` : t("settings_save")}
            </button>
          </form>
        </section>

        {/* Security */}
        <section className={styles.section}>
          <div className={styles.sectionTitle}>{t("settings_security")}</div>
          <div className={styles.tokenInfo}>
            <span className={styles.tokenLabel}>JWT token</span>
            <span className={styles.tokenValue}>{token ? `${token.slice(0, 24)}…` : "—"}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            {t("settings_logout")}
          </button>
        </section>
      </div>
    </div>
  );
}
