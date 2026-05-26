import { useEffect, useMemo, useState } from "react";
import type {
  AvailablePhone,
  PlatformId,
  ServiceRegistryItem,
} from "@atome/shared";
import { useVhaStore } from "../stores/vha";

interface Props {
  onClose: () => void;
}

const ALL_PLATFORMS: PlatformId[] = [
  "google",
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "facebook",
];
const PLATFORM_LABEL: Record<PlatformId, string> = {
  google: "Google",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  facebook: "Facebook",
};

const DEFAULT_PLATFORMS: PlatformId[] = ["google", "instagram", "tiktok"];

const ovrl: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1100,
};
const card: React.CSSProperties = {
  background: "#0e1019",
  border: "1px solid #2a2f44",
  borderRadius: 12,
  padding: 28,
  width: 640,
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  color: "#dde",
  fontSize: 13,
};
const titleSt: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#fff",
  letterSpacing: "-0.01em",
};
const stepsBar: React.CSSProperties = {
  display: "flex",
  gap: 6,
  fontSize: 11,
  color: "#7a839a",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
const stepDot = (active: boolean, done: boolean): React.CSSProperties => ({
  flex: 1,
  height: 4,
  borderRadius: 2,
  background: done ? "#22c55e" : active ? "#22d3ee" : "#1f2235",
});
const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 8,
};
const list: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  maxHeight: "50vh",
  overflowY: "auto",
  padding: "2px 4px 2px 0",
};
const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid #1f2235",
  borderRadius: 8,
  cursor: "pointer",
  userSelect: "none",
};
const rowChecked: React.CSSProperties = {
  ...row,
  background: "rgba(34,211,238,0.08)",
  border: "1px solid rgba(34,211,238,0.4)",
};
const actions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 4,
  borderTop: "1px solid #1f2235",
  paddingTop: 16,
};
const btnGhost: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid #2a2f44",
  borderRadius: 6,
  color: "#9aa",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const btnPrimary: React.CSSProperties = {
  padding: "8px 16px",
  background: "linear-gradient(180deg, #22d3ee, #0891b2)",
  border: "1px solid #0891b2",
  borderRadius: 6,
  color: "#001218",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const btnGreen: React.CSSProperties = {
  ...btnPrimary,
  background: "linear-gradient(180deg, #22c55e, #15803d)",
  border: "1px solid #15803d",
  color: "#001a07",
};
const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid #2a2f44",
  borderRadius: 6,
  padding: "8px 12px",
  color: "#dde",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};
const warningBox: React.CSSProperties = {
  padding: "8px 12px",
  background: "rgba(251,191,36,0.08)",
  border: "1px solid rgba(251,191,36,0.3)",
  borderRadius: 6,
  fontSize: 12,
  color: "#fbbf24",
};
const errBox: React.CSSProperties = {
  padding: "8px 12px",
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 6,
  fontSize: 12,
  color: "#ef4444",
};
const subtle: React.CSSProperties = {
  fontSize: 11,
  color: "#7a839a",
};

const STATUS_DOT: Record<string, string> = {
  active: "#22c55e",
  online: "#22c55e",
  warmup: "#fbbf24",
  paused: "#9ca3af",
  offline: "#6b7280",
  banned: "#ef4444",
  error: "#ef4444",
};

export function CreateAccountsWizard({ onClose }: Props) {
  const fetchServicesRegistry = useVhaStore((s) => s.fetchServicesRegistry);
  const fetchAvailablePhones = useVhaStore((s) => s.fetchAvailablePhones);
  const createJob = useVhaStore((s) => s.createAccountCreationJob);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [services, setServices] = useState<ServiceRegistryItem[]>([]);
  const [serviceLoadErr, setServiceLoadErr] = useState<string | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [phoneMode, setPhoneMode] = useState<"auto" | "manual">("auto");
  const [autoCount, setAutoCount] = useState<number>(5);
  const [availablePhones, setAvailablePhones] = useState<AvailablePhone[]>([]);
  const [phonesLoading, setPhonesLoading] = useState(false);
  const [phonesLoadErr, setPhonesLoadErr] = useState<string | null>(null);
  const [phonesShowAll, setPhonesShowAll] = useState<boolean>(false);
  const [phonesSearch, setPhonesSearch] = useState<string>("");
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<Set<string>>(
    new Set(),
  );
  const [platforms, setPlatforms] = useState<Set<PlatformId>>(
    new Set(DEFAULT_PLATFORMS),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  // Load services
  useEffect(() => {
    let cancel = false;
    setServiceLoading(true);
    fetchServicesRegistry()
      .then((r) => {
        if (cancel) return;
        if (!r.services || r.services.length === 0) {
          setServiceLoadErr(
            "Сервисов не найдено (backend ещё не подключён или 404)",
          );
        }
        setServices(r.services ?? []);
      })
      .catch((e) => {
        if (cancel) return;
        setServiceLoadErr(`Не удалось загрузить сервисы: ${e?.message ?? e}`);
      })
      .finally(() => {
        if (!cancel) setServiceLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [fetchServicesRegistry]);

  // Load phones when entering step 3
  useEffect(() => {
    if (step !== 3) return;
    let cancel = false;
    setPhonesLoading(true);
    setPhonesLoadErr(null);
    fetchAvailablePhones(500, phonesShowAll ? "all" : "empty")
      .then((r) => {
        if (cancel) return;
        setAvailablePhones(r.items ?? []);
        if ((r.items ?? []).length === 0) {
          setPhonesLoadErr(
            "Список телефонов пуст (backend ещё не подключён или нет свободных)",
          );
        }
      })
      .catch((e) => {
        if (cancel) return;
        setPhonesLoadErr(`Не удалось загрузить телефоны: ${e?.message ?? e}`);
      })
      .finally(() => {
        if (!cancel) setPhonesLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [step, fetchAvailablePhones, phonesShowAll]);

  // Auto-select themes when service has only one
  useEffect(() => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      for (const id of selectedServiceIds) {
        const svc = services.find((s) => s.id === id);
        if (!svc) continue;
        if (svc.themes.length === 1) {
          next.add(svc.themes[0]);
        }
        // remove themes that belong to no longer-selected services
      }
      // prune themes from deselected services
      const allowed = new Set<string>();
      for (const id of selectedServiceIds) {
        const svc = services.find((s) => s.id === id);
        if (svc) for (const t of svc.themes) allowed.add(t);
      }
      for (const t of Array.from(next)) {
        if (!allowed.has(t)) next.delete(t);
      }
      return next;
    });
  }, [selectedServiceIds, services]);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleTheme = (theme: string) => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  };
  const togglePhone = (id: string) => {
    setSelectedPhoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const togglePlatform = (p: PlatformId) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.has(s.id)),
    [services, selectedServiceIds],
  );

  const canNext1 = selectedServiceIds.size > 0;
  const canNext2 = selectedThemes.size > 0;
  const canNext3 =
    phoneMode === "manual"
      ? selectedPhoneIds.size > 0
      : autoCount >= 1 && autoCount <= 50;
  const platformsList = useMemo(() => Array.from(platforms), [platforms]);
  const googleMissing = !platforms.has("google");
  const canCreate = platformsList.length > 0;

  const phoneCount =
    phoneMode === "manual" ? selectedPhoneIds.size : autoCount;
  const accountsTotal = phoneCount * platformsList.length;

  const onCreate = async () => {
    setSubmitting(true);
    setSubmitErr(null);
    // ensure google in platforms
    const finalPlatforms = new Set(platforms);
    finalPlatforms.add("google");
    try {
      const body = {
        services: Array.from(selectedServiceIds),
        themes: Array.from(selectedThemes),
        platforms: Array.from(finalPlatforms),
        phone_ids:
          phoneMode === "manual" ? Array.from(selectedPhoneIds) : undefined,
        auto_phones_count: phoneMode === "auto" ? autoCount : undefined,
        count_per_phone: 1,
      };
      const r = await createJob(body);
      setSubmitOk(`✓ Job ${r.job_id} создан. Задачи запускаются в фоне.`);
      window.setTimeout(() => onClose(), 2500);
    } catch (e) {
      setSubmitErr(`Не удалось создать job: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop
    <div style={ovrl} onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: card */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: card */}
      <div style={card} onClick={stopProp}>
        <div style={titleSt}>Создание аккаунтов · шаг {step} из 5</div>
        <div style={stepsBar}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={stepDot(n === step, n < step)} />
          ))}
        </div>

        {step === 1 && (
          <>
            <div style={sectionTitle}>Сервисы</div>
            {serviceLoading && (
              <div style={subtle}>Загрузка сервисов...</div>
            )}
            {!serviceLoading && serviceLoadErr && (
              <div style={errBox}>{serviceLoadErr}</div>
            )}
            {!serviceLoading && services.length > 0 && (
              <div style={list}>
                {services.map((svc) => {
                  const checked = selectedServiceIds.has(svc.id);
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: row toggle
                    // biome-ignore lint/a11y/noStaticElementInteractions: row toggle
                    <div
                      key={svc.id}
                      style={checked ? rowChecked : row}
                      onClick={() => toggleService(svc.id)}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={checked}
                        style={{ pointerEvents: "none" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "#fff" }}>
                          {svc.title}
                        </div>
                        <div style={subtle}>{svc.id}</div>
                      </div>
                      <div style={subtle}>{svc.themes.length} тем</div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div style={sectionTitle}>Темы</div>
            {selectedServices.length === 0 ? (
              <div style={subtle}>Сначала выберите сервисы.</div>
            ) : (
              <div style={list}>
                {selectedServices.map((svc) => (
                  <div key={svc.id}>
                    <div
                      style={{
                        ...subtle,
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {svc.title}
                    </div>
                    {svc.themes.length === 0 && (
                      <div style={subtle}>— нет тем</div>
                    )}
                    {svc.themes.map((th) => {
                      const checked = selectedThemes.has(th);
                      return (
                        // biome-ignore lint/a11y/useKeyWithClickEvents: row toggle
                        // biome-ignore lint/a11y/noStaticElementInteractions: row toggle
                        <div
                          key={`${svc.id}-${th}`}
                          style={checked ? rowChecked : row}
                          onClick={() => toggleTheme(th)}
                        >
                          <input
                            type="checkbox"
                            readOnly
                            checked={checked}
                            style={{ pointerEvents: "none" }}
                          />
                          <div style={{ flex: 1, color: "#fff" }}>{th}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div style={sectionTitle}>Телефоны</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setPhoneMode("auto")}
                style={{
                  ...btnGhost,
                  ...(phoneMode === "auto"
                    ? {
                        borderColor: "#22d3ee",
                        color: "#22d3ee",
                      }
                    : {}),
                }}
              >
                Автоматически
              </button>
              <button
                type="button"
                onClick={() => setPhoneMode("manual")}
                style={{
                  ...btnGhost,
                  ...(phoneMode === "manual"
                    ? {
                        borderColor: "#22d3ee",
                        color: "#22d3ee",
                      }
                    : {}),
                }}
              >
                Вручную
              </button>
            </div>

            {phoneMode === "auto" && (
              <div
                style={{ display: "flex", gap: 10, alignItems: "center" }}
              >
                <label htmlFor="autoCount" style={subtle}>
                  Кол-во телефонов (1-50):
                </label>
                <input
                  id="autoCount"
                  type="number"
                  min={1}
                  max={50}
                  value={autoCount}
                  onChange={(e) =>
                    setAutoCount(
                      Math.max(
                        1,
                        Math.min(50, Number(e.target.value) || 1),
                      ),
                    )
                  }
                  style={{ ...inp, width: 80 }}
                />
              </div>
            )}

            {phoneMode === "manual" && (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Поиск по serial / persona"
                    value={phonesSearch}
                    onChange={(e) => setPhonesSearch(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      background: "#0f172a",
                      color: "#e5e7eb",
                      border: "1px solid #1e293b",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#94a3b8",
                      fontSize: 12,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={phonesShowAll}
                      onChange={(e) => setPhonesShowAll(e.target.checked)}
                    />
                    Показать все
                  </label>
                </div>
                {phonesLoading && <div style={subtle}>Загрузка...</div>}
                {!phonesLoading && phonesLoadErr && (
                  <div style={errBox}>{phonesLoadErr}</div>
                )}
                {!phonesLoading && availablePhones.length > 0 && (
                  <div style={list}>
                    {(availablePhones || [])
                .filter((ph: any) => {
                  if (!phonesSearch.trim()) return true;
                  const q = phonesSearch.toLowerCase();
                  const name = ((ph.persona_first_name || "") + " " + (ph.persona_last_name || "")).toLowerCase();
                  return (ph.serial || "").toLowerCase().includes(q) || name.includes(q);
                })
                .map((p) => {
                      const checked = selectedPhoneIds.has(p.phone_id);
                      const dot = STATUS_DOT[p.phone_status] || "#6b7280";
                      const serialSuffix = p.serial
                        ? p.serial
                        : p.phone_id.slice(0, 6);
                      const label =
                        p.persona_name || p.display_name || serialSuffix;
                      return (
                        // biome-ignore lint/a11y/useKeyWithClickEvents: row toggle
                        // biome-ignore lint/a11y/noStaticElementInteractions: row toggle
                        <div
                          key={p.phone_id}
                          style={checked ? rowChecked : row}
                          onClick={() => togglePhone(p.phone_id)}
                        >
                          <input
                            type="checkbox"
                            readOnly
                            checked={checked}
                            style={{ pointerEvents: "none" }}
                          />
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: dot,
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ color: "#fff" }}>{label}</div>
                            <div style={subtle}>
                              {serialSuffix} · {p.phone_status} ·{" "}
                              {p.accounts_count} acc
                              {p.bound_plans_count ? ` · ${p.bound_plans_count} plans` : ""}
                              {p.vha_id ? " · vha" : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div style={sectionTitle}>Платформы</div>
            <div style={list}>
              {ALL_PLATFORMS.map((p) => {
                const checked = platforms.has(p);
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: row toggle
                  // biome-ignore lint/a11y/noStaticElementInteractions: row toggle
                  <div
                    key={p}
                    style={checked ? rowChecked : row}
                    onClick={() => togglePlatform(p)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={checked}
                      style={{ pointerEvents: "none" }}
                    />
                    <div style={{ flex: 1, color: "#fff" }}>
                      {PLATFORM_LABEL[p]}
                    </div>
                    {p === "google" && (
                      <div style={subtle}>требуется</div>
                    )}
                  </div>
                );
              })}
            </div>
            {googleMissing && (
              <div style={warningBox}>
                Google всегда нужен. Будет включён автоматически при создании.
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <div style={sectionTitle}>Подтверждение</div>
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #1f2235",
                borderRadius: 8,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div>
                <span style={subtle}>К созданию:</span>{" "}
                <b style={{ color: "#22d3ee" }}>
                  {phoneCount} phones × {platformsList.length} platforms ={" "}
                  {accountsTotal} аккаунтов
                </b>
              </div>
              <div>
                <span style={subtle}>Сервисы:</span>{" "}
                {selectedServices.map((s) => s.title).join(", ") || "—"}
              </div>
              <div>
                <span style={subtle}>Темы:</span>{" "}
                {Array.from(selectedThemes).join(", ") || "—"}
              </div>
              <div>
                <span style={subtle}>Платформы:</span>{" "}
                {(googleMissing
                  ? ["google", ...platformsList.filter((p) => p !== "google")]
                  : platformsList
                )
                  .map((p) => PLATFORM_LABEL[p as PlatformId] ?? p)
                  .join(" → ")}
              </div>
              <div>
                <span style={subtle}>Режим телефонов:</span>{" "}
                {phoneMode === "auto"
                  ? `auto (${autoCount})`
                  : `manual (${selectedPhoneIds.size})`}
              </div>
            </div>
            {submitErr && <div style={errBox}>{submitErr}</div>}
          </>
        )}

        <div style={actions}>
          <button type="button" style={btnGhost} onClick={onClose}>
            Отмена
          </button>
          <div style={{ flex: 1 }} />
          {step > 1 && (
            <button
              type="button"
              style={btnGhost}
              onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4 | 5)}
              disabled={submitting}
            >
              ← Назад
            </button>
          )}
          {step < 5 && (
            <button
              type="button"
              style={btnPrimary}
              disabled={
                (step === 1 && !canNext1) ||
                (step === 2 && !canNext2) ||
                (step === 3 && !canNext3) ||
                (step === 4 && !canCreate)
              }
              onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4 | 5)}
            >
              Дальше →
            </button>
          )}
          {step === 5 && (
            <button
              type="button"
              style={btnGreen}
              disabled={submitting || !canCreate}
              onClick={onCreate}
            >
              {submitting ? "Создание..." : "Создать"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
