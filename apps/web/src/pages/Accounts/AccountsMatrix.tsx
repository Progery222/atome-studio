import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

interface MatrixCell {
  present: boolean;
  username?: string | null;
  account_id?: string | null;
  status?: string | null;
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
  project_name: string | null;
  accounts: Record<string, MatrixCell>;
}

interface MatrixResponse {
  platforms: string[];
  themes_per_service: Record<string, string[]>;
  rows: MatrixRow[];
  total: number;
}

const PLATFORM_LABELS: Record<string, string> = {
  google: "Google",
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  x: "X",
  facebook: "FB",
};

export function AccountsMatrix() {
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch(`/api/farm/accounts/matrix?online_only=${onlineOnly}`);
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
      }
      const j = (await r.json()) as MatrixResponse;
      setData(j);
    } catch (e: any) {
      setErr(e?.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [onlineOnly]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const platforms = data?.platforms ?? [];
  const themesPerService = data?.themes_per_service ?? {};
  const services = Object.keys(themesPerService).sort();

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((r) => {
      if (serviceFilter !== "all" && r.service !== serviceFilter) {
        if (!(serviceFilter === "none" && !r.service)) return false;
      }
      if (themeFilter !== "all" && r.theme_key !== themeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${r.phone_id} ${r.serial ?? ""} ${r.persona_name ?? ""} ${r.theme_key ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, serviceFilter, themeFilter, search]);

  const toggleCell = (phoneId: string, platform: string) => {
    const key = `${phoneId}:${platform}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const assignTheme = async (phoneId: string, themeKey: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const r = await apiFetch(`/api/farm/accounts/matrix/assign-theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_id: phoneId, theme_key: themeKey }),
      });
      const j = await r.json();
      if (!r.ok) {
        setBanner({ kind: "err", text: j.message || "assign failed" });
      } else {
        setBanner({ kind: "ok", text: `Тема ${themeKey} привязана к ${phoneId}` });
        await fetchMatrix();
      }
    } catch (e: any) {
      setBanner({ kind: "err", text: e?.message || "assign failed" });
    } finally {
      setBusy(false);
      setTimeout(() => setBanner(null), 4000);
    }
  };

  const createSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setBanner(null);
    const selections = [...selected].map((k) => {
      const [phone_id, platform] = k.split(":");
      return { phone_id, platform };
    });
    try {
      const r = await apiFetch(`/api/farm/accounts/matrix/create-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      });
      const j = await r.json();
      if (!r.ok) {
        setBanner({ kind: "err", text: j.message || "create failed" });
      } else {
        const jobs = j.jobs || [];
        const errs = j.errors || [];
        let txt = `Создано jobs: ${jobs.length}`;
        if (errs.length) txt += `, ошибок: ${errs.length}`;
        setBanner({ kind: "ok", text: txt });
        setSelected(new Set());
        await fetchMatrix();
      }
    } catch (e: any) {
      setBanner({ kind: "err", text: e?.message || "create failed" });
    } finally {
      setBusy(false);
      setTimeout(() => setBanner(null), 6000);
    }
  };

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={serviceFilter}
          onChange={(e) => {
            setServiceFilter(e.target.value);
            setThemeFilter("all");
          }}
          style={selectStyle}
        >
          <option value="all">Все сервисы</option>
          <option value="none">Без темы</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)} style={selectStyle}>
          <option value="all">Все темы</option>
          {Object.entries(themesPerService).flatMap(([svc, arr]) =>
            arr.map((t) => (
              <option key={t} value={t}>
                {svc} / {t}
              </option>
            ))
          )}
        </select>

        <input
          type="text"
          placeholder="Поиск phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...selectStyle, minWidth: 200 }}
        />

        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
          Только онлайн
        </label>

        <button onClick={fetchMatrix} disabled={busy} style={btnStyle}>
          Обновить
        </button>

        <button
          onClick={async () => {
            setBusy(true);
            setBanner(null);
            try {
              const r = await apiFetch("/api/farm/account-creation/discover-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              });
              const j = await r.json().catch(() => ({}));
              if (!r.ok) {
                setBanner({ kind: "err", text: `Discover failed: ${j?.message || r.statusText}` });
              } else {
                setBanner({
                  kind: "ok",
                  text: `Discover запущен: ${j.started} phones (пропущено ${j.skipped} — cooldown ${j.cooldown_hours}h). Матрица обновится через 60с.`,
                });
                window.setTimeout(() => fetchMatrix(), 60000);
              }
            } catch (e: any) {
              setBanner({ kind: "err", text: e?.message || "discover failed" });
            } finally {
              setBusy(false);
              window.setTimeout(() => setBanner(null), 10000);
            }
          }}
          disabled={busy}
          style={btnStyle}
        >
          Discover all
        </button>

        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: "auto" }}>
          Показано: {filteredRows.length} / {data?.total ?? 0}
        </span>
      </div>

      {banner && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 12,
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

      {loading && <div style={{ color: "rgba(255,255,255,0.6)" }}>Загрузка…</div>}
      {err && <div style={{ color: "#fca5a5" }}>Ошибка: {err}</div>}

      {!loading && !err && (
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "rgba(15,15,20,0.6)" }}>
            <thead>
              <tr>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Тема</th>
                <th style={thStyle}>Сервис</th>
                {platforms.map((p) => (
                  <th key={p} style={{ ...thStyle, textAlign: "center" }}>
                    {PLATFORM_LABELS[p] ?? p}
                  </th>
                ))}
                <th style={thStyle}>Persona</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const noTheme = !r.theme_key;
                const offline = r.phone_status !== "online";
                return (
                  <tr key={r.phone_id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={tdStyle}>
                      <div style={{ fontFamily: "monospace", fontSize: 12 }}>{r.serial ?? r.phone_id}</div>
                      <div style={{ fontSize: 10, color: offline ? "#f87171" : "#86efac" }}>
                        {r.phone_status ?? "—"}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {r.theme_key ? (
                        <span
                          style={{
                            background: "rgba(0,210,255,0.1)",
                            border: "1px solid rgba(0,210,255,0.3)",
                            color: "#22d3ee",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontSize: 11,
                          }}
                        >
                          {r.theme_key}
                        </span>
                      ) : (
                        <select
                          defaultValue=""
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            assignTheme(r.phone_id, v);
                          }}
                          style={{ ...selectStyle, fontSize: 11, padding: "4px 6px" }}
                        >
                          <option value="">— выбрать —</option>
                          {Object.entries(themesPerService).map(([svc, arr]) => (
                            <optgroup key={svc} label={svc}>
                              {arr.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: "#22d3ee", fontSize: 11 }}>{r.service ?? "—"}</td>
                    {platforms.map((p) => {
                      const cell = r.accounts[p] ?? { present: false };
                      const key = `${r.phone_id}:${p}`;
                      const isSel = selected.has(key);
                      const disabled = noTheme && !cell.present;
                      return (
                        <td key={p} style={{ ...tdStyle, textAlign: "center", padding: "8px 4px" }}>
                          {cell.present ? (
                            <span
                              title={cell.username ?? ""}
                              style={{
                                display: "inline-block",
                                width: 22,
                                height: 22,
                                lineHeight: "22px",
                                borderRadius: "50%",
                                background: "rgba(34,197,94,0.2)",
                                color: "#22c55e",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "default",
                              }}
                            >
                              ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={disabled || busy}
                              onClick={() => !disabled && toggleCell(r.phone_id, p)}
                              title={disabled ? "Сначала привяжи тему" : "Выбрать для создания"}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: isSel ? "rgba(0,210,255,0.4)" : "rgba(239,68,68,0.15)",
                                color: isSel ? "#fff" : "#f87171",
                                fontSize: 12,
                                fontWeight: 700,
                                border: isSel ? "2px solid #22d3ee" : "1px solid rgba(239,68,68,0.3)",
                                cursor: disabled ? "not-allowed" : "pointer",
                                opacity: disabled ? 0.3 : 1,
                              }}
                            >
                              {isSel ? "•" : "+"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                      {r.persona_name ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer with bulk action */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 16,
          padding: "12px 16px",
          background: "rgba(15,15,20,0.95)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
          Выбрано: <strong style={{ color: "#22d3ee" }}>{selected.size}</strong> ячеек
        </span>
        <button
          disabled={selected.size === 0 || busy}
          onClick={createSelected}
          style={{
            ...btnStyle,
            background: selected.size > 0 ? "rgba(0,210,255,0.15)" : "rgba(255,255,255,0.05)",
            color: selected.size > 0 ? "#fff" : "rgba(255,255,255,0.4)",
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
          }}
        >
          Создать выбранные
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            style={{ ...btnStyle, background: "transparent", color: "rgba(255,255,255,0.5)" }}
          >
            Очистить
          </button>
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "rgba(15,15,20,0.8)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  background: "rgba(0,210,255,0.05)",
  color: "#22d3ee",
  border: "1px solid rgba(0,210,255,0.2)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.3)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "rgba(255,255,255,0.85)",
  verticalAlign: "middle",
};
