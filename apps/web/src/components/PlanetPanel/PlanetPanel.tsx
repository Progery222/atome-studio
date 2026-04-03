import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../../i18n";
import type { GalaxyService } from "../AtomicCanvas/engine";
import { NeuralBg } from "./NeuralBg";
import styles from "./PlanetPanel.module.css";

interface Props {
  service: GalaxyService;
  exiting?: boolean;
  onClose: () => void;
}

export function PlanetPanel({ service, exiting: exitingProp = false, onClose }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const [exitingLocal, setExitingLocal] = useState(false);

  const isExiting = exitingProp || exitingLocal;

  const TYPE_LABELS: Record<string, string> = {
    generator: t("planet_type_generator"),
    orchestrator: t("planet_type_orchestrator"),
    farm: t("planet_type_farm"),
    storage: t("planet_type_storage"),
    api: t("planet_type_api"),
  };

  const SERVICE_ACTIONS: Record<string, { label: string; style: string; route?: string }[]> = {
    sportzavod: [
      { label: t("action_start_gen"), style: "primary", route: "/generate" },
      { label: t("action_task_queue"), style: "default", route: "/queue" },
      { label: t("action_accounts"), style: "default", route: "/accounts" },
    ],
    contentzavod: [
      { label: t("action_content_gen"), style: "primary", route: "/generate" },
      { label: t("action_video_lib"), style: "default", route: "/videos" },
      { label: t("action_accounts"), style: "default", route: "/accounts" },
    ],
    orchestrator: [
      { label: t("action_pub_queue"), style: "primary", route: "/queue" },
      { label: t("action_phones"), style: "default", route: "/phones" },
      { label: t("action_sys_overview"), style: "default", route: "/" },
    ],
    farm: [
      { label: t("action_manage_phones"), style: "primary", route: "/phones" },
      { label: t("action_tiktok_accs"), style: "default", route: "/accounts" },
      { label: t("action_pub_queue"), style: "default", route: "/queue" },
    ],
    minio: [{ label: t("action_video_lib"), style: "primary", route: "/videos" }],
    "dashboard-api": [
      { label: t("action_sys_settings"), style: "primary", route: "/settings" },
      { label: t("action_svc_overview"), style: "default", route: "/" },
    ],
  };

  const handleClose = () => {
    if (isExiting) return;
    setExitingLocal(true);
    setTimeout(onClose, 450);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const [r, g, b] = service.color;
  const ri = Math.round(r * 255),
    gi = Math.round(g * 255),
    bi = Math.round(b * 255);
  const cssColor = `rgb(${ri}, ${gi}, ${bi})`;
  const glowColor = `rgba(${ri}, ${gi}, ${bi}, 0.06)`;
  const colorAlpha = (a: number) => `rgba(${ri}, ${gi}, ${bi}, ${a})`;

  const actions = SERVICE_ACTIONS[service.id] ?? [];

  return (
    <div className={styles.overlay} onClick={handleClose}>
      {/* Blurred backdrop */}
      <div className={`${styles.backdrop} ${isExiting ? styles.backdropExit : ""}`} />

      {/* Fullscreen neural network — canvas with beam-shader-like packets */}
      <NeuralBg serviceId={service.id} color={service.color} exiting={isExiting} />

      <div
        className={`${styles.panel} ${isExiting ? styles.panelExit : ""}`}
        style={
          {
            "--panel-glow": glowColor,
            "--panel-color": colorAlpha(0.4),
            "--panel-color-text": colorAlpha(0.9),
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Slash effects */}
        {!isExiting && <div className={styles.slashLine} />}
        {isExiting && <div className={styles.slashLineExit} />}
        {<div className={styles.glitchLines} />}

        {/* Holographic overlay */}
        <div className={styles.holoOverlay}>
          <div className={styles.scanLine} />
          <div className={styles.holoGrid} />
        </div>

        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <div
              className={styles.planetDot}
              style={{ background: cssColor, boxShadow: `0 0 16px ${cssColor}`, color: cssColor }}
            />
            <div className={styles.titleBlock}>
              <div className={styles.name}>{service.name}</div>
              <div className={styles.typeTag}>{TYPE_LABELS[service.type] ?? service.type}</div>
            </div>
            <button className={styles.closeBtn} onClick={handleClose}>
              &#x2715;
            </button>
          </div>

          {/* Metrics */}
          <div className={styles.metricsRow}>
            <div className={styles.metricBox}>
              <div className={styles.metricValue}>{service.metrics.latency}</div>
              <div className={styles.metricLabel}>Latency</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricValue}>{service.metrics.load}</div>
              <div className={styles.metricLabel}>Load</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricValue}>{service.metrics.rps}</div>
              <div className={styles.metricLabel}>RPS</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricValue}>{service.metrics.errors}</div>
              <div className={styles.metricLabel}>Errors</div>
            </div>
          </div>

          {/* Subsystems */}
          <div className={styles.subsLabel}>{t("planet_subsystems")}</div>
          <div className={styles.subsList}>
            {service.subs.map((sub, i) => (
              <div
                key={sub.name}
                className={styles.subChip}
                style={{ animationDelay: `${0.5 + i * 0.08}s` }}
              >
                <span
                  className={styles.subDot}
                  style={{ background: sub.color, boxShadow: `0 0 6px ${sub.color}` }}
                />
                {sub.name}
                <span className={styles.subStatus} style={{ color: sub.color }}>
                  {sub.status}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className={styles.actions}>
              {actions.map((act) => (
                <button
                  key={act.label}
                  className={`${styles.actionBtn} ${
                    act.style === "primary"
                      ? styles.actionPrimary
                      : act.style === "danger"
                        ? styles.actionDanger
                        : ""
                  }`}
                  onClick={() => {
                    if (act.route) navigate(act.route);
                  }}
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
