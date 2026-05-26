import type { Phone } from "@atome/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import styles from "./CreateAccountModal.module.css";

interface MatrixCell {
  present: boolean;
  username?: string | null;
  account_id?: string | null;
}

interface MatrixRow {
  phone_id: string;
  serial: string | null;
  phone_status: string | null;
  vha_id: string | null;
  persona_name: string | null;
  theme_key: string | null;
  service: string | null;
  project_id: string | null;
  accounts: Record<string, MatrixCell>;
}

interface MatrixResponse {
  platforms: string[];
  themes_per_service: Record<string, string[]>;
  rows: MatrixRow[];
  total: number;
}

interface Props {
  phones: Phone[];
  onClose: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  google: "Google",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  facebook: "Facebook",
};

export function CreateAccountModal({ onClose }: Props) {
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [serviceId, setServiceId] = useState<string>("");
  const [themeKey, setThemeKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch(`/api/farm/accounts/matrix`);
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
      }
      const j = (await r.json()) as MatrixResponse;
      setMatrix(j);
    } catch (e: any) {
      setErr(e?.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const themesPerService = matrix?.themes_per_service ?? {};
  const services = useMemo(() => Object.keys(themesPerService).sort(), [themesPerService]);
  const platforms = matrix?.platforms ?? [];

  // Defaults: первый сервис, первая тема
  useEffect(() => {
    if (services.length > 0 && !serviceId) {
      setServiceId(services[0]);
    }
  }, [services, serviceId]);

  useEffect(() => {
    const list = themesPerService[serviceId] ?? [];
    if (list.length > 0 && !list.includes(themeKey)) {
      setThemeKey(list[0]);
    }
    if (list.length === 0) setThemeKey("");
  }, [serviceId, themesPerService, themeKey]);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
    setSelectedPhones(new Set());
  };

  // Фильтр phones
  const filteredRows = useMemo(() => {
    const rows = matrix?.rows ?? [];
    if (selectedPlatforms.size === 0) return [];
    return rows.filter((r) => {
      // Должна быть хотя бы одна выбранная платформа отсутствующей у phone
      const hasMissing = [...selectedPlatforms].some((p) => !(r.accounts[p]?.present));
      if (!hasMissing) return false;

      // Тема: либо у phone тема из выбранного сервиса, либо тема пуста
      if (r.theme_key) {
        const svcThemes = themesPerService[serviceId] ?? [];
        if (!svcThemes.includes(r.theme_key)) return false;
        // Если выбрана конкретная тема — phone должен ровно ей соответствовать
        if (themeKey && r.theme_key !== themeKey) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${r.phone_id} ${r.serial ?? ""} ${r.persona_name ?? ""} ${r.theme_key ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matrix, selectedPlatforms, themesPerService, serviceId, themeKey, search]);

  const togglePhone = (phoneId: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phoneId)) next.delete(phoneId);
      else next.add(phoneId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPhones.size === filteredRows.length) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(new Set(filteredRows.map((r) => r.phone_id)));
    }
  };

  const missingFor = (r: MatrixRow): string[] => {
    return [...selectedPlatforms].filter((p) => !(r.accounts[p]?.present));
  };

  const canCreate =
    !busy &&
    selectedPlatforms.size > 0 &&
    selectedPhones.size > 0 &&
    !!themeKey;

  const handleCreate = async () => {
    if (!canCreate) return;
    setBusy(true);
    setBanner(null);

    const phonesToCreate = filteredRows.filter((r) => selectedPhones.has(r.phone_id));

    // 1) assign-theme для phones без темы
    try {
      for (const r of phonesToCreate) {
        if (!r.theme_key) {
          const ar = await apiFetch(`/api/farm/accounts/matrix/assign-theme`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone_id: r.phone_id, theme_key: themeKey }),
          });
          if (!ar.ok && ar.status !== 409) {
            const j = await ar.json().catch(() => ({}));
            throw new Error(j.message || `assign-theme failed for ${r.phone_id}`);
          }
        }
      }

      // 2) собрать selections — все missing platforms из выбранных
      const selections: { phone_id: string; platform: string }[] = [];
      for (const r of phonesToCreate) {
        for (const p of missingFor(r)) {
          selections.push({ phone_id: r.phone_id, platform: p });
        }
      }

      if (selections.length === 0) {
        setBanner({ kind: "err", text: "Нечего создавать (все платформы уже есть)" });
        setBusy(false);
        return;
      }

      const cr = await apiFetch(`/api/farm/accounts/matrix/create-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      });
      const cj = await cr.json().catch(() => ({}));
      if (!cr.ok) {
        throw new Error(cj.message || "create-selected failed");
      }
      const jobs = cj.jobs?.length ?? selections.length;
      setBanner({ kind: "ok", text: `✓ Создано ${jobs} jobs (по одному на phone)` });
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (e: any) {
      setBanner({ kind: "err", text: e?.message || "Ошибка создания" });
    } finally {
      setBusy(false);
    }
  };

  const currentThemes = themesPerService[serviceId] ?? [];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className={styles.title}>Создать аккаунты</div>

        {/* 1. Соц-сети */}
        <div className={styles.field}>
          <label className={styles.label}>Соц-сети</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {platforms.map((p) => {
              const checked = selectedPlatforms.has(p);
              return (
                <label
                  key={p}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    border: `1px solid ${checked ? "rgba(0,210,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                    background: checked ? "rgba(0,210,255,0.1)" : "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 12,
                    color: checked ? "#22d3ee" : "rgba(255,255,255,0.7)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePlatform(p)}
                  />
                  {PLATFORM_LABELS[p] ?? p}
                </label>
              );
            })}
          </div>
        </div>

        {/* 2. Сервис + Тема */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className={styles.field}>
            <label className={styles.label}>Сервис</label>
            <select
              className={styles.select}
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              disabled={services.length === 0}
            >
              {services.length === 0 ? (
                <option value="">—</option>
              ) : (
                services.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Тема</label>
            <select
              className={styles.select}
              value={themeKey}
              onChange={(e) => setThemeKey(e.target.value)}
              disabled={currentThemes.length === 0}
            >
              {currentThemes.length === 0 ? (
                <option value="">—</option>
              ) : (
                currentThemes.map((th) => (
                  <option key={th} value={th}>
                    {th}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* 3. Phones */}
        <div className={styles.field}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <label className={styles.label}>Доступные телефоны ({filteredRows.length})</label>
            {filteredRows.length > 0 && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPhones.size === filteredRows.length && filteredRows.length > 0}
                  onChange={toggleAll}
                />
                Выбрать всех
              </label>
            )}
          </div>
          <input
            className={styles.input}
            placeholder="Поиск phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div
            style={{
              maxHeight: 280,
              overflowY: "auto",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            {loading && (
              <div style={{ padding: 16, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                Загрузка…
              </div>
            )}
            {err && (
              <div style={{ padding: 16, color: "#fca5a5", fontSize: 12 }}>Ошибка: {err}</div>
            )}
            {!loading && !err && selectedPlatforms.size === 0 && (
              <div style={{ padding: 16, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                Выберите хотя бы одну соц-сеть
              </div>
            )}
            {!loading && !err && selectedPlatforms.size > 0 && filteredRows.length === 0 && (
              <div style={{ padding: 16, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                Нет подходящих телефонов
              </div>
            )}
            {!loading && !err && filteredRows.map((r) => {
              const sel = selectedPhones.has(r.phone_id);
              const missing = missingFor(r);
              const noTheme = !r.theme_key;
              return (
                <label
                  key={r.phone_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: sel ? "rgba(0,210,255,0.05)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => togglePhone(r.phone_id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "#e2e8f0" }}>
                      {r.serial ?? r.phone_id}
                      {noTheme && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "#fbbf24" }}>
                          (тема будет назначена: {themeKey})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      нет: {missing.length === platforms.length ? "все" : missing.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")}
                      {r.persona_name && <> · {r.persona_name}</>}
                      {r.theme_key && <> · тема {r.theme_key}</>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {banner && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: 13,
              background: banner.kind === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${banner.kind === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: banner.kind === "ok" ? "#86efac" : "#fca5a5",
            }}
          >
            {banner.text}
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            className={styles.btnCreate}
            onClick={handleCreate}
            disabled={!canCreate}
          >
            {busy ? "Создаю…" : `Создать (${selectedPhones.size} phones)`}
          </button>
        </div>
      </div>
    </div>
  );
}
