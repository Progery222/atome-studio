import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useT } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import { useFarmStore } from "../../stores/farm";
import { type Lang, useLangStore } from "../../stores/lang";
import { useMetricsStore } from "../../stores/metrics";

import styles from "./Layout.module.css";

const LANGS: { code: Lang; label: string }[] = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
  { code: "zh", label: "中" },
  { code: "es", label: "ES" },
];

export function Layout() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const role = useAuthStore((s) => s.role);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const demoMode = useMetricsStore((s) => s.demoMode);
  const enableDemo = useMetricsStore((s) => s.enableDemo);
  const disableDemo = useMetricsStore((s) => s.disableDemo);

  const phones = useFarmStore((s) => s.phones);
  const queue = useFarmStore((s) => s.queue);
  const activeJobs = useFarmStore((s) => s.activeJobs);
  const wsConnected = useFarmStore((s) => s.wsConnected);
  const connectWs = useFarmStore((s) => s.connectWs);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);
  const fetchQueue = useFarmStore((s) => s.fetchQueue);

  useEffect(() => {
    fetchPhones();
    fetchQueue();
    connectWs();
    const id = setInterval(() => {
      fetchPhones();
      fetchQueue();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchPhones, fetchQueue, connectWs]);

  const phonesOnline = phones.filter((p) => p.status === "active").length;
  const queueActive = queue.filter(
    (q) => q.status === "scheduled" || q.status === "in_progress"
  ).length;
  const generatingNow = activeJobs.filter((j) => j.status === "running").length;

  const NAV_ITEMS = [
    { path: "/phones", label: t("nav_phones"), badge: phones.length > 0 ? phonesOnline : null },
    { path: "/accounts", label: t("nav_accounts"), badge: null },
    ...(role !== "viewer"
      ? [
          {
            path: "/generate",
            label: t("nav_generate"),
            badge: generatingNow > 0 ? generatingNow : null,
          },
        ]
      : []),
    { path: "/queue", label: t("nav_queue"), badge: queueActive > 0 ? queueActive : null },
    { path: "/videos", label: t("nav_videos"), badge: null },
    { path: "/analytics", label: t("nav_analytics"), badge: null },
    ...(role === "super_admin" ? [{ path: "/clients", label: t("nav_clients"), badge: null }] : []),
    { path: "/settings", label: t("nav_settings"), badge: null },
  ];

  return (
    <div className={styles.root}>
      <button type="button" className={styles.hamburger} onClick={() => setSidebarOpen(true)}>
        &#9776;
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay dismiss */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay dismiss */}
      <div
        className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <nav className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <Link to="/" className={styles.logo}>
          {t("logo")}
        </Link>

        <div className={styles.nav}>
          {NAV_ITEMS.map(({ path, label, badge }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ""}`}
            >
              <span>{label}</span>
              {badge !== null && badge !== undefined && (
                <span className={styles.navBadge}>{badge}</span>
              )}
            </NavLink>
          ))}
        </div>

        {/* WS status */}
        <div className={styles.wsStatus}>
          <span
            className={styles.wsDot}
            style={{
              background: wsConnected ? "#22c55e" : "#6b7280",
              boxShadow: wsConnected ? "0 0 6px #22c55e" : "none",
            }}
          />
          <span className={styles.wsLabel}>{wsConnected ? "live" : "offline"}</span>
        </div>

        <div className={styles.spacer} />

        {/* Demo mode toggle */}
        <button
          className={`${styles.demoBtn} ${demoMode ? styles.demoBtnActive : ""}`}
          onClick={() => (demoMode ? disableDemo() : enableDemo())}
        >
          {demoMode ? "✕ DEMO" : "DEMO"}
        </button>

        {/* Language switcher */}
        <div className={styles.langSwitcher}>
          {LANGS.map(({ code, label }) => (
            <button
              key={code}
              className={`${styles.langBtn} ${lang === code ? styles.langBtnActive : ""}`}
              onClick={() => setLang(code)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
